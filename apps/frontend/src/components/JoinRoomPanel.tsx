type JoinRoomPanelProps = {
  roomCode: string;
  setRoomCode: (val: string) => void;
  onJoin: () => void;
};

export function JoinRoomPanel({
                                roomCode,
                                setRoomCode,
                                onJoin,
                              }: JoinRoomPanelProps) {
  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">Join a Room</h2>
      <label className="block text-sm font-bold mb-1">Code</label>
      <input
        type="text"
        placeholder="Enter room code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        className="w-full px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />
      <button
        onClick={onJoin}
        className="bg-green-600 hover:bg-green-500 transition-colors w-full py-2 rounded font-semibold"
      >
        Join
      </button>
    </div>
  );
}
