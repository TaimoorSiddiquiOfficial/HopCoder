import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[600px] bg-[#252526] border border-[#454545] shadow-2xl rounded-lg overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-3 py-3 border-b border-[#333]">
          <Search size={18} className="text-gray-400 mr-2" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-500"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filteredCommands.map((cmd, idx) => (
            <div
              key={cmd.id}
              className={`px-3 py-2 flex items-center justify-between cursor-pointer ${
                idx === selectedIndex ? 'bg-[#094771] text-white' : 'text-gray-300 hover:bg-[#2a2d2e]'
              }`}
              onClick={() => {
                cmd.action();
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && <span className="text-xs opacity-60">{cmd.shortcut}</span>}
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">No commands found</div>
          )}
        </div>
      </div>
    </div>
  );
}
