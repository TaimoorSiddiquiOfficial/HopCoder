import { useEffect, useState } from 'react';
import type { HopEvent, HopWorkspaceListResponse, HopFsReadResponse } from '@proto/ipc';
import fsTools from '@proto/tools/fs-tools.json';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { CodeEditor } from './components/Editor';
import { TerminalPanel } from './components/TerminalPanel';
import { CommandPalette } from './components/CommandPalette';
import { ChatPanel } from './components/ChatPanel';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { FileSearch } from './components/FileSearch';
import { MenuBar, MenuItem } from './components/MenuBar';
import { toolRegistry } from './ai/ToolRegistry';
import { aiOrchestrator } from './ai/Orchestrator';
import { ipc } from './lib/ipc';
import { hopMemoryLoadProject, hopMemorySaveProject } from './lib/hopMemory';
import { useHopWorkspace } from './hooks/useHopWorkspace';
import { useEditor } from './hooks/useEditor';
import { useTerminal } from './hooks/useTerminal';
import logoFull from './assets/logo-full.svg';
import logoIcon from './assets/logo-icon.svg';

function App() {
  const {
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
    addWorkspaceFolder
  } = useHopWorkspace();

  const {
    tabs,
    activeFilePath,
    openFile,
    closeFile,
    closeOtherFiles,
    setActiveFilePath,
    updateFileContent,
    saveFile
  } = useEditor(workspaceRoot);

  const {
    terminals,
    activeTerminalId,
    setActiveTerminalId,
    createTerminal,
    closeTerminal,
    writeToTerminal
  } = useTerminal();

  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isFileSearchOpen, setIsFileSearchOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Register tools with current workspace root context
  useEffect(() => {
    const toolImpls: Record<string, (args: any) => Promise<any>> = {
      'fs.read': async ({ path }) => {
        const res = await ipc.send<HopFsReadResponse>({ 
          type: 'fs.read', 
          path, 
          root: workspaceRoot || undefined 
        });
        if (!res.ok) throw new Error(res.error);
        return res.content;
      },
      'fs.write': async ({ path, content }) => {
        const res = await ipc.send({ 
          type: 'fs.write', 
          path, 
          content, 
          root: workspaceRoot || undefined 
        });
        if (!res.ok) throw new Error(res.error);
        return 'Success';
      },
      'fs.list': async ({ path }) => {
        const target = path || workspaceRoot;
        const res = await ipc.send<HopWorkspaceListResponse>({ type: 'workspace.list', root: target });
        if (!res.ok) throw new Error(res.error);
        return res.entries;
      },
      'fs.search': async ({ query }) => {
        const res = await ipc.send<any>({ type: 'fs.search', query, root: workspaceRoot || undefined });
        if (!res.ok) throw new Error(res.error);
        return res.matches;
      },
      'hop.memory.save': async ({ key, value }) => {
        if (!workspaceRoot) throw new Error('No workspace open');
        await hopMemorySaveProject(workspaceRoot, key, value);
        return 'Saved';
      },
      'hop.memory.load_project': async () => {
        if (!workspaceRoot) throw new Error('No workspace open');
        return await hopMemoryLoadProject(workspaceRoot);
      }
    };

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

    // Register Memory tools manually (since they are not in fs-tools.json yet)
    toolRegistry.register({
      name: 'hop.memory.save',
      description: 'Save a key-value pair to project memory',
      parameters: { 
        type: 'object', 
        required: ['key', 'value'],
        properties: { 
          key: { type: 'string' }, 
          value: { type: 'string' } 
        } 
      },
      execute: toolImpls['hop.memory.save']
    });

    toolRegistry.register({
      name: 'hop.memory.load_project',
      description: 'Load all project memory',
      parameters: { type: 'object', properties: {} },
      execute: toolImpls['hop.memory.load_project']
    });
  }, [workspaceRoot]);

  // Auto-spawn first terminal
  useEffect(() => {
    if (terminals.length === 0) {
      createTerminal();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') || e.key === 'F1') {
        e.preventDefault();
        setIsCmdPaletteOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setIsFileSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFilePath, tabs, saveFile]);

  const commands = [
    { id: 'save', label: 'File: Save', action: () => saveFile(), shortcut: 'Ctrl+S' },
    { id: 'open', label: 'File: Open Workspace...', action: () => setIsWorkspaceOpen(false) },
    { id: 'add_folder', label: 'File: Add Folder to Workspace...', action: () => {
      const path = window.prompt('Enter folder path:');
      if (path) addWorkspaceFolder(path);
    }},
    { id: 'search_files', label: 'Go to File...', action: () => setIsFileSearchOpen(true), shortcut: 'Ctrl+P' },
    { id: 'reload', label: 'Window: Reload', action: () => window.location.reload() },
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
      id: 'ai.azure', 
      label: 'AI: Set Azure Agent', 
      action: () => {
        const defaultEndpoint = import.meta.env.VITE_AZURE_PROJECT_ENDPOINT 
          ? `${import.meta.env.VITE_AZURE_PROJECT_ENDPOINT}/applications/${import.meta.env.VITE_AZURE_AGENT_NAME || 'HopCoder'}/protocols/openai/responses?api-version=${import.meta.env.VITE_AZURE_API_VERSION || '2025-11-15-preview'}`
          : '';
        const endpoint = window.prompt('Enter Azure Agent Endpoint (openai/responses):', defaultEndpoint);
        const key = window.prompt('Enter Azure API Key:');
        if (endpoint && key) aiOrchestrator.setAzureAgent(endpoint, key);
      } 
    },
    { 
      id: 'ai.reset', 
      label: 'AI: Reset to Mock Mode', 
      action: () => aiOrchestrator.clearApiKey() 
    },
  ];

  const menuItems: MenuItem[] = [
    {
      label: 'File',
      children: [
        { label: 'New File', action: () => alert('Not implemented') },
        { label: 'Open Workspace...', action: () => setIsWorkspaceOpen(false) },
        { label: 'Add Folder to Workspace...', action: () => {
          const path = window.prompt('Enter folder path:');
          if (path) addWorkspaceFolder(path);
        }},
        { label: 'Save', action: () => saveFile(), shortcut: 'Ctrl+S' },
        { label: 'Close Tab', action: () => activeFilePath && closeFile(activeFilePath), shortcut: 'Ctrl+W' },
        { label: 'Close Other Tabs', action: () => activeFilePath && closeOtherFiles(activeFilePath) },
        { label: 'Exit', action: () => window.close() },
      ]
    },
    {
      label: 'Edit',
      children: [
        { label: 'Undo', shortcut: 'Ctrl+Z' },
        { label: 'Redo', shortcut: 'Ctrl+Y' },
        { label: 'Cut', shortcut: 'Ctrl+X' },
        { label: 'Copy', shortcut: 'Ctrl+C' },
        { label: 'Paste', shortcut: 'Ctrl+V' },
      ]
    },
    {
      label: 'View',
      children: [
        { label: 'Command Palette', action: () => setIsCmdPaletteOpen(true), shortcut: 'Ctrl+Shift+P' },
        { label: 'Toggle Chat', action: () => setIsChatOpen(v => !v) },
        { label: 'Toggle Terminal', action: () => {} }, // TODO
      ]
    },
    {
      label: 'Go',
      children: [
        { label: 'Go to File...', action: () => setIsFileSearchOpen(true), shortcut: 'Ctrl+P' },
      ]
    },
    {
      label: 'Run',
      children: [
        { label: 'Run Task...' },
      ]
    },
    {
      label: 'Terminal',
      children: [
        { label: 'New Terminal', action: createTerminal },
        { label: 'Kill Terminal', action: () => activeTerminalId && closeTerminal(activeTerminalId) },
      ]
    },
    {
      label: 'Help',
      children: [
        { label: 'Keyboard Shortcuts', action: () => setIsShortcutsOpen(true) },
        { label: 'About' },
      ]
    }
  ];


  // Simple "Welcome / Open" screen if no workspace
  if (!isWorkspaceOpen) {
    return (
      <div className="h-screen w-screen bg-[#1e1e1e] text-white flex flex-col items-center justify-center">
        <img src={logoFull} alt="HopCoder" className="h-24 mb-8" />
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <MenuBar menus={menuItems} logo={logoIcon} />
      <div className="flex-1 overflow-hidden">
        <Layout
          sidebar={
            <Sidebar
              entries={entries}
              onFileSelect={openFile}
              onLoadChildren={listDir}
              workspaceRoot={workspaceRoot}
              notes={projectNotes}
              onSaveNotes={handleNotesChange}
              onNotesBlur={handleNotesBlur}
            />
          }
          editor={
            <CodeEditor
              tabs={tabs}
              activeFilePath={activeFilePath}
              rootPath={workspaceRoot}
              onTabClick={setActiveFilePath}
              onTabClose={closeFile}
              onContentChange={updateFileContent}
            />
          }
          bottomPanel={
            <TerminalPanel
              terminals={terminals}
              activeTerminalId={activeTerminalId}
              onSetActive={setActiveTerminalId}
              onCreate={createTerminal}
              onClose={closeTerminal}
              onInput={writeToTerminal}
            />
          }
          rightPanel={isChatOpen ? <ChatPanel /> : undefined}
        />
      </div>
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        commands={commands}
      />
      <FileSearch
        isOpen={isFileSearchOpen}
        onClose={() => setIsFileSearchOpen(false)}
        onFileSelect={openFile}
        workspaceRoot={workspaceRoot}
      />
      <ShortcutsHelp
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}

export default App;
