import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { HopWorkspaceListResponse, HopWorkspaceEntry } from '@proto/ipc';
import { hopMemoryLoadProject, hopMemorySaveProject } from '../lib/hopMemory';
import { ipc } from '../lib/ipc';
import { setFsToolsWorkspaceRoot } from '../ai/registerFsTools';

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
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([]);
  const [entries, setEntries] = useState<HopWorkspaceEntry[]>([]);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [projectNotes, setProjectNotes] = useState('');

  // Debounced save function
  const debouncedSaveNotes = useCallback(
    debounce((root: string, notes: string) => {
      hopMemorySaveProject(root, 'project_notes', notes).catch(console.error);
    }, 500),
    []
  );

  const loadWorkspaceFolder = async (root: string): Promise<HopWorkspaceEntry[]> => {
    const resp = await ipc.send<HopWorkspaceListResponse>({ type: 'workspace.list', root });
    if (resp.ok && resp.entries) {
      return resp.entries;
    }
    return [];
  };

  const openWorkspace = async (root: string) => {
    // Check if it's a .code-workspace file
    if (root.endsWith('.code-workspace')) {
      // TODO: Parse .code-workspace file
      // For now, just treat the parent dir as root
      // const content = await ipc.send({ type: 'fs.read', path: root });
    }

    const folderEntries = await loadWorkspaceFolder(root);
    
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
    setFsToolsWorkspaceRoot(root);
    setWorkspaceFolders([root]);
    setEntries(folderEntries);
    setIsWorkspaceOpen(true);
    ipc.send({ type: 'workspace.open', root });
  };

  const browseForWorkspace = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Workspace Folder'
      });
      
      if (selected && typeof selected === 'string') {
        await openWorkspace(selected);
      }
    } catch (err) {
      console.error('Failed to browse for workspace', err);
    }
  };

  const addWorkspaceFolder = async (path: string) => {
    if (workspaceFolders.includes(path)) return;
    
    const newEntries = await loadWorkspaceFolder(path);
    // If we already have multiple folders, we might need a better structure
    // For now, let's just append to entries, but this is tricky for the tree view
    // Ideally, we should switch to a multi-root structure in the Sidebar
    
    setWorkspaceFolders(prev => [...prev, path]);
    // Re-fetching all might be needed or just appending
    // But Sidebar expects a flat list of top-level items
    // If we have multiple roots, we should probably wrap them in "Folder" entries
    
    const rootEntry: HopWorkspaceEntry = {
      path: path,
      kind: 'dir'
    };
    
    setEntries(prev => [...prev, rootEntry]);
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

  const closeWorkspace = () => {
    setIsWorkspaceOpen(false);
    setEntries([]);
    setWorkspaceFolders([]);
    setWorkspaceRoot('');
    setProjectNotes('');
    setFsToolsWorkspaceRoot(null);
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
    listDir,
    addWorkspaceFolder,
    browseForWorkspace,
    workspaceFolders,
    closeWorkspace
  };
}
