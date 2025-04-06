import { useState } from 'react';
import { socket } from '../socket.ts';
import { useNavigate } from 'react-router-dom';

export default function JoinRoom() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!name || !roomCode) return;

    localStorage.setItem("name", name);

    socket.emit('joinRoom', { name, roomCode });
    navigate(`/room/${roomCode}`);
  };

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div
        className="bg-gray-800 max-w-md rounded-2xl shadow-lg p-8 w-full space-y-6">
        <h1 className="text-3xl font-bold text-center">Join a Room</h1>
        <input
          type="text"
          placeholder="Your name"
          className="w-full px-4 py-2 rounded-xl bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Room code"
          className="w-full px-4 py-2 rounded-xl bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        />
        <button
          onClick={handleJoin}
          className="w-full bg-blue-600 hover:bg-blue-500 transition-colors py-2 rounded-xl font-semibold"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
