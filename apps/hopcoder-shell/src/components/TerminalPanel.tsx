import React, { useEffect, useRef } from 'react';

interface TerminalPanelProps {
  output: string;
  onInput: (data: string) => void;
}

export function TerminalPanel({ output, onInput }: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = e.currentTarget.value;
      onInput(cmd + '\n');
      e.currentTarget.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-t border-[#333] text-gray-300 font-mono text-sm">
      <div className="flex items-center px-4 py-1 bg-[#252526] text-xs uppercase tracking-wider border-b border-[#333]">
        Terminal
      </div>
      <div className="flex-1 overflow-y-auto p-2 whitespace-pre-wrap">
        {output}
        <div ref={bottomRef} />
      </div>
      <div className="p-2 border-t border-[#333] flex gap-2">
        <span className="text-green-500">➜</span>
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent outline-none text-gray-200"
          onKeyDown={handleKeyDown}
          placeholder="Type command..."
        />
      </div>
    </div>
  );
}
