import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Bot, User } from 'lucide-react';
import { aiOrchestrator } from '../ai/Orchestrator';
import { ChatMessage } from '../ai/types';

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = aiOrchestrator.subscribe(setMessages);
    setMessages(aiOrchestrator.getHistory());
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const text = input;
    setInput('');
    setIsSending(true);
    try {
      await aiOrchestrator.sendMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter out system messages for display
  const displayMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-l border-[#333] text-gray-300 w-80">
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#333]">
        <span className="text-xs font-bold uppercase tracking-wider">HopCoder AI</span>
        <button
          onClick={() => aiOrchestrator.clearHistory()}
          className="p-1 hover:bg-[#333] rounded text-gray-500 hover:text-gray-300"
          title="Clear Chat"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {displayMessages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-10">
            <Bot size={32} className="mx-auto mb-2 opacity-50" />
            <p>How can I help you code today?</p>
          </div>
        )}
        {displayMessages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-blue-600' : 'bg-gray-600'
            }`}>
              {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={`flex-1 text-sm p-3 rounded-lg ${
              msg.role === 'assistant' ? 'bg-[#2a2d2e]' : 'bg-[#094771]'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#333]">
        <div className="relative">
          <textarea
            className="w-full bg-[#2a2d2e] text-white rounded p-2 pr-10 text-sm outline-none resize-none border border-transparent focus:border-blue-500"
            rows={3}
            placeholder="Ask HopCoder..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className={`absolute right-2 bottom-2 p-1 rounded ${
              input.trim() ? 'text-blue-400 hover:bg-[#333]' : 'text-gray-600'
            }`}
            onClick={handleSend}
            disabled={!input.trim() || isSending}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
