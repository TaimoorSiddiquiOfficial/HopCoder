import { useState, useCallback } from 'react';
import { HopWorkspaceListResponse, WorkspaceEntry } from '@proto/ipc';
import { hopMemoryLoadProject, hopMemorySaveProject } from '../lib/hopMemory';
import { ipc } from '../lib/ipc';

// Simple debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function useHopWorkspace() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('');
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [projectNotes, setProjectNotes] = useState('');

  // Debounced save function
  const debouncedSaveNotes = useCallback(
    debounce((root: string, notes: string) => {
      hopMemorySaveProject(root, 'project_notes', notes).catch(console.error);
    }, 500),
    []
  );

  const openWorkspace = async (root: string) => {
    const resp = await ipc.send<HopWorkspaceListResponse>({ type: 'workspace.list', root });
    if (resp.ok && resp.entries) {
      // Load project notes FIRST to avoid overwriting with empty state
      let loadedNotes = '';
      try {
        const items = await hopMemoryLoadProject(root);
        const noteItem = items.find(i => i.key === 'project_notes');
        if (noteItem) {
          loadedNotes = JSON.parse(noteItem.valueJson);
        }
      } catch (e) {
        console.error('Failed to load notes', e);
      }

      setProjectNotes(loadedNotes);
      setWorkspaceRoot(root);
      setEntries(resp.entries);
      setIsWorkspaceOpen(true);
      ipc.send({ type: 'workspace.open', root });
    } else {
      console.error('Failed to open workspace:', resp.error);
    }
  };

  const handleNotesChange = (notes: string) => {
    setProjectNotes(notes);
    if (workspaceRoot) {
      debouncedSaveNotes(workspaceRoot, notes);
    }
  };

  const handleNotesBlur = () => {
    if (workspaceRoot) {
      hopMemorySaveProject(workspaceRoot, 'project_notes', projectNotes).catch(console.error);
    }
  };

  const listDir = async (path: string) => {
    const resp = await ipc.send<HopWorkspaceListResponse>({ type: 'workspace.list', root: path });
    if (resp.ok && resp.entries) {
      return resp.entries;
    }
    return [];
  };

  return {
    workspaceRoot,
    setWorkspaceRoot,
    entries,
    isWorkspaceOpen,
    setIsWorkspaceOpen,
    projectNotes,
    openWorkspace,
    handleNotesChange,
    handleNotesBlur,
    listDir
  };
}
