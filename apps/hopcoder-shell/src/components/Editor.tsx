import React, { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { lspService } from '../lsp/LspService';
import * as monaco from 'monaco-editor';

interface EditorProps {
  content: string;
  language?: string;
  path?: string;
  rootPath?: string;
  onChange?: (value: string | undefined) => void;
}

export function CodeEditor({ content, language = 'typescript', path, rootPath, onChange }: EditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

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
    if (!editorRef.current || !path || !language || !rootPath) return;

    const model = editorRef.current.getModel();
    if (model) {
      // Ensure LSP is running for this language
      lspService.getClient(language, rootPath).then((client) => {
        client.notifyOpen(model);
        
        const disposable = model.onDidChangeContent((e) => {
          client.notifyChange(model, e.changes);
        });
        
        return () => disposable.dispose();
      }).catch(err => {
        console.warn('LSP not available for', language, err);
      });
    }
  }, [path, language, rootPath]);

  return (
    <div className="h-full w-full bg-[#1e1e1e]">
      {path ? (
        <Editor
          height="100%"
          defaultLanguage="typescript"
          language={language}
          value={content}
          theme="vs-dark"
          path={path} // Helps Monaco with intellisense context
          onChange={onChange}
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
  );
}
