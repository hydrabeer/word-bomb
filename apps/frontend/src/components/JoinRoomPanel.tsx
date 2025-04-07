import { FormEvent } from "react";

interface JoinRoomPanelProps {
  roomCode: string;
  setRoomCode: (val: string) => void;
  onJoin: () => void;
}

export function JoinRoomPanel({
                                roomCode,
                                setRoomCode,
                                onJoin,
                              }: JoinRoomPanelProps) {
  // Prevent default submission behavior
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onJoin();
  };
  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">Join a Room</h2>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <label className="block text-sm font-bold mb-1">Code</label>
        <input
          type="text"
          placeholder="Enter 4-letter code"
          value={roomCode}
          onChange={(e) => {
            const filteredValue = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
            setRoomCode(filteredValue);
          }}
          maxLength={4} // limit to 4 characters
          pattern="[A-Z]{4}" // regex to match 4 uppercase letters
          title="Exactly 4 letters."
          onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('Please enter exactly 4 letters.')}
          onInput={(e) => {
            (e.target as HTMLInputElement).setCustomValidity('');
          }}
          required
          className="w-full px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />
        <button
          type="submit"
          title="Join a friend's room"
          className="bg-green-600 hover:bg-green-500 transition-colors w-full py-2 rounded font-semibold"
        >
          Join
        </button>
      </form>
    </div>
  );
}
