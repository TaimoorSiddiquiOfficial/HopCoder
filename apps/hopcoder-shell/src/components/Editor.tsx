import React, { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { lspService } from '../lsp/LspService';
import * as monaco from 'monaco-editor';
import { X } from 'lucide-react';
import { EditorTab } from '../hooks/useEditor';

interface EditorProps {
  tabs: EditorTab[];
  activeFilePath: string | null;
  rootPath?: string;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onContentChange: (path: string, value: string) => void;
}

export function CodeEditor({ tabs, activeFilePath, rootPath, onTabClick, onTabClose, onContentChange }: EditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  const activeTab = tabs.find(t => t.path === activeFilePath);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    editor.updateOptions({
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });
  };

  // Sync with LSP when file changes
  useEffect(() => {
    if (!editorRef.current || !activeTab || !rootPath) return;

    const model = editorRef.current.getModel();
    if (model) {
      // Ensure LSP is running for this language
      lspService.getClient(activeTab.language, rootPath).then((client) => {
        client.notifyOpen(model);
        
        const disposable = model.onDidChangeContent((e) => {
          client.notifyChange(model, e.changes);
        });
        
        return () => disposable.dispose();
      }).catch(err => {
        console.warn('LSP not available for', activeTab.language, err);
      });
    }
  }, [activeTab?.path, activeTab?.language, rootPath]);

  const getFileName = (path: string) => {
    return path.split(/[\\/]/).pop() || path;
  };

  return (
    <div className="h-full w-full bg-surface flex flex-col">
      {/* Tab Bar */}
      <div className="flex bg-surface-light overflow-x-auto border-b border-surface-light">
        {tabs.map(tab => (
          <div
            key={tab.path}
            className={`
              group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-r border-surface-light min-w-[120px] max-w-[200px]
              ${tab.path === activeFilePath ? 'bg-surface text-gold-light border-t-2 border-t-gold' : 'text-gray-400 hover:bg-surface hover:text-gold-dim'}
            `}
            onClick={() => onTabClick(tab.path)}
          >
            <span className="truncate flex-1">{getFileName(tab.path)}</span>
            {tab.isDirty && <div className="w-2 h-2 rounded-full bg-gold group-hover:hidden" />}
            <X
              size={14}
              className={`opacity-0 group-hover:opacity-100 hover:bg-surface-light rounded p-0.5 text-gold-dim hover:text-gold ${tab.isDirty ? 'block' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.path);
              }}
            />
          </div>
        ))}
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative">
        {activeTab ? (
          <Editor
            height="100%"
            defaultLanguage="typescript"
            language={activeTab.language}
            value={activeTab.content}
            theme="vs-dark"
            path={activeTab.path} // Helps Monaco with intellisense context
            onChange={(val) => onContentChange(activeTab.path, val || '')}
            onMount={handleEditorDidMount}
            options={{
              padding: { top: 16 },
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="mb-2">No file open</p>
              <p className="text-xs">Select a file from the explorer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
