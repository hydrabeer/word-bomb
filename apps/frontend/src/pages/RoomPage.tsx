import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaChevronRight, FaChevronLeft, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import Chat from '../components/Chat';
import { useGameRoom } from '../hooks/useGameRoom';
import { GameBoard } from '../components/GameBoard';
import { useGameState } from '../hooks/useGameState';
import { usePlayerManagement } from '../hooks/usePlayerManagement';
import { useWordSubmission } from '../hooks/useWordSubmission';

export default function RoomPage() {
  const navigate = useNavigate();
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Custom hooks
  useGameRoom(roomCode);
  const {
    gameState,
    timeLeftSec,
    bombCountdown,
    elapsedGameTime,
    liveInputs,
    lastSubmittedWords,
    lastWordAcceptedBy,
    updateLiveInput,
  } = useGameState(roomCode);

  const { players, leaderId, playerId, me, toggleSeated, startGame } =
    usePlayerManagement(roomCode);

  const { inputWord, setInputWord, rejected, handleSubmitWord } = useWordSubmission(
    roomCode,
    playerId,
  );

  // Handle navigation if no room code
  useEffect(() => {
    if (!roomCode) {
      void navigate('/');
    }
  }, [roomCode, navigate]);

  // Detect mobile screens
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on initial load
    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle disconnect
  useEffect(() => {
    const handleDisconnect = () => {
      void navigate('/disconnected');
    };
    window.addEventListener('offline', handleDisconnect);
    return () => window.removeEventListener('offline', handleDisconnect);
  }, [navigate]);

  // Handle input change with typing update
  const handleInputChange = (value: string) => {
    setInputWord(value);
    if (gameState?.currentPlayerId === playerId) {
      updateLiveInput(playerId, value);
    }
  };

  const formattedMins = Math.floor(elapsedGameTime / 60)
    .toString()
    .padStart(2, '0');
  const formattedSecs = (elapsedGameTime % 60).toString().padStart(2, '0');

  function JoinGameButtons() {
    return (
      <button
        onClick={toggleSeated}
        className={`rounded-lg px-6 py-3 font-medium shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900 active:scale-95 ${
          me?.isSeated
            ? 'border border-pink-400/20 bg-gradient-to-br from-pink-600/90 to-pink-500/90 text-white shadow-pink-500/20 backdrop-blur-sm hover:bg-pink-400/50' +
              ' active:bg-indigo-600/50'
            : 'border border-emerald-400/20 bg-gradient-to-br from-emerald-600/90 to-emerald-500/90 shadow-emerald-500/20 backdrop-blur-sm hover:bg-emerald-400' +
              ' active:bg-emerald-600'
        }`}
        aria-label={me?.isSeated ? 'Leave game' : 'Join game'}
      >
        {me?.isSeated ? 'Leave Game' : 'Join Game'}
      </button>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-br from-indigo-950 to-purple-900 text-white">
      {/* Top Bar */}
      <div className="relative flex items-center justify-between bg-gradient-to-r from-indigo-800/70 to-purple-800/70 px-4 py-3 text-base font-medium backdrop-blur-sm">
        <div className="flex items-center">
          <span className="text-lg font-medium">Room {roomCode}</span>
          {gameState && (
            <span className="ml-3 rounded-full bg-white/10 px-3 py-1 text-sm">
              {formattedMins}:{formattedSecs}
            </span>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div
        className={`flex-1 overflow-y-auto transition-all duration-300 ${isChatOpen && isMobile ? 'pb-[33vh] md:pb-0' : ''}`}
      >
        {gameState ? (
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
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg backdrop-blur-sm">
              <h2 className="mb-6 text-2xl font-semibold leading-relaxed text-white md:text-3xl">
                Room{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  {roomCode}
                </span>
              </h2>

              <p className="mb-8 text-lg leading-relaxed text-indigo-200">
                {timeLeftSec > 0 ? (
                  <span className="flex items-center justify-center gap-3">
                    Game starts in {timeLeftSec} seconds...
                    {leaderId && playerId === leaderId && (
                      <button
                        onClick={startGame}
                        className="rounded-md bg-emerald-500 px-4 py-1.5 text-base font-medium text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-900"
                        aria-label="Start game now"
                      >
                        Start now
                      </button>
                    )}
                  </span>
                ) : (
                  'Waiting for players to join the game'
                )}
              </p>

              {/* Seated Players */}
              <div className="mb-8">
                <h3 className="mb-4 text-lg font-medium text-indigo-100">Players</h3>
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

              {/* Game Instructions */}
              <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6 shadow-sm">
                <h3 className="mb-3 text-lg font-medium text-indigo-100">How to Play</h3>
                <ul className="list-disc space-y-2 pl-5 text-left text-base leading-relaxed text-indigo-200">
                  <li>Take turns creating words containing the given pattern</li>
                  <li>Think fast! The bomb timer gets shorter each round</li>
                  <li>Words must be valid and not used previously</li>
                  <li>Last player standing wins the game</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Join + Chat container (mobile only) */}
      {!gameState && (
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
      {!gameState && (
        <div className="z-10 hidden w-full justify-center gap-4 border-t border-white/10 bg-white/5 py-4 shadow-inner backdrop-blur-sm md:flex">
          <JoinGameButtons />
        </div>
      )}

      {/* Chat Panel – desktop only*/}
      <div
        className={`fixed right-0 top-0 z-40 hidden h-full w-96 flex-col border-l border-white/10 bg-white/5 shadow-lg backdrop-blur-sm transition-transform duration-300 ease-in-out md:flex ${
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
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
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
