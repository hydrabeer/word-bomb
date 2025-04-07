import { useState, useEffect, useCallback } from "react";
import { socket } from "../socket";

type GameStatus = "lobby" | "countdown" | "inGame";

export default function GameArea() {
  // Track the game state: lobby, countdown, or in-game.
  const [gameStatus, setGameStatus] = useState<GameStatus>("lobby");
  const [countdown, setCountdown] = useState<number>(15);

  // Listen for game events from the server.
  useEffect(() => {
    const handleLobbyUpdate = () => {
      setGameStatus("lobby");
    };

    const handleCountdownUpdate = (data: { countdown: number }) => {
      setCountdown(data.countdown);
      setGameStatus("countdown");
    };

    const handleGameStart = () => {
      setGameStatus("inGame");
    };

    socket.on("lobbyUpdate", handleLobbyUpdate);
    socket.on("countdownUpdate", handleCountdownUpdate);
    socket.on("gameStart", handleGameStart);

    return () => {
      socket.off("lobbyUpdate", handleLobbyUpdate);
      socket.off("countdownUpdate", handleCountdownUpdate);
      socket.off("gameStart", handleGameStart);
    };
  }, []);

  // Handler for when a spectator clicks "Join Game".
  const handleJoinGame = useCallback(() => {
    socket.emit("joinGame");
    // After joining, the server should update the game state.
  }, []);

  // Handler for clicking "Start Now" (for active players to force an early start).
  const handleStartNow = useCallback(() => {
    socket.emit("startNow");
  }, []);

  return (
    <div className="p-4">
      {gameStatus === "lobby" && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Lobby</h2>
          <p className="mb-4">
            You are spectating. When enough players are present, the game will
            start soon.
          </p>
          <button
            onClick={handleJoinGame}
            className="bg-green-600 hover:bg-green-500 transition-colors px-4 py-2 rounded font-semibold"
          >
            Join Game
          </button>
        </div>
      )}
      {gameStatus === "countdown" && (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Game Starting Soon</h2>
          <p className="text-lg mb-2">Starting in: {countdown} seconds</p>
          <p
            className="underline cursor-pointer text-blue-400 mb-4"
            onClick={handleStartNow}
          >
            Start Now
          </p>
        </div>
      )}
      {gameStatus === "inGame" && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Game In Progress</h2>
          {/* Insert your game UI here */}
          <p>Game is now active. Good luck!</p>
        </div>
      )}
    </div>
  );
}
