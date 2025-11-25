import React from 'react';
import { Folder, FileCode, File } from 'lucide-react';

interface WorkspaceEntry {
  path: string;
  kind: 'file' | 'dir';
}

interface SidebarProps {
  entries: WorkspaceEntry[];
  onFileSelect: (path: string) => void;
  workspaceRoot: string;
  notes?: string;
  onSaveNotes?: (notes: string) => void;
  onNotesBlur?: () => void;
}

export function Sidebar({ entries, onFileSelect, workspaceRoot, notes, onSaveNotes, onNotesBlur }: SidebarProps) {
  // Simple flat list for now, can be improved to tree later
  // We'll strip the workspaceRoot from the path for display if possible
  
  const getDisplayName = (path: string) => {
    if (path.startsWith(workspaceRoot)) {
      return path.slice(workspaceRoot.length).replace(/^[\\/]/, '');
    }
    return path;
  };

  return (
    <div className="h-full bg-[#1e1e1e] text-gray-300 flex flex-col border-r border-[#333]">
      <div className="p-2 text-xs font-bold uppercase tracking-wider text-gray-500">Explorer</div>
      <div className="flex-1 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className="flex items-center gap-2 px-3 py-1 hover:bg-[#2a2d2e] cursor-pointer text-sm"
            onClick={() => entry.kind === 'file' && onFileSelect(entry.path)}
          >
            {entry.kind === 'dir' ? (
              <Folder size={14} className="text-blue-400" />
            ) : (
              <FileCode size={14} className="text-yellow-400" />
            )}
            <span className="truncate">{getDisplayName(entry.path)}</span>
          </div>
        ))}
      </div>
      {onSaveNotes && (
        <div className="h-1/3 border-t border-[#333] flex flex-col">
          <div className="p-2 text-xs font-bold uppercase tracking-wider text-gray-500">Project Notes</div>
          <textarea
            className="flex-1 bg-[#252526] text-gray-300 p-2 text-xs resize-none outline-none"
            placeholder="Add project notes here..."
            value={notes || ''}
            onChange={(e) => onSaveNotes(e.target.value)}
            onBlur={onNotesBlur}
          />
        </div>
      )}
    </div>
  );
}
