// apps/frontend/src/pages/RoomPage.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaChevronRight,
  FaChevronLeft,
  FaChevronUp,
  FaChevronDown,
} from "react-icons/fa";
import Chat from "../components/Chat";
import { useGameRoom } from "../hooks/useGameRoom";
import { socket } from "../socket";
import { GameBoard, GameState } from "../components/GameBoard";
import { getOrCreatePlayerProfile } from "../utils/playerProfile";

export default function RoomPage() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inputWord, setInputWord] = useState("");
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [countdownDeadline, setCountdownDeadline] = useState<number | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const { id: playerId, name: playerName } = getOrCreatePlayerProfile();
  const [players, setPlayers] = useState<{
    id: string,
    name: string,
    isSeated: boolean
  }[]>([]);
  const me = useMemo(() => players.find((p) => p.id === playerId), [players, playerId]);

  useEffect(() => {
    function handlePlayersUpdated(data: any) {
      setPlayers(data.players);
    }

    socket.on("playersUpdated", handlePlayersUpdated);
    return () => {
      socket.off("playersUpdated", handlePlayersUpdated);
    };
  }, []);

  useEffect(() => {
    if (!roomCode) {
      void navigate("/");
      return;
    }
  }, [roomCode, navigate, playerId, playerName]);

  useGameRoom(roomCode!);

  useEffect(() => {
    function handleGameCountdownStarted(data: any) {
      setCountdownDeadline(data.deadline);
    }

    function handleGameCountdownStopped() {
      setCountdownDeadline(null);
      setTimeLeftSec(0);
    }

    function handleGameStarted(data: any) {
      setGameState({
        fragment: data.fragment,
        bombDuration: data.bombDuration,
        currentPlayerId: data.currentPlayer,
        players: data.players,
      });
      setLeaderId(data.leaderId || null);
      setCountdownDeadline(null);
    }

    function handleTurnStarted(data: any) {
      setGameState((prev) =>
        prev
          ? {
            ...prev,
            fragment: data.fragment,
            bombDuration: data.bombDuration,
            currentPlayerId: data.playerId,
            players: data.players || prev.players,
          }
          : null
      );
    }

    function handlePlayerUpdated(data: any) {
      setGameState((prev) => {
        if (!prev) return prev;
        const updatedPlayers = prev.players.map((p) =>
          p.id === data.playerId
            ? { ...p, lives: data.lives, isEliminated: data.lives <= 0 }
            : p
        );
        return { ...prev, players: updatedPlayers };
      });
    }

    socket.on("gameCountdownStarted", handleGameCountdownStarted);
    socket.on("gameCountdownStopped", handleGameCountdownStopped);
    socket.on("gameStarted", handleGameStarted);
    socket.on("turnStarted", handleTurnStarted);
    socket.on("playerUpdated", handlePlayerUpdated);

    return () => {
      socket.off("gameCountdownStarted", handleGameCountdownStarted);
      socket.off("gameCountdownStopped", handleGameCountdownStopped);
      socket.off("gameStarted", handleGameStarted);
      socket.off("turnStarted", handleTurnStarted);
      socket.off("playerUpdated", handlePlayerUpdated);
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

  const handleSubmitWord = useCallback(() => {
    socket.emit(
      "submitWord",
      { roomCode, playerId, word: inputWord },
      (res: any) => {
        if (res.success) setInputWord("");
        else console.log(res.error);
      }
    );
  }, [roomCode, playerId, inputWord]);

  const handleStartGame = useCallback(() => {
    socket.emit("startGame", { roomCode }, (res: any) => {
      if (!res.success) console.log(res.error);
    });
  }, [roomCode]);

  const toggleSeated = useCallback(() => {
    const seated = !(me?.isSeated ?? false);
    socket.emit(
      "setPlayerSeated",
      { roomCode, playerId, seated },
      (res: any) => {
        if (res && !res.success) console.log("setPlayerSeated error:", res.error);
      }
    );
  }, [roomCode, playerId, me?.isSeated]);

  useEffect(() => {
    const handleDisconnect = () => {
      void navigate("/disconnected");
    };
    window.addEventListener("offline", handleDisconnect);
    return () => window.removeEventListener("offline", handleDisconnect);
  }, [navigate]);

  const statusMessage = gameState
    ? "🧠 Word Bomb – Game in Progress"
    : countdownDeadline !== null
      ? `⏳ Game starts in ${timeLeftSec}s...`
      : "🕐 Waiting for more players...";

  return (
    <div
      className="flex flex-col h-screen w-screen bg-[#12101C] text-white overflow-hidden">

      {/* Top Bar */}
      <div
        className="relative flex items-center justify-center px-4 py-2 bg-gradient-to-r from-[#2D1C5A] to-[#3C1C80] text-sm md:text-base font-medium">
        <div className="truncate">{statusMessage}</div>

        {/* Chat Toggle Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`
            z-50 p-2 rounded-full transition-colors bg-white/10 hover:bg-white/20
            md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2
      
            fixed right-4
            ${isChatOpen ? "bottom-[calc(33vh+1.4rem)]" : "bottom-5"}
            md:bottom-auto
          `}
          aria-label={isChatOpen ? "Close chat" : "Open chat"}
        >
          <span className="block md:hidden">
            {isChatOpen ? <FaChevronDown/> : <FaChevronUp/>}
          </span>
          <span className="hidden md:block">
            {isChatOpen ? <FaChevronRight/> : <FaChevronLeft/>}
          </span>
        </button>
      </div>


      {/* Main Area */}
      <div
        className={`flex-1 overflow-y-auto transition-all duration-300 ${isChatOpen ? "pb-[33vh] md:pb-0" : ""}`}>
        {gameState ? (
          <GameBoard
            gameState={gameState}
            inputWord={inputWord}
            setInputWord={setInputWord}
            handleSubmitWord={handleSubmitWord}
          />
        ) : (
          <div
            className="flex flex-col justify-center items-center h-full text-center px-4">
            <p className="text-xl md:text-2xl font-semibold text-white/90 mb-6">
              Waiting for game to start...
            </p>

            {/* Seated Players */}
            <div className="flex justify-center">
              <div
                className="flex flex-wrap gap-3 justify-center px-6 max-w-lg">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all
                  ${p.isSeated
                      ? "border-emerald-400 bg-emerald-900/30 text-emerald-300"
                      : "border-white/30 text-white/60"
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

      {/* Bottom Bar */}
      {!gameState && (
        <div
          className="bg-[#1A1828] border-t border-[#3F3C58] shadow-inner w-full py-4 flex justify-center gap-4 z-10">
          <button
            onClick={toggleSeated}
            className={`
          font-bold px-6 py-2 rounded-lg transition-colors
          ${me?.isSeated
              ? "bg-rose-500 hover:bg-rose-400 text-white"
              : "bg-emerald-500 hover:bg-emerald-400 text-black"}
        `}
          >
            {me?.isSeated ? "Leave" : "Join Game"}
          </button>
          {leaderId && playerId === leaderId && (
            <button
              onClick={handleStartGame}
              className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-2 rounded-lg transition-colors"
            >
              Start Now
            </button>
          )}
        </div>
      )}

      {/* Chat Panel */}
      {isChatOpen && (
        <div
          className={`
        bg-[#1A1828] z-40
        md:fixed md:top-0 md:right-0 md:h-full md:w-80
        h-[33vh] md:border-l border-t md:border-t-0 border-[#3F3C58]
        shadow-[0_0_10px_#00000033] flex flex-col
      `}
        >
          <Chat roomCode={roomCode!}/>
        </div>
      )}
    </div>
  );
}
