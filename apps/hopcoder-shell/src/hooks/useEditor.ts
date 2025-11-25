import { useState, useCallback } from 'react';
import { HopFsReadResponse } from '@proto/ipc';
import { ipc } from '../lib/ipc';

export interface EditorTab {
  path: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export function useEditor(rootPath?: string) {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const getLanguageFromPath = (path: string) => {
    if (path.endsWith('.rs')) return 'rust';
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  const openFile = async (path: string) => {
    // Check if already open
    const existing = tabs.find(t => t.path === path);
    if (existing) {
      setActiveFilePath(path);
      return;
    }

    const resp = await ipc.send<HopFsReadResponse>({ type: 'fs.read', path, root: rootPath });
    if (resp.ok && resp.content !== undefined) {
      const newTab: EditorTab = {
        path,
        content: resp.content,
        isDirty: false,
        language: getLanguageFromPath(path)
      };
      setTabs(prev => [...prev, newTab]);
      setActiveFilePath(path);
    } else {
      console.error('Failed to read file', resp.error);
    }
  };

  const closeFile = (path: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.path !== path);
      if (activeFilePath === path) {
        // Switch to the last tab if available
        const last = newTabs[newTabs.length - 1];
        setActiveFilePath(last ? last.path : null);
      }
      return newTabs;
    });
  };

  const closeOtherFiles = (path: string) => {
    setTabs(prev => prev.filter(t => t.path === path));
    setActiveFilePath(path);
  };

  const updateFileContent = (path: string, content: string) => {
    setTabs(prev => prev.map(t => {
      if (t.path === path) {
        return { ...t, content, isDirty: true };
      }
      return t;
    }));
  };

  const saveFile = async (path?: string) => {
    const targetPath = path || activeFilePath;
    if (!targetPath) return;

    const tab = tabs.find(t => t.path === targetPath);
    if (tab) {
      await ipc.send({ type: 'fs.write', path: targetPath, content: tab.content, root: rootPath });
      setTabs(prev => prev.map(t => {
        if (t.path === targetPath) {
          return { ...t, isDirty: false };
        }
        return t;
      }));
      console.log('Saved', targetPath);
    }
  };

  const activeTab = tabs.find(t => t.path === activeFilePath);

  return {
    tabs,
    activeFilePath,
    activeTab,
    openFile,
    closeFile,
    closeOtherFiles,
    setActiveFilePath,
    updateFileContent,
    saveFile
  };
}
