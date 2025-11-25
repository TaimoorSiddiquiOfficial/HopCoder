import React, { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { TerminalInstance } from '../hooks/useTerminal';

interface TerminalPanelProps {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  onSetActive: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onInput: (data: string) => void;
}

export function TerminalPanel({ terminals, activeTerminalId, onSetActive, onCreate, onClose, onInput }: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTerminal = terminals.find(t => t.id === activeTerminalId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTerminal?.output]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = e.currentTarget.value;
      onInput(cmd + '\n');
      e.currentTarget.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-t border-[#333] text-gray-300 font-mono text-sm">
      {/* Terminal Tabs */}
      <div className="flex items-center bg-[#252526] border-b border-[#333]">
        <div className="px-4 py-1 text-xs uppercase tracking-wider border-r border-[#333] text-gray-500">
          Terminal
        </div>
        <div className="flex-1 flex overflow-x-auto">
          {terminals.map(term => (
            <div
              key={term.id}
              className={`
                group flex items-center gap-2 px-3 py-1 text-xs cursor-pointer border-r border-[#333] min-w-[100px]
                ${term.id === activeTerminalId ? 'bg-[#1e1e1e] text-white' : 'text-gray-400 hover:bg-[#2a2d2e]'}
              `}
              onClick={() => onSetActive(term.id)}
            >
              <span className="truncate flex-1">{term.title}</span>
              <X
                size={12}
                className="opacity-0 group-hover:opacity-100 hover:bg-[#444] rounded p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(term.id);
                }}
              />
            </div>
          ))}
        </div>
        <div 
          className="px-2 py-1 hover:bg-[#333] cursor-pointer text-gray-400"
          onClick={onCreate}
          title="New Terminal"
        >
          <Plus size={14} />
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-2 whitespace-pre-wrap">
        {activeTerminal ? activeTerminal.output : <div className="text-gray-500 italic p-2">No active terminal</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      {activeTerminal && (
        <div className="p-2 border-t border-[#333] flex gap-2">
          <span className="text-green-500">➜</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-gray-200"
            onKeyDown={handleKeyDown}
            placeholder="Type command..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
