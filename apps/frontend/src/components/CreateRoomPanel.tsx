import { ChangeEvent, FormEvent, useId } from 'react';

interface CreateRoomPanelProps {
  roomName: string;
  setRoomName: (val: string) => void;
  onCreate: () => void;
}

export function CreateRoomPanel({ roomName, setRoomName, onCreate }: CreateRoomPanelProps) {
  const id = useId();

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRoomName(e.target.value);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (roomName.trim().length > 0 && roomName.length <= 30) {
      onCreate();
    }
  };

  const inputProps = {
    id: id,
    type: 'text',
    placeholder: 'Name your room',
    value: roomName,
    maxLength: 30,
    title: 'Maximum 30 characters.',
    required: true,
    autoComplete: 'off' as const,
    className:
      'w-full px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3',
    onChange: handleInputChange,
  };

  return (
    <div className="flex flex-col">
      <h2 className="mb-2 text-xl font-semibold">Create a Room</h2>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <label htmlFor={id} className="mb-1 block text-sm font-bold">
          Room name
        </label>
        <input {...inputProps} />
        <button
          type="submit"
          title="Create a new room"
          className="w-full rounded bg-green-600 py-2 font-semibold transition-colors hover:bg-green-500"
        >
          Play
        </button>
      </form>
    </div>
  );
}
