import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2, Bot, User, Copy, Check, Terminal, Code2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { aiOrchestrator } from '../ai/Orchestrator';
import { ChatMessage } from '../ai/types';

interface ChatPanelProps {
  onApplyCode?: (code: string) => void;
  onRunCommand?: (command: string) => void;
  activeFilePath?: string | null;
  activeFileContent?: string;
}

export function ChatPanel({ onApplyCode, onRunCommand, activeFilePath, activeFileContent }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = aiOrchestrator.subscribe(setMessages);
    setMessages(aiOrchestrator.getHistory());
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    
    let text = input;
    
    // Auto-attach context if relevant
    if (activeFilePath && activeFileContent) {
      const contextHeader = `\n\n[Context: Active File: ${activeFilePath}]\n\`\`\`\n${activeFileContent.slice(0, 2000)}${activeFileContent.length > 2000 ? '...' : ''}\n\`\`\`\n`;
      // We don't show this to the user in the UI input, but we send it to the AI
      // Actually, for the Orchestrator, we might want to send it as a separate system message or just append it.
      // For now, let's append it to the prompt but keep the UI clean? 
      // The Orchestrator handles history. If we append it to the prompt, it will show in history.
      // A better way is to let the Orchestrator know about the context via a tool or hidden prompt.
      // But for simplicity, let's just append it if the user asks about "this file".
      
      if (text.toLowerCase().includes('this file') || text.toLowerCase().includes('current file') || text.toLowerCase().includes('here')) {
         text += contextHeader;
      }
    }

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

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Filter out system messages for display
  const displayMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="h-full flex flex-col bg-surface border-l border-surface-light text-gray-300 w-96 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-light border-b border-surface-light shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-gold" />
          <span className="text-xs font-bold uppercase tracking-wider text-gold-light">HopCoder AI</span>
        </div>
        <button
          onClick={() => aiOrchestrator.clearHistory()}
          className="p-1.5 hover:bg-surface rounded-md text-gray-500 hover:text-gold-dim transition-all duration-200"
          title="Clear Chat"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-surface-light scrollbar-track-surface">
        {displayMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4 opacity-60">
            <div className="w-16 h-16 rounded-2xl bg-surface-light flex items-center justify-center border border-gold-dim/20">
              <Bot size={32} className="text-gold" />
            </div>
            <div>
              <h3 className="text-gold-light font-medium mb-1">HopCoder AI</h3>
              <p className="text-xs max-w-[200px]">Your advanced coding companion. Ask me to explain, refactor, or write code.</p>
            </div>
          </div>
        )}
        
        {displayMessages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg ${
              msg.role === 'assistant' 
                ? 'bg-surface-light border border-gold-dim/30 text-gold' 
                : 'bg-gold text-matte-black'
            }`}>
              {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
            </div>
            
            <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              <div className={`rounded-xl p-3 text-sm shadow-md border ${
                msg.role === 'assistant' 
                  ? 'bg-surface-light border-surface-light text-gray-200' 
                  : 'bg-surface-light border-gold-dim/20 text-gold-light'
              }`}>
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeId = `code-${idx}-${Math.random().toString(36).substr(2, 9)}`;
                        const codeString = String(children).replace(/\n$/, '');
                        const isShell = match && ['bash', 'sh', 'zsh', 'powershell', 'cmd'].includes(match[1]);

                        return !inline && match ? (
                          <div className="my-3 rounded-md overflow-hidden border border-surface bg-[#1e1e1e] shadow-lg">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#333]">
                              <span className="text-xs text-gray-400 font-mono">{match[1]}</span>
                              <div className="flex gap-1">
                                {isShell && onRunCommand && (
                                  <button
                                    onClick={() => onRunCommand(codeString)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#333] text-xs text-green-500 hover:text-green-400 transition-colors"
                                    title="Run in Terminal"
                                  >
                                    <Terminal size={12} />
                                    <span>Run</span>
                                  </button>
                                )}
                                {!isShell && onApplyCode && (
                                  <button
                                    onClick={() => onApplyCode(codeString)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#333] text-xs text-gold-dim hover:text-gold transition-colors"
                                    title="Apply to Editor"
                                  >
                                    <Code2 size={12} />
                                    <span>Apply</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleCopy(codeString, codeId)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#333] text-xs text-gray-400 hover:text-white transition-colors"
                                  title="Copy Code"
                                >
                                  {copiedIndex === codeId ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                  <span>{copiedIndex === codeId ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                            </div>
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ margin: 0, padding: '1rem', fontSize: '12px', background: 'transparent' }}
                              {...props}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className="bg-surface px-1.5 py-0.5 rounded text-gold-light font-mono text-xs" {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isSending && (
          <div className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-surface-light border border-gold-dim/30 flex items-center justify-center">
              <Bot size={18} className="text-gold" />
            </div>
            <div className="bg-surface-light rounded-xl p-3 border border-surface-light">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface border-t border-surface-light">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-gold-dim to-gold opacity-20 group-hover:opacity-40 transition duration-500 blur rounded-lg"></div>
          <div className="relative flex flex-col bg-surface-light rounded-lg border border-gold-dim/20 shadow-xl">
            <textarea
              className="w-full bg-transparent text-gray-200 rounded-t-lg p-3 pr-10 text-sm outline-none resize-none placeholder-gray-600 min-h-[80px]"
              placeholder="Ask HopCoder to generate code, explain logic, or fix bugs..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="flex justify-between items-center px-2 py-1.5 border-t border-surface bg-surface/50 rounded-b-lg">
              <div className="flex gap-1">
                <button className="p-1.5 text-gray-500 hover:text-gold-dim hover:bg-surface rounded transition-colors" title="Attach File">
                  <Code2 size={14} />
                </button>
              </div>
              <button
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  input.trim() 
                    ? 'bg-gold text-matte-black hover:bg-gold-light shadow-lg shadow-gold/20' 
                    : 'bg-surface text-gray-600 cursor-not-allowed'
                }`}
                onClick={handleSend}
                disabled={!input.trim() || isSending}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-center text-gray-600">
          HopCoder AI can make mistakes. Review generated code.
        </div>
      </div>
    </div>
  );
}
