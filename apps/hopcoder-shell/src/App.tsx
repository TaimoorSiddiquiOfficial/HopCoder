import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
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
    projectNotes,
    openWorkspace,
    handleNotesChange,
    handleNotesBlur,
    listDir,
    addWorkspaceFolder,
    browseForWorkspace,
    closeWorkspace
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

  // Register terminal + memory tools (fs tools registered globally)
  useEffect(() => {
    toolRegistry.register({
      name: 'terminal.run',
      description: 'Run a command in the integrated terminal',
      parameters: { 
        type: 'object', 
        required: ['command'],
        properties: { command: { type: 'string' } } 
      },
      execute: async ({ command }: { command: string }) => {
        const targetId = activeTerminalId || 'default';
        await ipc.send({ type: 'terminal.write', id: targetId, data: `${command}\n` });
        return { ok: true, terminalId: targetId };
      }
    });

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
      execute: async ({ key, value }: { key: string; value: unknown }) => {
        if (!workspaceRoot) {
          throw new Error('No workspace is open.');
        }
        const id = await hopMemorySaveProject(workspaceRoot, key, value);
        return { ok: true, id };
      }
    });

    toolRegistry.register({
      name: 'hop.memory.load_project',
      description: 'Load project memory items',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        if (!workspaceRoot) {
          throw new Error('No workspace is open.');
        }
        const items = await hopMemoryLoadProject(workspaceRoot);
        return { ok: true, items };
      }
    });
  }, [workspaceRoot, activeTerminalId]);

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
    { id: 'open', label: 'File: Open Workspace...', action: () => closeWorkspace() },
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
      label: 'AI: Reset to Default (HopCoder AI)', 
      action: () => aiOrchestrator.clearApiKey() 
    },
  ];

  const menuItems: MenuItem[] = [
    {
      label: 'File',
      children: [
        { label: 'New File', action: () => alert('Not implemented') },
        { label: 'Open Workspace...', action: () => closeWorkspace() },
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


  const handleApplyCode = (code: string) => {
    if (activeFilePath) {
      updateFileContent(activeFilePath, code);
    }
  };

  const handleRunCommand = (command: string) => {
    // Ensure command ends with newline
    const cmd = command.endsWith('\n') ? command : `${command}\n`;
    writeToTerminal(cmd);
  };

  // Simple "Welcome / Open" screen if no workspace
  if (!isWorkspaceOpen) {
    return (
      <div className="h-screen w-screen bg-matte-black text-gold flex flex-col items-center justify-center">
        <img src={logoFull} alt="HopCoder" className="h-32 mb-8 opacity-90" />
        <div className="flex flex-col gap-4 w-96">
          <div className="flex gap-2">
            <input
              className="bg-surface border border-gold-dim/30 px-4 py-2 rounded text-gold-light w-full outline-none focus:border-gold placeholder-gold-dim/50"
              placeholder="Path to workspace..."
              value={workspaceRoot}
              onChange={(e) => setWorkspaceRoot(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && openWorkspace(workspaceRoot)}
            />
          </div>
          
          <div className="flex gap-2 justify-center">
            <button
              className="flex items-center gap-2 bg-surface-light hover:bg-surface border border-gold-dim/30 hover:border-gold text-gold px-6 py-2 rounded font-medium transition-all duration-200"
              onClick={browseForWorkspace}
            >
              <FolderOpen size={18} />
              Browse System
            </button>
            
            <button
              className="bg-gold hover:bg-gold-light text-matte-black px-8 py-2 rounded font-bold transition-colors shadow-lg shadow-gold/10"
              onClick={() => openWorkspace(workspaceRoot || '.')}
            >
              Open
            </button>
          </div>
        </div>
        <p className="mt-8 text-gold-dim text-sm opacity-60">HopCoder AI Native IDE</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-matte-black text-gray-300 overflow-hidden font-sans selection:bg-gold-dim/30">
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
          rightPanel={
            isChatOpen ? (
              <ChatPanel 
                onApplyCode={handleApplyCode}
                onRunCommand={handleRunCommand}
                activeFilePath={activeFilePath}
                activeFileContent={tabs.find(t => t.path === activeFilePath)?.content}
              />
            ) : undefined
          }
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
