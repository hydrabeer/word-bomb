// apps/frontend/src/pages/RoomPage.tsx
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

  const statusMessage = gameState
    ? `🧠 Word Bomb – ${Math.floor(elapsedGameTime / 60)
        .toString()
        .padStart(2, '0')}:${(elapsedGameTime % 60).toString().padStart(2, '0')}`
    : timeLeftSec > 0
      ? `⏳ Game starts in ${timeLeftSec}s...`
      : '🕐 Waiting for more players...';

  function JoinGameButtons() {
    return (
      <button
        onClick={toggleSeated}
        className={`rounded-lg px-6 py-2 font-bold transition-colors ${
          me?.isSeated
            ? 'bg-rose-500 text-white hover:bg-rose-400'
            : 'bg-emerald-500 text-black hover:bg-emerald-400'
        }`}
      >
        {me?.isSeated ? 'Leave' : 'Join Game'}
      </button>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-900 text-white">
      {/* Top Bar */}
      <div className="relative flex items-center justify-center bg-gradient-to-r from-indigo-800 to-purple-800 px-4 py-2 text-sm font-medium md:text-base">
        <div className="truncate">
          {statusMessage}
          {leaderId && playerId === leaderId && timeLeftSec > 0 && (
            <button
              onClick={startGame}
              className="ml-2 text-white/80 underline transition-colors hover:text-white"
            >
              Start now
            </button>
          )}
        </div>
        {/* Chat Toggle Button – desktop */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="z-50 hidden rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 md:absolute md:right-4 md:top-1/2 md:flex md:-translate-y-1/2"
          aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
        >
          {isChatOpen ? <FaChevronRight /> : <FaChevronLeft />}
        </button>
      </div>

      {/* Main Area */}
      <div
        className={`flex-1 overflow-y-auto transition-all duration-300 ${isChatOpen ? 'pb-[33vh] md:pb-0' : ''}`}
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
            <p className="mb-6 text-xl font-semibold text-white/90 md:text-2xl">
              Waiting for game to start...
            </p>

            {/* Seated Players */}
            <div className="flex justify-center">
              <div className="flex max-w-lg flex-wrap justify-center gap-3 px-6">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                      p.isSeated
                        ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300'
                        : 'border-white/30 text-white/60'
                    }`}
                  >
                    {p.name} {p.isSeated && <span className="ml-1">✓</span>}
                  </div>
                ))}
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
          <div className="relative flex w-full justify-center gap-4 border-t border-gray-700 bg-gray-800 py-4 shadow-inner">
            <JoinGameButtons />

            {/* Chat Toggle Button – mobile */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
              aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
            >
              {isChatOpen ? <FaChevronDown /> : <FaChevronUp />}
            </button>
          </div>

          {/* 💬 Chat Panel – mobile */}
          <div className="h-[33vh] border-t border-gray-700 bg-gray-800 shadow-[0_0_10px_#00000033]">
            <Chat roomCode={roomCode} />
          </div>
        </div>
      )}

      {/* Join Game Bar – desktop only */}
      {!gameState && (
        <div className="z-10 hidden w-full justify-center gap-4 border-t border-gray-700 bg-gray-800 py-4 shadow-inner md:flex">
          <JoinGameButtons />
        </div>
      )}

      {/* Chat Panel – desktop only*/}
      <div
        className={`z-40 hidden transition-transform duration-300 ease-in-out md:fixed md:right-0 md:top-0 md:flex md:h-full md:w-80 md:flex-col md:border-l md:border-gray-700 md:bg-gray-800 md:shadow-[0_0_10px_#00000033] ${isChatOpen ? 'translate-x-0' : 'translate-x-full'} `}
      >
        <Chat roomCode={roomCode} />
      </div>
    </div>
  );
}
