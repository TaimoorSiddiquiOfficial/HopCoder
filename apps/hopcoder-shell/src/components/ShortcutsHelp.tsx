import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
  category: 'General' | 'Editor' | 'Terminal' | 'AI';
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'S'], description: 'Save current file', category: 'Editor' },
  { keys: ['Ctrl', 'P'], description: 'Open Command Palette', category: 'General' },
  { keys: ['F1'], description: 'Open Command Palette', category: 'General' },
  { keys: ['Ctrl', '`'], description: 'Toggle Terminal', category: 'Terminal' },
  { keys: ['Ctrl', 'B'], description: 'Toggle Sidebar', category: 'General' },
  { keys: ['Ctrl', 'Shift', 'F'], description: 'Search in Workspace', category: 'General' },
  { keys: ['Ctrl', 'Enter'], description: 'Send Chat Message', category: 'AI' },
];

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  if (!isOpen) return null;

  const grouped = SHORTCUTS.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#252526] border border-[#333] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#333]">
          <div className="flex items-center gap-2 text-white font-medium">
            <Keyboard size={20} className="text-blue-400" />
            <span>Keyboard Shortcuts</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {Object.entries(grouped).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{category}</h3>
              <div className="grid grid-cols-1 gap-2">
                {shortcuts.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#2a2d2e] p-2 rounded border border-[#333]">
                    <span className="text-gray-300 text-sm">{s.description}</span>
                    <div className="flex gap-1">
                      {s.keys.map((k, kIdx) => (
                        <kbd key={kIdx} className="bg-[#1e1e1e] border border-[#444] rounded px-2 py-0.5 text-xs text-gray-400 font-mono min-w-[24px] text-center">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-[#333] text-right">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
