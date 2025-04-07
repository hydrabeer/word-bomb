import { useNavigate } from "react-router-dom";

export default function DisconnectedPage() {
  const navigate = useNavigate();

  const handleReturn = () => {
    void navigate("/");
  };

  return (
    <div
      className="min-h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-4">Disconnected</h1>
      <p className="mb-4">You have been disconnected from the game.</p>
      <button
        onClick={handleReturn}
        className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded"
      >
        Return to Join Room
      </button>
    </div>
  );
}
