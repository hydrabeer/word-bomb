import { useNavigate } from 'react-router-dom';

export default function DisconnectedPage() {
  const navigate = useNavigate();

  const handleReturn = () => {
    void navigate('/');
  };

  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-gray-900 p-4 text-white">
      <h1 className="mb-4 text-3xl font-bold">Disconnected</h1>
      <p className="mb-4">You have been disconnected from the game.</p>
      <button
        onClick={handleReturn}
        className="rounded bg-green-600 px-4 py-2 hover:bg-green-500"
      >
        Return to Join Room
      </button>
    </div>
  );
}
