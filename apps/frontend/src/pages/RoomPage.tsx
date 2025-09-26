import { useEffect, useState, useMemo } from 'react';
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

export default function RoomPage() {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const [isChatOpen, setIsChatOpen] = useState(true);
  const isMobile = useIsMobile();
  const [inviteCopied, setInviteCopied] = useState(false);

  // Custom hooks (order matters!): we must attach all socket listeners BEFORE
  // emitting joinRoom, otherwise on a page reload while a game is active the
  // server's immediate gameStarted/turnStarted snapshot can arrive before our
  // listeners are registered, leaving us stuck in the lobby view. So we call
  // the state/listener hooks first, then join the room last.
  const {
    gameState,
    timeLeftSec,
    bombCountdown,
    elapsedGameTime,
    liveInputs,
    lastSubmittedWords,
    lastWordAcceptedBy,
    winnerId,
    updateLiveInput,
  } = useGameState(roomCode);

  const { players, leaderId, playerId, me, toggleSeated, startGame } =
    usePlayerManagement(roomCode);

  // Join room AFTER listeners above are wired.
  useGameRoom(roomCode);

  const { inputWord, setInputWord, rejected, handleSubmitWord } =
    useWordSubmission(roomCode, playerId);

  useEffect(() => {
    setInputWord('');
  }, [gameState, setInputWord]);

  const seatedCount = useMemo(
    () => players.reduce((acc, p) => acc + (p.isSeated ? 1 : 0), 0),
    [players],
  );
  const visualState = useVisualState({ seatedCount, gameState });

  const winner = players.find((p) => p.id === winnerId);

  // Handle navigation if no room code
  useEffect(() => {
    if (!roomCode) {
      void navigate('/');
    }
  }, [roomCode, navigate]);

  // (Removed in favor of useIsMobile hook)

  // Centralized socket disconnect navigation (also handles network loss indirectly)
  useSocketConnection();

  // Handle input change with typing update
  const handleInputChange = (value: string) => {
    setInputWord(value);
    if (gameState?.currentPlayerId === playerId) {
      updateLiveInput(playerId, value);
    }
  };

  const formattedElapsed = formatDurationSeconds(elapsedGameTime);

  function JoinGameButtons() {
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
        }`}
        aria-label={me?.isSeated ? 'Leave game' : 'Join game'}
      >
        {me?.isSeated ? 'Leave Game' : 'Join Game'}
      </button>
    );
  }

  return (
    // Add a responsive right padding when the desktop chat is open so the main
    // application content (top bar, lobby/game area, etc.) is "pushed" left
    // instead of being overlapped by the fixed chat panel.
    <div
      className={`flex h-[100svh] w-screen flex-col bg-gradient-to-br from-indigo-950 to-purple-900 text-white transition-all duration-300 ease-in-out ${
        !isMobile ? (isChatOpen ? 'md:pr-96' : 'md:pr-0') : ''
      }`}
    >
      {/* Top Bar */}
      <div className="relative flex -translate-y-[7px] items-center justify-between border-b border-white/10 bg-gradient-to-r from-indigo-800/70 to-purple-800/70 p-3 text-base text-white backdrop-blur-sm">
        <div className="flex translate-y-1 items-center gap-3">
          <button
            onClick={() => {
              void navigator.clipboard
                .writeText(window.location.href)
                .then(() => {
                  setInviteCopied(true);
                  setTimeout(() => setInviteCopied(false), 2000);
                });
            }}
            className="flex h-9 cursor-copy items-center gap-2 rounded-md bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95"
            title="Click to copy room link"
          >
            <FaLink className="h-4 w-4 text-white/80" />
            {inviteCopied ? 'Copied!' : `Room ${roomCode}`}
          </button>
        </div>

        {visualState === 'playing' && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
            <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-sm text-indigo-200 shadow-sm">
              {formattedElapsed}
            </span>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div
        className={`relative flex-1 transition-all duration-300 ${
          // Desktop: always hide scroll; Mobile: allow scroll only during game
          isMobile
            ? visualState !== 'playing'
              ? 'overflow-hidden'
              : 'overflow-y-auto'
            : 'overflow-hidden'
        } ${
          // Extra bottom padding only needed on mobile when chat open
          isChatOpen && isMobile ? 'pb-[33vh] md:pb-0' : 'pb-safe'
        } ${
          // When playing on desktop, center contents
          !isMobile && visualState === 'playing' ? 'flex' : ''
        }`}
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
          <div
            className={`flex min-h-[100svh] flex-col items-center justify-center px-4 text-center ${
              // Move panel slightly up on mobile for better visual centering with bottom bar
              isMobile ? '-mt-8 pb-20' : ''
            }`}
          >
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
              <h2 className="mb-6 text-2xl font-semibold leading-relaxed text-white md:text-3xl">
                Room{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  {roomCode}
                </span>
              </h2>

              {/* Countdown / Waiting Status (fixed height to avoid vertical shift; no placeholder so text stays centered) */}
              <div className="mb-8 text-lg leading-relaxed text-indigo-200">
                {timeLeftSec > 0 ? (
                  <div className="flex h-12 items-center justify-center gap-3">
                    <span>Game starts in {timeLeftSec} seconds...</span>
                    {leaderId && playerId === leaderId && (
                      <button
                        onClick={startGame}
                        className="rounded-md bg-emerald-500 px-4 py-1.5 text-base font-medium text-black shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900"
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
      </div>

      {/* Bottom Join + Chat container (mobile only) */}
      {visualState !== 'playing' && (
        <div
          className={`fixed bottom-0 left-0 z-40 w-full transform transition-transform duration-300 ease-in-out md:hidden ${
            isChatOpen ? 'translate-y-0' : 'translate-y-[calc(33vh-0.25rem)]'
          }`}
        >
          {/* 🔘 Join Game Bar – mobile */}
          <div className="relative flex w-full justify-center gap-4 border-t border-white/10 bg-white/5 py-4 shadow-inner backdrop-blur-sm">
            <JoinGameButtons />

            {/* Chat Toggle Button – mobile */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 focus:ring-2 focus:ring-emerald-400"
              aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
            >
              {isChatOpen ? (
                <FaChevronDown className="h-4 w-4" />
              ) : (
                <FaChevronUp className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* 💬 Chat Panel – mobile */}
          <div className="h-[33vh] border-t border-white/10 bg-white/5 shadow-lg backdrop-blur-sm">
            <Chat roomCode={roomCode} />
          </div>
        </div>
      )}

      {/* Join Game Bar – desktop only */}
      {visualState !== 'playing' && (
        <div className="z-10 hidden w-full justify-center gap-4 border-t border-white/10 bg-white/5 py-4 shadow-inner backdrop-blur-sm md:flex">
          <JoinGameButtons />
        </div>
      )}

      {/* Chat Panel – desktop only*/}
      <div
        className={`fixed right-0 top-0 z-40 hidden h-[100dvh] w-96 flex-col border-l border-white/10 bg-white/5 shadow-lg backdrop-blur-sm transition-transform duration-300 ease-in-out md:flex ${
          isChatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <Chat roomCode={roomCode} />
      </div>

      {/* Chat Toggle Button - desktop, with improved design */}
      <div
        className={`fixed z-40 hidden transition-all duration-300 ease-in-out md:block ${
          isChatOpen ? 'right-96' : 'right-0'
        }`}
        style={{
          top: 'calc(50% - 36px)',
        }}
      >
        <button
          onClick={() => {
            setIsChatOpen(!isChatOpen);
          }}
          className={`group flex h-16 w-6 items-center justify-center rounded-l-md border-b border-l border-t border-white/10 backdrop-blur-sm transition-all duration-300 ${
            isChatOpen
              ? 'bg-gradient-to-br from-indigo-800/70 to-purple-800/70 hover:from-indigo-700/70 hover:to-purple-700/70'
              : 'bg-white/5 hover:bg-white/10'
          } focus:outline-none`}
          aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
        >
          <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden">
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                isChatOpen ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <FaChevronRight className="h-3 w-3 text-white/80 transition-all group-hover:text-white" />
            </div>
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                isChatOpen ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <FaChevronLeft className="h-3 w-3 text-white/80 transition-all group-hover:text-white" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
