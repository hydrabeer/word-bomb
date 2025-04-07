import { FormEvent } from "react";

interface CreateRoomPanelProps {
  roomName: string;
  setRoomName: (val: string) => void;
  onCreate: () => void;
}

export function CreateRoomPanel({
                                  roomName,
                                  setRoomName,
                                  onCreate,
                                }: CreateRoomPanelProps) {
  // Prevent default submission behavior
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCreate();
  };
  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">Create a Room</h2>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <label className="block text-sm font-bold mb-1">Room name</label>
        <input
          type="text"
          placeholder="Name your room"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          maxLength={30}
          title="Maximum 30 characters."
          required
          className="w-full px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />
        <button
          type="submit"
          title="Create a new room"
          className="bg-green-600 hover:bg-green-500 transition-colors w-full py-2 rounded font-semibold"
        >
          Play
        </button>
      </form>
    </div>
  );
}
