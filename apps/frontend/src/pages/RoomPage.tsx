import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaChevronRight,
  FaChevronLeft,
  FaChevronUp,
  FaChevronDown,
  FaLink,
} from 'react-icons/fa';
import Chat from '../components/Chat';
import { useGameRoom } from '../hooks/useGameRoom';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { GameBoard } from '../components/GameBoard';
import { useGameState } from '../hooks/useGameState';
import { usePlayerManagement } from '../hooks/usePlayerManagement';
import { useWordSubmission } from '../hooks/useWordSubmission';
import { useVisualState } from '../hooks/useVisualState.ts';
import { useIsMobile } from '../hooks/useIsMobile.ts';
import { formatDurationSeconds } from '../utils/formatTime.ts';
import { useRoomRules, type LobbyRules } from '../hooks/useRoomRules';
import { RoomRulesDialog } from '../components/RoomRulesDialog';
import { usePlayerStats } from '../hooks/usePlayerStats';

export default function RoomPage({ roomName }: { roomName?: string }) {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const isMobile = useIsMobile();
  // Start closed by default (tests expect desktop chat to be closed). The
  // effect below will update this when `isMobile` actually changes after
  // mount — we skip the first mount so tests observe a stable initial state.
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const inviteTimerRef = useRef<number | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const mobileChatSheetRef = useRef<HTMLDivElement | null>(null);
  const mobileChatToggleRef = useRef<HTMLButtonElement | null>(null);

  // Custom hooks (order matters!): we must attach all socket listeners BEFORE
  // emitting joinRoom, otherwise on a page reload while a game is active the
  // server's immediate gameStarted/turnStarted snapshot can arrive before our
  // listeners are registered, leaving us stuck in the lobby view. So we call
  // the state/listener hooks first, then join the room last.
  const {
    gameState: socketGameState,
    timeLeftSec,
    bombCountdown,
    elapsedGameTime,
    liveInputs,
    lastSubmittedWords,
    lastWordAcceptedBy,
    winnerId,
    updateLiveInput,
  } = useGameState(roomCode);

  const {
    players,
    leaderId,
    playerId,
    playerName,
    me,
    toggleSeated,
    startGame,
  } = usePlayerManagement(roomCode);

  const { stats: playerStats, registerRejection } = usePlayerStats(
    roomCode,
    playerId,
    me?.name ?? playerName,
  );

  const gameState = useMemo(() => {
    if (!socketGameState) return socketGameState;
    if (!players.length) return socketGameState;

    const connectionOverrides = new Map<string, boolean>();
    for (const lobbyPlayer of players) {
      if (typeof lobbyPlayer.isConnected === 'boolean') {
        connectionOverrides.set(lobbyPlayer.id, lobbyPlayer.isConnected);
      }
    }

    if (connectionOverrides.size === 0) return socketGameState;

    let changed = false;
    const mergedPlayers = socketGameState.players.map((player) => {
      if (!connectionOverrides.has(player.id)) return player;
      const override = connectionOverrides.get(player.id);
      if (override === undefined || player.isConnected === override) {
        return player;
      }
      changed = true;
      return { ...player, isConnected: override };
    });

    return changed
      ? {
          ...socketGameState,
          players: mergedPlayers,
        }
      : socketGameState;
  }, [socketGameState, players]);

  const {
    rules: roomRules,
    updateRules: updateRoomRules,
    isUpdating: isRulesUpdating,
    error: roomRulesError,
    hasServerRules,
  } = useRoomRules(roomCode);

  const isLeader = leaderId === playerId;

  // Join room AFTER listeners above are wired.
  useGameRoom(roomCode);

  const { inputWord, setInputWord, rejected, handleSubmitWord } =
    useWordSubmission(roomCode, playerId);

  useEffect(() => {
    if (!rejected) return;
    registerRejection();
  }, [rejected, registerRejection]);

  useEffect(() => {
    setInputWord('');
  }, [gameState, setInputWord]);

  const seatedCount = useMemo(
    () => players.reduce((acc, p) => acc + (p.isSeated ? 1 : 0), 0),
    [players],
  );
  const visualState = useVisualState({ seatedCount, gameState });

  const winner = players.find((p) => p.id === winnerId);

  // Avoid toggling chat immediately on mount (which would break tests that
  // assert the initial state). Use a ref to skip the first effect run.
  const isMobileFirstMountRef = useRef(true);
  useEffect(() => {
    if (isMobileFirstMountRef.current) {
      isMobileFirstMountRef.current = false;
      return;
    }
    setIsChatOpen(!isMobile);
  }, [isMobile]);

  // Handle navigation if no room code
  useEffect(() => {
    if (!roomCode) {
      void navigate('/');
    }
  }, [roomCode, navigate]);

  // Centralized socket disconnect navigation (also handles network loss indirectly)
  useSocketConnection();

  // Title is set in RoomRoute when fetching room metadata; no-op here

  // Handle input change with typing update
  const handleInputChange = (value: string) => {
    setInputWord(value);
    if (gameState?.currentPlayerId === playerId) {
      updateLiveInput(playerId, value);
    }
  };

  const handleSaveRules = useCallback(
    (next: LobbyRules) => updateRoomRules(next),
    [updateRoomRules],
  );

  const formattedElapsed = formatDurationSeconds(elapsedGameTime);
  const localGamePlayer =
    gameState?.players.find((player) => player.id === playerId) ?? null;
  const currentLives = localGamePlayer?.lives ?? roomRules.startingLives;
  const totalPlayersInGame = gameState?.players.length ?? players.length;
  const activePlayersCount = gameState
    ? gameState.players.filter((p) => !p.isEliminated).length
    : seatedCount;
  const playersStatusLabel =
    visualState === 'playing'
      ? `${activePlayersCount}/${totalPlayersInGame} left`
      : `${seatedCount}/${players.length} ready`;

  function JoinGameButtons({ className = '' }: { className?: string } = {}) {
    return (
      <button
        onClick={toggleSeated}
        className={`rounded-lg px-6 py-3 font-medium shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 ${
          me?.isSeated
            ? 'border border-pink-400/20 bg-gradient-to-br from-pink-600/90 to-pink-500/90 text-white shadow-pink-500/20 backdrop-blur-sm hover:bg-pink-400/50' +
              ' active:bg-indigo-600/50'
            : 'border border-emerald-400/20 text-black' +
              ' bg-emerald-500 shadow-emerald-500/20 backdrop-blur-sm' +
              ' shadow-lg hover:bg-emerald-400 active:bg-emerald-600'
        } ${className}`}
        aria-label={me?.isSeated ? 'Leave game' : 'Join game'}
      >
        {me?.isSeated ? 'Leave Game' : 'Join Game'}
      </button>
    );
  }

  const closeMobileChat = useCallback(() => {
    setIsChatOpen(false);
    requestAnimationFrame(() => {
      if (mobileChatToggleRef.current) {
        mobileChatToggleRef.current.focus();
        return;
      }
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement &&
        mobileChatSheetRef.current?.contains(activeElement)
      ) {
        activeElement.blur();
      }
    });
  }, []);

  useEffect(() => {
    if (isChatOpen || !isMobile) {
      return;
    }
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      mobileChatSheetRef.current?.contains(activeElement)
    ) {
      if (mobileChatToggleRef.current) {
        mobileChatToggleRef.current.focus();
      } else {
        activeElement.blur();
      }
    }
  }, [isChatOpen, isMobile]);

  if (isMobile) {
    const isInGameView = visualState === 'playing' && !!gameState;

    return (
      <div className="relative flex min-h-[100svh] flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-purple-900 text-white">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black"
        >
          Skip to main content
        </a>

        <header className="relative z-20 flex items-center justify-between gap-3 bg-black/40 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              Room {roomCode}
            </p>
            <h1
              id="page-title"
              className="truncate text-lg font-semibold leading-tight text-white"
            >
              {roomName ?? `Room ${roomCode}`}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-white/70">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-[3px] font-semibold text-emerald-100">
                <span aria-hidden="true">❤️</span>
                <span>
                  {currentLives}/{roomRules.maxLives}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-[3px] uppercase tracking-wide">
                {playersStatusLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-[3px] uppercase tracking-wide">
                Min {roomRules.minTurnDuration}s
              </span>
              {visualState === 'playing' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-[3px] font-mono uppercase tracking-wide text-white">
                  {formattedElapsed}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInviteCopied(true);
                if (inviteTimerRef.current) {
                  clearTimeout(inviteTimerRef.current);
                }
                inviteTimerRef.current = window.setTimeout(() => {
                  setInviteCopied(false);
                  inviteTimerRef.current = null;
                }, 2000);

                void navigator.clipboard
                  .writeText(window.location.href)
                  .catch(() => undefined);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              title="Copy room invite link"
              aria-label={
                roomName
                  ? `Copy room invite link for ${roomName}`
                  : `Copy room invite link for Room ${roomCode}`
              }
            >
              <FaLink className="h-3.5 w-3.5 text-white/70" />
              <span>{inviteCopied ? 'Copied!' : 'Share'}</span>
            </button>

            <button
              onClick={() => {
                setIsChatOpen((prev) => !prev);
              }}
              ref={mobileChatToggleRef}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              aria-controls="mobile-chat-sheet"
              aria-expanded={isChatOpen}
              aria-label={isChatOpen ? 'Hide chat panel' : 'Show chat panel'}
            >
              <span>Chat</span>
              {isChatOpen ? (
                <FaChevronDown className="h-3.5 w-3.5" />
              ) : (
                <FaChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </header>

        <main
          id="main-content"
          className="relative flex flex-1 flex-col overflow-hidden"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-3">
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 text-xs text-white/80">
              {hasServerRules && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 font-semibold uppercase tracking-wide text-emerald-100">
                  WPP ≥ {roomRules.minWordsPerPrompt}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsRulesOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                Show rules
              </button>
            </div>
          </div>

          {isInGameView ? (
            <div className="relative flex min-h-0 flex-1 pt-16">
              <GameBoard
                gameState={gameState}
                inputWord={inputWord}
                setInputWord={handleInputChange}
                handleSubmitWord={handleSubmitWord}
                bombCountdown={bombCountdown}
                rejected={rejected}
                liveInputs={liveInputs}
                lastWordAcceptedBy={lastWordAcceptedBy}
                lastSubmittedWords={lastSubmittedWords}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-20">
              {visualState !== 'playing' && (
                <div className="mb-4">
                  <JoinGameButtons className="w-full justify-center text-sm uppercase tracking-wide" />
                </div>
              )}
              {winner && (
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-pink-600/30 via-purple-700/30 to-indigo-900/30 p-6 text-center shadow-xl backdrop-blur-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-600 text-2xl font-bold text-white">
                    {winner.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="mt-4 text-xl font-semibold text-white">
                    {winner.name} 🥇
                  </p>
                  <p className="mt-2 text-sm text-indigo-100">
                    won the last round!
                  </p>
                  <div role="status" aria-live="polite" className="sr-only">
                    {winner.name} won the last round
                  </div>
                </section>
              )}

              <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-white">
                    Lobby status
                  </h2>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70">
                    {seatedCount}/{players.length} ready
                  </span>
                </div>
                {timeLeftSec > 0 ? (
                  <div className="mt-4 flex flex-col gap-3 text-left text-sm text-indigo-100">
                    <p>
                      Game starts in{' '}
                      <span className="font-semibold text-white">
                        {timeLeftSec}s
                      </span>
                    </p>
                    {leaderId && playerId === leaderId && (
                      <button
                        onClick={startGame}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900"
                        data-testid="start-now-btn"
                        aria-label="Start game now"
                      >
                        Start now
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-indigo-100">
                    Waiting for players to join the game
                  </p>
                )}
              </section>

              <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-white">Players</h2>
                  <span className="text-xs font-medium uppercase tracking-wide text-white/60">
                    {players.length} in room
                  </span>
                </div>
                <div
                  className="mt-4 space-y-3"
                  role="list"
                  aria-label="Players in room"
                >
                  {players.map((p) => (
                    <div
                      key={p.id}
                      role="listitem"
                      className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 shadow-sm backdrop-blur-sm ${
                        p.isSeated
                          ? 'border-emerald-400/30 bg-emerald-500/10'
                          : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-700 text-sm font-semibold text-white">
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-base font-medium text-white">
                            {p.name}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-white/50">
                            {p.isSeated ? 'Ready to play' : 'Spectating'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-lg">
                        {p.id === leaderId && (
                          <span
                            className="leading-none"
                            aria-label="Game leader"
                          >
                            👑
                          </span>
                        )}
                        {p.isSeated && (
                          <span className="text-emerald-300" aria-label="Ready">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {!winner && (
                <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-white">
                    How to play
                  </h2>
                  <ul className="mt-4 space-y-2 text-left text-sm text-indigo-100">
                    <li>
                      Take turns creating words containing the given pattern
                    </li>
                    <li>Think fast! The bomb timer gets shorter each round</li>
                    <li>Words must be valid and not used previously</li>
                    <li>Last player standing wins the game</li>
                  </ul>
                </section>
              )}
            </div>
          )}
        </main>

        <div
          id="mobile-chat-sheet"
          ref={mobileChatSheetRef}
          className={`fixed inset-0 z-40 transition-opacity duration-300 ${
            isChatOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!isChatOpen}
        >
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
              isChatOpen ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
            onClick={closeMobileChat}
          />
          <div
            className={`absolute bottom-0 left-0 right-0 transform transition-transform duration-300 ${
              isChatOpen ? 'translate-y-0' : 'translate-y-full'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-chat-heading"
          >
            <div className="flex max-h-[80vh] flex-col rounded-t-3xl border-t border-white/10 bg-white/10 backdrop-blur-xl">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <span className="text-sm font-semibold text-white/80">
                  Room chat
                </span>
                <button
                  onClick={closeMobileChat}
                  className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  aria-label="Close chat"
                >
                  <FaChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <Chat
                  roomCode={roomCode}
                  roomName={roomName}
                  headingId="mobile-chat-heading"
                  autoFocus={isChatOpen}
                  regionRole="region"
                />
              </div>
            </div>
          </div>
        </div>

        <RoomRulesDialog
          open={isRulesOpen}
          onClose={() => {
            setIsRulesOpen(false);
          }}
          rules={roomRules}
          isLeader={Boolean(isLeader)}
          isUpdating={isRulesUpdating}
          serverError={roomRulesError}
          onSave={handleSaveRules}
        />
      </div>
    );
  }

  return (
    // Add a responsive right padding when the desktop chat is open so the main
    // application content (top bar, lobby/game area, etc.) is "pushed" left
    // instead of being overlapped by the fixed chat panel.
    <div
      className={`flex h-[100svh] w-screen flex-col bg-gradient-to-br from-indigo-950 to-purple-900 text-white transition-all duration-300 ease-in-out ${
        isChatOpen ? 'md:pr-96' : 'md:pr-0'
      }`}
    >
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black"
      >
        Skip to main content
      </a>

      {/* Top bar */}
      <header className="relative flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 shadow-sm backdrop-blur-sm">
        {/* Accessible page title for screen readers */}
        <h1 id="page-title" className="sr-only">
          {roomName ?? `Word Bomb Room ${roomCode}`}
        </h1>

        {/* Copy invite link */}
        <div className="flex translate-y-1 items-center gap-3">
          <button
            onClick={() => {
              setInviteCopied(true);
              if (inviteTimerRef.current) {
                clearTimeout(inviteTimerRef.current);
              }
              inviteTimerRef.current = window.setTimeout(() => {
                setInviteCopied(false);
                inviteTimerRef.current = null;
              }, 2000);

              void navigator.clipboard
                .writeText(window.location.href)
                .catch(() => undefined);
            }}
            className="flex h-9 cursor-copy items-center gap-2 rounded-md bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95"
            title="Click to copy room link"
            aria-label={
              roomName
                ? `Copy room invite link for ${roomName}`
                : `Copy room invite link for Room ${roomCode}`
            }
          >
            <FaLink className="h-4 w-4 text-white/80" />
            {inviteCopied ? 'Copied!' : `Room ${roomCode}`}
          </button>
        </div>

        {/* Chat Toggle – square arrow in top-right of top bar (desktop only) */}
        <div className="hidden items-center md:flex">
          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen);
            }}
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/10 text-white shadow-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95"
            aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
            aria-controls="desktop-chat-panel"
            aria-expanded={isChatOpen}
            data-testid="chat-toggle-top"
          >
            {isChatOpen ? (
              <FaChevronRight className="h-4 w-4" />
            ) : (
              <FaChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {visualState === 'playing' && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
            <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-sm text-indigo-200 shadow-sm">
              {formattedElapsed}
            </span>
          </div>
        )}
      </header>

      {/* Main Area */}
      <main
        id="main-content"
        className={`pb-safe relative flex-1 overflow-hidden transition-all duration-300 ${
          visualState === 'playing' ? 'flex' : ''
        }`}
        role="main"
        aria-live="polite"
      >
        {/* Active Game */}
        {visualState === 'playing' && gameState && (
          <div className="flex h-full w-full">
            <div className="flex h-full w-full">
              <GameBoard
                gameState={gameState}
                inputWord={inputWord}
                setInputWord={handleInputChange}
                handleSubmitWord={handleSubmitWord}
                bombCountdown={bombCountdown}
                rejected={rejected}
                liveInputs={liveInputs}
                lastWordAcceptedBy={lastWordAcceptedBy}
                lastSubmittedWords={lastSubmittedWords}
              />
            </div>
          </div>
        )}

        {/* Lobby with Optional Winner */}
        {visualState !== 'playing' && (
          <div className="flex min-h-[100svh] flex-col items-center justify-center px-4 text-center">
            {winner && (
              <div className="animate-winner-fade-in mb-10 flex flex-col items-center">
                <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur-sm transition-all">
                  {/* Avatar */}
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-pink-600 text-3xl font-bold text-white shadow-md">
                    {winner.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + Medal */}
                  <div className="sheen-wrapper relative inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 px-4 py-2 font-semibold text-white shadow-lg">
                    <span className="relative z-10">{winner.name} 🥇</span>
                  </div>

                  {/* Subtext */}
                  <p className="mt-2 text-lg text-indigo-200">
                    won the last round!
                  </p>

                  {/*  For screen readers */}
                  <div role="status" aria-live="polite" className="sr-only">
                    {winner.name} won the last round
                  </div>
                </div>
              </div>
            )}

            {/* Lobby Card */}
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg backdrop-blur-sm">
              <div className="mb-6 flex flex-col gap-4 text-left sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold leading-relaxed text-white md:text-3xl">
                    <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                      {roomName ?? `Room ${roomCode}`}
                    </span>
                  </h2>
                  {hasServerRules && (
                    <p className="mt-2 text-sm text-indigo-200/80 sm:text-left">
                      Lives {roomRules.startingLives}/{roomRules.maxLives} • WPP
                      ≥ {roomRules.minWordsPerPrompt} • Min turn{' '}
                      {roomRules.minTurnDuration}s
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsRulesOpen(true);
                  }}
                  className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-indigo-900"
                >
                  {isLeader ? 'Edit room rules' : 'View room rules'}
                </button>
              </div>

              {/* Countdown / Waiting Status (fixed height to avoid vertical shift; no placeholder so text stays centered) */}
              <div className="mb-8 text-lg leading-relaxed text-indigo-200">
                {timeLeftSec > 0 ? (
                  <div className="flex h-12 items-center justify-center gap-3">
                    <span>Game starts in {timeLeftSec} seconds...</span>
                    {leaderId && playerId === leaderId && (
                      <button
                        onClick={startGame}
                        className="rounded-md bg-emerald-500 px-4 py-1.5 text-base font-medium text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900"
                        data-testid="start-now-btn"
                        aria-label="Start game now"
                      >
                        Start now
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex h-12 items-center justify-center">
                    Waiting for players to join the game
                  </div>
                )}
              </div>

              {/* Seated Players */}
              <div className="mb-8">
                <h3 className="mb-4 text-lg font-medium text-indigo-100">
                  Players
                </h3>
                <div
                  className="flex max-w-full flex-wrap justify-center gap-3 px-6"
                  role="list"
                  aria-label="Players in room"
                >
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-full border px-4 py-1.5 text-base font-medium transition-all ${
                        p.isSeated
                          ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300'
                          : 'border-white/30 text-white/60'
                      }`}
                      role="listitem"
                    >
                      <span className="flex items-center">
                        <span
                          className="mr-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-700"
                          aria-hidden="true"
                        >
                          <span className="text-xs text-white">
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                        </span>
                        {p.name}{' '}
                        {p.id === leaderId && (
                          <span className="ml-1" aria-label="Game leader">
                            👑
                          </span>
                        )}{' '}
                        {p.isSeated && (
                          <span className="ml-1" aria-label="Seated">
                            ✓
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Game Instructions (only shown when no winner) */}
              {!winner && (
                <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm">
                  <h3 className="mb-3 text-lg font-medium text-indigo-100">
                    How to Play
                  </h3>
                  <ul className="list-disc space-y-2 pl-5 text-left text-base leading-relaxed text-indigo-200">
                    <li>
                      Take turns creating words containing the given pattern
                    </li>
                    <li>Think fast! The bomb timer gets shorter each round</li>
                    <li>Words must be valid and not used previously</li>
                    <li>Last player standing wins the game</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      {/* Join Game Bar – desktop only */}
      {visualState !== 'playing' && (
        <div className="z-10 hidden w-full justify-center gap-4 border-t border-white/10 bg-white/5 py-4 shadow-inner backdrop-blur-sm md:flex">
          <JoinGameButtons />
        </div>
      )}

      {/* Chat Panel – desktop only*/}
      <aside
        className={`fixed right-0 top-0 z-40 hidden h-[100dvh] w-96 flex-col border-l border-white/10 bg-white/5 shadow-lg backdrop-blur-sm transition-transform duration-300 ease-in-out md:flex ${
          isChatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        id="desktop-chat-panel"
        aria-hidden={!isChatOpen}
        aria-labelledby="desktop-chat-heading"
        role="complementary"
      >
        <Chat
          roomCode={roomCode}
          roomName={roomName}
          headingId="desktop-chat-heading"
          autoFocus={isChatOpen}
          stats={playerStats}
          showStats
          /* Avoid nested complementary landmarks inside the aside */
          regionRole="region"
        />
      </aside>

      {/* Removed old desktop floating chat toggle; unified control is in top bar */}
      <RoomRulesDialog
        open={isRulesOpen}
        onClose={() => {
          setIsRulesOpen(false);
        }}
        rules={roomRules}
        isLeader={Boolean(isLeader)}
        isUpdating={isRulesUpdating}
        serverError={roomRulesError}
        onSave={handleSaveRules}
      />
    </div>
  );
}
