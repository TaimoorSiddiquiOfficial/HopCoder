import { useEffect, useState, useRef, useCallback } from 'react';
import { HopIpcClient } from '@proto/ipc-client';
import type { HopEvent, HopWorkspaceListResponse, HopFsReadResponse, WorkspaceEntry } from '@proto/ipc';
import fsTools from '@proto/tools/fs-tools.json';
import { hopMemoryLoadProject, hopMemorySaveProject } from './lib/hopMemory';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { CodeEditor } from './components/Editor';
import { TerminalPanel } from './components/TerminalPanel';
import { CommandPalette } from './components/CommandPalette';
import { ChatPanel } from './components/ChatPanel';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { toolRegistry } from './ai/ToolRegistry';
import { aiOrchestrator } from './ai/Orchestrator';

const ipc = new HopIpcClient();

// Simple debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}


// Tool Implementations
const toolImpls: Record<string, (args: any) => Promise<any>> = {
  'fs.read': async ({ path }) => {
    const res = await ipc.send<HopFsReadResponse>({ type: 'fs.read', path });
    if (!res.ok) throw new Error(res.error);
    return res.content;
  },
  'fs.write': async ({ path, content }) => {
    const res = await ipc.send({ type: 'fs.write', path, content });
    if (!res.ok) throw new Error(res.error);
    return 'Success';
  },
  'fs.list': async ({ path }) => {
    const res = await ipc.send<HopWorkspaceListResponse>({ type: 'workspace.list', root: path });
    if (!res.ok) throw new Error(res.error);
    return res.entries;
  }
};

// Register FS tools from manifest
fsTools.tools.forEach((t) => {
  if (toolImpls[t.name]) {
    toolRegistry.register({
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
      execute: toolImpls[t.name],
    });
  }
});

// Register Terminal tool manually
toolRegistry.register({
  name: 'terminal_run',
  description: 'Run a command in the terminal',
  parameters: { type: 'object', properties: { command: { type: 'string' } } },
  execute: async ({ command }) => {
    await ipc.send({ type: 'terminal.write', id: 'default', data: command + '\n' });
    return 'Command sent to terminal';
  }
});

function App() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string>('');
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [projectNotes, setProjectNotes] = useState('');

  // Debounced save function
  const debouncedSaveNotes = useCallback(
    debounce((root: string, notes: string) => {
      hopMemorySaveProject(root, 'project_notes', notes).catch(console.error);
    }, 500),
    []
  );

  useEffect(() => {
    const subscribe = async () =>

      ipc.onEvent((evt: HopEvent) => {
        if (evt.type === 'terminal.data') {
          setTerminalOutput((v) => v + evt.data);
        }
      });
    subscribe();
    
    // Auto-spawn terminal on load
    ipc.send({ type: 'terminal.spawn', id: 'default' }).catch(console.error);
  }, []);

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

  const handleFileSelect = async (path: string) => {
    setActiveFile(path);
    const resp = await ipc.send<HopFsReadResponse>({ type: 'fs.read', path });
    if (resp.ok && resp.content !== undefined) {
      setFileContent(resp.content);
    } else {
      setFileContent('// Error reading file');
    }
  };

  const handleSave = async () => {
    if (activeFile) {
      await ipc.send({ type: 'fs.write', path: activeFile, content: fileContent });
      // Optional: Show toast or status update
      console.log('Saved', activeFile);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') || e.key === 'F1') {
        e.preventDefault();
        setIsCmdPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, fileContent]);

  const handleTerminalInput = (data: string) => {
    ipc.send({ type: 'terminal.write', id: 'default', data });
  };

  const commands = [
    { id: 'save', label: 'File: Save', action: handleSave, shortcut: 'Ctrl+S' },
    { id: 'open', label: 'File: Open Workspace...', action: () => setIsWorkspaceOpen(false) },
    { id: 'reload', label: 'Window: Reload', action: () => window.location.reload() },
    { id: 'term.clear', label: 'Terminal: Clear', action: () => setTerminalOutput('') },
    { id: 'view.chat', label: 'View: Toggle Chat', action: () => setIsChatOpen(v => !v) },
    { id: 'help.shortcuts', label: 'Help: Keyboard Shortcuts', action: () => setIsShortcutsOpen(true) },
    { 
      id: 'ai.key', 
      label: 'AI: Set OpenAI API Key', 
      action: () => {
        const key = window.prompt('Enter OpenAI API Key:');
        if (key) aiOrchestrator.setApiKey(key);
      } 
    },
    { 
      id: 'ai.reset', 
      label: 'AI: Reset to Mock Mode', 
      action: () => aiOrchestrator.clearApiKey() 
    },
  ];


  // Simple "Welcome / Open" screen if no workspace
  if (!isWorkspaceOpen) {
    return (
      <div className="h-screen w-screen bg-[#1e1e1e] text-white flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-8 text-blue-400">HopCoder</h1>
        <div className="flex gap-2">
          <input
            className="bg-[#252526] border border-[#333] px-4 py-2 rounded text-white w-64 outline-none focus:border-blue-500"
            placeholder="Path to workspace..."
            value={workspaceRoot}
            onChange={(e) => setWorkspaceRoot(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && openWorkspace(workspaceRoot)}
          />
          <button
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition-colors"
            onClick={() => openWorkspace(workspaceRoot || '.')}
          >
            Open
          </button>
        </div>
        <p className="mt-4 text-gray-500 text-sm">Enter a path or use '.' for current directory</p>
      </div>
    );
  }

  const getLanguageFromPath = (path: string | null) => {
    if (!path) return 'typescript';
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  return (
    <>
      <Layout
        sidebar={
          <Sidebar
            entries={entries}
            onFileSelect={handleFileSelect}
            workspaceRoot={workspaceRoot}
            notes={projectNotes}
            onSaveNotes={handleNotesChange}
            onNotesBlur={handleNotesBlur}
          />
        }
        editor={
          <CodeEditor
            content={fileContent}
            path={activeFile || undefined}
            rootPath={workspaceRoot}
            language={getLanguageFromPath(activeFile)}
            onChange={(val) => setFileContent(val || '')}
          />
        }
        bottomPanel={
          <TerminalPanel
            output={terminalOutput}
            onInput={handleTerminalInput}
          />
        }
        rightPanel={isChatOpen ? <ChatPanel /> : undefined}
      />
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        commands={commands}
      />
      <ShortcutsHelp
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </>
  );
}

export default App;
