import { ChangeEvent, FormEvent, useId } from "react";

interface JoinRoomPanelProps {
  joinCode: string;
  setJoinCode: (code: string) => void;
  onJoin: () => void;
}

export function JoinRoomPanel({
                                joinCode,
                                setJoinCode,
                                onJoin
                              }: JoinRoomPanelProps) {
  const id = useId();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (joinCode.length === 4) {
      onJoin();
    }
  };

  const inputProps = {
    id: id,
    type: "text",
    placeholder: "Enter 4-letter code",
    value: joinCode,
    maxLength: 4,
    pattern: "[A-Z]{4}",
    title: "Exactly 4 letters.",
    required: true,
    autoComplete: "off" as const,
    className: "w-full px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3",
    onInvalid: (e: FormEvent<HTMLInputElement>) => {
      (e.target as HTMLInputElement).setCustomValidity("Please enter exactly 4 letters.");
    },
    onInput: (e: FormEvent<HTMLInputElement>) => {
      (e.target as HTMLInputElement).setCustomValidity("");
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const filteredValue = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
      setJoinCode(filteredValue);
    },
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">Join a Room</h2>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <label htmlFor={id} className="block text-sm font-bold mb-1">
          Code
        </label>
        <input {...inputProps} />
        <button
          type="submit"
          title="Join a friend's room"
          className="bg-green-600 hover:bg-green-500 transition-colors w-full py-2 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={joinCode.length !== 4}
        >
          Join
        </button>
      </form>
    </div>
  );
}
