// apps/frontend/src/pages/RoomPage.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaChevronRight, FaChevronLeft, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import Chat from '../components/Chat';
import { useGameRoom } from '../hooks/useGameRoom';
import { socket } from '../socket';
import { GameBoard, GameState } from '../components/GameBoard';
import { getOrCreatePlayerProfile } from '../utils/playerProfile';
import type {
  GameCountdownStartedPayload,
  GameStartedPayload,
  PlayersUpdatedPayload,
  TurnStartedPayload,
  PlayerUpdatedPayload,
} from '@game/domain/socket/types';

export default function RoomPage() {
  const navigate = useNavigate();
  const { roomCode } = useParams<{ roomCode: string }>();

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inputWord, setInputWord] = useState('');
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [players, setPlayers] = useState<
    {
      id: string;
      name: string;
      isSeated: boolean;
    }[]
  >([]);

  const [countdownDeadline, setCountdownDeadline] = useState<number | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);

  const [turnDeadline, setTurnDeadline] = useState<number | null>(null);
  const [bombCountdown, setBombCountdown] = useState<number>(0);
  const [liveInputs, setLiveInputs] = useState<Record<string, string>>({});
  const [rejected, setRejected] = useState(false);

  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [elapsedGameTime, setElapsedGameTime] = useState<number>(0);

  const { id: playerId, name: playerName } = getOrCreatePlayerProfile();
  const me = useMemo(() => players.find((p) => p.id === playerId), [players, playerId]);

  if (!roomCode) {
    throw new Error('roomCode missing from URL');
  }
  useGameRoom(roomCode);

  useEffect(() => {
    function handlePlayersUpdated(data: PlayersUpdatedPayload) {
      setPlayers(data.players);
    }

    socket.on('playersUpdated', handlePlayersUpdated);
    return () => {
      socket.off('playersUpdated', handlePlayersUpdated);
    };
  }, []);

  useEffect(() => {
    if (!roomCode) {
      void navigate('/');
      return;
    }
  }, [roomCode, navigate, playerId, playerName]);

  useEffect(() => {
    function handleGameCountdownStarted(data: GameCountdownStartedPayload) {
      setCountdownDeadline(data.deadline);
    }

    function handleGameCountdownStopped() {
      setCountdownDeadline(null);
      setTimeLeftSec(0);
    }

    function handleGameStarted(data: GameStartedPayload) {
      setGameState({
        fragment: data.fragment,
        bombDuration: data.bombDuration,
        currentPlayerId: data.currentPlayer,
        players: data.players,
      });
      setLeaderId(data.leaderId || null);
      setCountdownDeadline(null);
      setGameStartedAt(Date.now());
    }

    function handleTurnStarted(data: TurnStartedPayload) {
      const newDeadline = Date.now() + data.bombDuration * 1000;
      setTurnDeadline(newDeadline);

      setLiveInputs({}); // 👈 clear previous inputs

      setGameState((prev) =>
        prev
          ? {
              ...prev,
              fragment: data.fragment,
              bombDuration: data.bombDuration,
              currentPlayerId: data.playerId,
              players: data.players || prev.players,
            }
          : null,
      );
    }

    function handlePlayerTypingUpdate(data: { playerId: string; input: string }) {
      setLiveInputs((prev) => ({
        ...prev,
        [data.playerId]: data.input,
      }));
    }

    function handlePlayerUpdated(data: PlayerUpdatedPayload) {
      setGameState((prev) => {
        if (!prev) return prev;
        const updatedPlayers = prev.players.map((p) =>
          p.id === data.playerId ? { ...p, lives: data.lives, isEliminated: data.lives <= 0 } : p,
        );
        return { ...prev, players: updatedPlayers };
      });
    }

    socket.on('gameCountdownStarted', handleGameCountdownStarted);
    socket.on('gameCountdownStopped', handleGameCountdownStopped);
    socket.on('gameStarted', handleGameStarted);
    socket.on('turnStarted', handleTurnStarted);
    socket.on('playerTypingUpdate', handlePlayerTypingUpdate);
    socket.on('playerUpdated', handlePlayerUpdated);

    return () => {
      socket.off('gameCountdownStarted', handleGameCountdownStarted);
      socket.off('gameCountdownStopped', handleGameCountdownStopped);
      socket.off('gameStarted', handleGameStarted);
      socket.off('turnStarted', handleTurnStarted);
      socket.off('playerTypingUpdate', handlePlayerTypingUpdate);
      socket.off('playerUpdated', handlePlayerUpdated);
    };
  }, []);

  useEffect(() => {
    if (countdownDeadline == null) {
      setTimeLeftSec(0);
      return;
    }
    const timer = setInterval(() => {
      const diff = countdownDeadline - Date.now();
      if (diff <= 0) {
        setCountdownDeadline(null);
        setTimeLeftSec(0);
        clearInterval(timer);
      } else {
        setTimeLeftSec(Math.ceil(diff / 1000));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [countdownDeadline]);

  useEffect(() => {
    if (!gameStartedAt) return;

    const interval = setInterval(() => {
      setElapsedGameTime(Math.floor((Date.now() - gameStartedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStartedAt]);

  useEffect(() => {
    if (!turnDeadline) return;
    const interval = setInterval(() => {
      const left = Math.ceil((turnDeadline - Date.now()) / 1000);
      setBombCountdown(Math.max(left, 0));
    }, 250);
    return () => clearInterval(interval);
  }, [turnDeadline]);

  const handleStartGame = useCallback(() => {
    socket.emit('startGame', { roomCode }, (res) => {
      if (!res.success) console.log(res.error);
    });
  }, [roomCode]);

  const toggleSeated = useCallback(() => {
    const seated = !(me?.isSeated ?? false);
    socket.emit('setPlayerSeated', { roomCode, playerId, seated }, (res) => {
      if (res && !res.success) console.log('setPlayerSeated error:', res.error);
    });
  }, [roomCode, playerId, me?.isSeated]);

  const handleInputChange = (value: string) => {
    setInputWord(value);

    if (gameState?.currentPlayerId === playerId) {
      socket.emit('playerTyping', { roomCode, playerId, input: value });
    }
  };

  const handleSubmitWord = useCallback(() => {
    socket.emit('submitWord', { roomCode, playerId, word: inputWord }, (res) => {
      if (res.success) {
        setInputWord('');
      } else {
        setRejected(true);
        setTimeout(() => setRejected(false), 300);
        setInputWord('');
      }
    });
  }, [roomCode, playerId, inputWord]);

  useEffect(() => {
    const handleDisconnect = () => {
      void navigate('/disconnected');
    };
    window.addEventListener('offline', handleDisconnect);
    return () => window.removeEventListener('offline', handleDisconnect);
  }, [navigate]);

  useEffect(() => {
    const handleGameEnded = () => {
      setGameStartedAt(null);
      setElapsedGameTime(0);
    };

    socket.on('gameEnded', handleGameEnded);

    return () => {
      socket.off('gameEnded', handleGameEnded);
    };
  }, []);

  const statusMessage = gameState
    ? `🧠 Word Bomb – ${Math.floor(elapsedGameTime / 60)
        .toString()
        .padStart(2, '0')}:${(elapsedGameTime % 60).toString().padStart(2, '0')}`
    : countdownDeadline !== null
      ? `⏳ Game starts in ${timeLeftSec}s...`
      : '🕐 Waiting for more players...';

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-900 text-white">
      {/* Top Bar */}
      <div className="relative flex items-center justify-center bg-gradient-to-r from-indigo-800 to-purple-800 px-4 py-2 text-sm font-medium md:text-base">
        <div className="truncate">{statusMessage}</div>

        {/* Chat Toggle Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`fixed right-4 z-50 rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2 ${isChatOpen ? 'bottom-[calc(33vh+1.4rem)]' : 'bottom-5'} md:bottom-auto`}
          aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
        >
          <span className="block md:hidden">
            {isChatOpen ? <FaChevronDown /> : <FaChevronUp />}
          </span>
          <span className="hidden md:block">
            {isChatOpen ? <FaChevronRight /> : <FaChevronLeft />}
          </span>
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

      {/* Bottom Bar (Join/Start) */}
      {!gameState && (
        <div className="z-10 flex w-full justify-center gap-4 border-t border-gray-700 bg-gray-800 py-4 shadow-inner">
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
          {leaderId && playerId === leaderId && (
            <button
              onClick={handleStartGame}
              className="rounded-lg bg-yellow-400 px-6 py-2 font-bold text-black transition-colors hover:bg-yellow-300"
            >
              Start Now
            </button>
          )}
        </div>
      )}

      {/* Chat Panel */}
      <div
        className={`z-40 flex h-[33vh] flex-col border-t border-gray-700 bg-gray-800 shadow-[0_0_10px_#00000033] transition-opacity duration-200 md:fixed md:right-0 md:top-0 md:h-full md:w-80 md:border-l md:border-t-0 ${
          isChatOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <Chat roomCode={roomCode} />
      </div>
    </div>
  );
}
