import React, { useState, useMemo, memo } from 'react';
import { Folder, FolderOpen, FileCode, File, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import type { HopWorkspaceEntry } from '@proto/ipc';

interface SidebarProps {
  entries: HopWorkspaceEntry[];
  onFileSelect: (path: string) => void;
  onLoadChildren: (path: string) => Promise<HopWorkspaceEntry[]>;
  workspaceRoot: string;
  notes?: string;
  onSaveNotes?: (notes: string) => void;
  onNotesBlur?: () => void;
}

const FileTreeNode = ({ 
  entry, 
  depth, 
  onSelect, 
  onLoadChildren, 
  workspaceRoot 
}: { 
  entry: HopWorkspaceEntry; 
  depth: number; 
  onSelect: (path: string) => void; 
  onLoadChildren: (path: string) => Promise<HopWorkspaceEntry[]>;
  workspaceRoot: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<HopWorkspaceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const getDisplayName = (path: string) => {
    // For root entries, we might want to show relative path, but for nested, just the basename
    // Actually, for tree view, we always want basename
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.kind === 'file') {
      onSelect(entry.path);
      return;
    }

    if (!isOpen && !hasLoaded) {
      setIsLoading(true);
      try {
        const items = await onLoadChildren(entry.path);
        // Sort: directories first, then files
        items.sort((a, b) => {
          if (a.kind === b.kind) return a.path.localeCompare(b.path);
          return a.kind === 'dir' ? -1 : 1;
        });
        setChildren(items);
        setHasLoaded(true);
      } catch (err) {
        console.error("Failed to load children", err);
      } finally {
        setIsLoading(false);
      }
    }
    setIsOpen(!isOpen);
  };

  const paddingLeft = `${depth * 12 + 12}px`;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 hover:bg-surface-light cursor-pointer text-sm select-none ${isOpen ? 'text-gold-light' : 'text-gray-400'}`}
        style={{ paddingLeft }}
        onClick={handleToggle}
      >
        <span className="opacity-70 w-4 flex justify-center">
          {entry.kind === 'dir' && (
            isLoading ? <Loader2 size={12} className="animate-spin text-gold" /> :
            isOpen ? <ChevronDown size={14} className="text-gold" /> : <ChevronRight size={14} className="text-gold-dim" />
          )}
        </span>
        
        {entry.kind === 'dir' ? (
          isOpen ? <FolderOpen size={14} className="text-gold" /> : <Folder size={14} className="text-gold-dim" />
        ) : (
          <FileCode size={14} className="text-gold-light opacity-80" />
        )}
        <span className="truncate">{getDisplayName(entry.path)}</span>
      </div>
      
      {isOpen && (
        <div>
          {children.map(child => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onSelect={onSelect}
              onLoadChildren={onLoadChildren}
              workspaceRoot={workspaceRoot}
            />
          ))}
          {children.length === 0 && hasLoaded && (
            <div style={{ paddingLeft: `${(depth + 1) * 12 + 28}px` }} className="text-xs text-gray-600 py-1 italic">
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export function Sidebar({ entries, onFileSelect, onLoadChildren, workspaceRoot, notes, onSaveNotes, onNotesBlur }: SidebarProps) {
  // Memoize sorted entries to prevent re-sorting on every render
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.kind === b.kind) return a.path.localeCompare(b.path);
      return a.kind === 'dir' ? -1 : 1;
    });
  }, [entries]);

  return (
    <div className="h-full bg-[#1e1e1e] text-gray-300 flex flex-col border-r border-[#333]">
      <div className="p-2 text-xs font-bold uppercase tracking-wider text-gray-500">Explorer</div>
      <div className="flex-1 overflow-y-auto">
        {sortedEntries.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            onSelect={onFileSelect}
            onLoadChildren={onLoadChildren}
            workspaceRoot={workspaceRoot}
          />
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
