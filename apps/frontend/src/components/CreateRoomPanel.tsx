type CreateRoomPanelProps = {
  roomName: string;
  setRoomName: (val: string) => void;
  onCreate: () => void;
};

export function CreateRoomPanel({
                                  roomName,
                                  setRoomName,
                                  onCreate,
                                }: CreateRoomPanelProps) {
  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">Create a Room</h2>
      <label className="block text-sm font-bold mb-1">Room Name</label>
      <input
        type="text"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        className="w-full px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
      />
      <button
        onClick={onCreate}
        className="bg-green-600 hover:bg-green-500 transition-colors w-full py-2 rounded font-semibold"
      >
        Play
      </button>
    </div>
  );
}
