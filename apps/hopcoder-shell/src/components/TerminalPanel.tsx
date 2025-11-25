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
    <div className="h-full flex flex-col bg-surface border-t border-surface-light text-gray-300 font-mono text-sm">
      {/* Terminal Tabs */}
      <div className="flex items-center bg-surface-light border-b border-surface-light">
        <div className="px-4 py-1 text-xs uppercase tracking-wider border-r border-surface-light text-gold-dim">
          Terminal
        </div>
        <div className="flex-1 flex overflow-x-auto">
          {terminals.map(term => (
            <div
              key={term.id}
              className={`
                group flex items-center gap-2 px-3 py-1 text-xs cursor-pointer border-r border-surface-light min-w-[100px]
                ${term.id === activeTerminalId ? 'bg-surface text-gold' : 'text-gray-400 hover:bg-surface hover:text-gold-dim'}
              `}
              onClick={() => onSetActive(term.id)}
            >
              <span className="truncate flex-1">{term.title}</span>
              <X
                size={12}
                className="opacity-0 group-hover:opacity-100 hover:bg-surface-light rounded p-0.5 text-gold-dim hover:text-gold"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(term.id);
                }}
              />
            </div>
          ))}
        </div>
        <div 
          className="px-2 py-1 hover:bg-surface cursor-pointer text-gold-dim hover:text-gold"
          onClick={onCreate}
          title="New Terminal"
        >
          <Plus size={14} />
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto p-2 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-surface-light scrollbar-track-surface">
        {activeTerminal ? activeTerminal.output : <div className="text-gold-dim italic p-2">No active terminal</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      {activeTerminal && (
        <div className="p-2 border-t border-surface-light flex gap-2">
          <span className="text-gold">➜</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-gold-light placeholder-gold-dim/30"
            onKeyDown={handleKeyDown}
            placeholder="Type command..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
