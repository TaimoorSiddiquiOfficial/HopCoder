import React, { useEffect, useRef, useState } from 'react';
import { Search, File } from 'lucide-react';
import { ipc } from '../lib/ipc';
import { HopFsSearchResponse } from '@proto/ipc';

interface FileSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (path: string) => void;
  workspaceRoot: string;
}

export function FileSearch({ isOpen, onClose, onFileSelect, workspaceRoot }: FileSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const searchFiles = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const resp = await ipc.send<HopFsSearchResponse>({ 
          type: 'fs.search', 
          query, 
          root: workspaceRoot 
        });
        
        if (resp.ok && resp.matches) {
          setResults(resp.matches.slice(0, 50)); // Limit to 50 results
        }
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchFiles, 300);
    return () => clearTimeout(timeoutId);
  }, [query, workspaceRoot]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          onFileSelect(results[selectedIndex]);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onFileSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh]">
      <div className="bg-[#252526] w-[600px] rounded-lg shadow-2xl border border-[#454545] flex flex-col max-h-[60vh]">
        <div className="p-3 border-b border-[#454545] flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            className="bg-transparent border-none outline-none text-white flex-1 placeholder-gray-500"
            placeholder="Search files by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isLoading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>
        
        <div className="overflow-y-auto flex-1 py-2">
          {results.length === 0 && query && !isLoading && (
            <div className="px-4 py-2 text-gray-500 text-sm">No matching files found</div>
          )}
          
          {results.map((path, index) => {
            const fileName = path.split(/[\\/]/).pop() || path;
            const dirPath = path.substring(0, path.length - fileName.length);
            
            return (
              <div
                key={path}
                className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${
                  index === selectedIndex ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                }`}
                onClick={() => {
                  onFileSelect(path);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <File className="w-4 h-4 flex-shrink-0 text-blue-400" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="truncate font-medium">{fileName}</div>
                  <div className="truncate text-xs opacity-60">{dirPath}</div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="px-3 py-1.5 bg-[#1e1e1e] border-t border-[#454545] text-[10px] text-gray-500 flex justify-between rounded-b-lg">
          <span>Select to open</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
