import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { socket } from "../socket";
import { generateGuestName } from "../utils/generateGuestName.ts";
import { NamePanel } from "../components/NamePanel";
import { CreateRoomPanel } from "../components/CreateRoomPanel";
import { JoinRoomPanel } from "../components/JoinRoomPanel";

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const { roomCode: routeRoomCode } = useParams<{ roomCode?: string }>();

  useEffect(() => {
    document.title = "Word Bomb";
  }, []);

  // Ensure persistent user token is set on first load.
  useEffect(() => {
    let userToken = localStorage.getItem("userToken");
    if (!userToken) {
      userToken = uuidv4();
      localStorage.setItem("userToken", userToken);
    }
  }, []);

  // Name: default from storage or generated guest name.
  const storedName = localStorage.getItem("name") || generateGuestName();
  const [name, setName] = useState(storedName);

  // Create Room: roomName defaults to "NAME's room".
  const [roomName, setRoomName] = useState(`${name}'s room`);

  // Join Room: roomCode state.
  const [roomCode, setRoomCode] = useState("");

  // When user saves a new name, update local state and localStorage.
  const handleSaveName = (newName: string) => {
    // Validate: no more than 30 characters.
    if (!newName.match(/^.{1,30}$/)) {
      console.log("Invalid name");
      return;
    }
    setName(newName);
    localStorage.setItem("name", newName);
    // Update roomName if it still uses the default pattern.
    setRoomName(`${newName}'s room`);
  };

  // Create a new room by emitting createRoom to the server.
  const handleCreateRoom = () => {
    if (!name || !roomName) return;

    // Validate: no more than 20 characters.
    if (!roomName.match(/^.{1,20}$/)) {
      console.log("Invalid room name");
      return;
    }
    const userToken = localStorage.getItem("userToken");

    socket.connect();
    localStorage.setItem("name", name);
    socket.emit("createRoom", {
      name,
      roomName,
      userToken
    }, (newRoomCode: string) => {
      void navigate(`/${newRoomCode}`);
    });
  };

  // Join an existing room with validation.
  const handleJoinRoom = useCallback((code?: string) => {
    const joinCode = code || roomCode;
    if (!name || !joinCode) return;
    // Validate: exactly 4 alphabetic characters.
    if (!joinCode.match(/^[A-Z]{4}$/)) {
      console.log("Invalid room code");
      return;
    }
    const userToken = localStorage.getItem("userToken");

    socket.connect();
    localStorage.setItem("name", name);
    // First, check if the room exists.
    socket.emit("checkRoom", joinCode, (exists: boolean) => {
      if (!exists) {
        alert(`Room "${joinCode}" does not exist.`);
      } else {
        socket.emit("joinRoom", { name, roomCode: joinCode, userToken });
        void navigate(`/${joinCode}`);
      }
    });
  }, [name, roomCode, navigate]);

  // If the URL includes a valid room code, auto join the room.
  useEffect(() => {
    if (routeRoomCode) {
      const code = routeRoomCode.toUpperCase();
      setRoomCode(code);
      handleJoinRoom(code);
    }
  }, [routeRoomCode, handleJoinRoom]);


  return (
    <div
      className="min-h-screen w-screen bg-gray-900 text-white p-4 flex flex-col items-center">
      <h1 className="text-4xl font-bold my-6">Word Bomb</h1>
      <div
        className="max-w-3xl w-full bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col space-y-6 md:flex-row md:space-x-6 md:space-y-0">
        {/* Left Column: Name Panel */}
        <div className="flex-1">
          <NamePanel initialName={name} onSave={handleSaveName}/>
        </div>

        {/* Center Column: Create Room Panel */}
        <div className="flex-1">
          <CreateRoomPanel
            roomName={roomName}
            setRoomName={setRoomName}
            onCreate={handleCreateRoom}
          />
        </div>

        {/* Right Column: Join Room Panel */}
        <div className="flex-1">
          <JoinRoomPanel
            roomCode={roomCode}
            setRoomCode={setRoomCode}
            onJoin={handleJoinRoom}
          />
        </div>
      </div>
    </div>
  );
}
