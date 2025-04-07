import { useState } from "react";

type NamePanelProps = {
  initialName: string;
  onSave: (newName: string) => void;
};

export function NamePanel({ initialName, onSave }: NamePanelProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);

  const handleSave = () => {
    setEditing(false);
    onSave(name);
  };

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-semibold mb-2">Your Name</h2>
      {editing ? (
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Your name"
            maxLength={20}
            title="Maximum 20 characters."
            className="px-4 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={handleSave}
            title="Save your name"
            className="bg-green-600 hover:bg-green-500 transition-colors px-4 py-2 rounded"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="text-lg">{name}</span>
          <button
            onClick={() => setEditing(true)}
            title="Edit your name"
            className="bg-gray-600 hover:bg-gray-500 transition-colors px-3 py-1 rounded"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
