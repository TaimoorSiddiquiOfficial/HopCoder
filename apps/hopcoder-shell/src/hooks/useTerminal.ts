import { useState, useEffect, useCallback } from 'react';
import { HopEvent } from '@proto/ipc';
import { ipc } from '../lib/ipc';

export interface TerminalInstance {
  id: string;
  title: string;
  output: string;
}

export function useTerminal() {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    
    const subscribe = async () => {
      unlistenFn = await ipc.onEvent((evt: HopEvent) => {
        if (evt.type === 'terminal.data') {
          setTerminals(prev => prev.map(t => {
            if (t.id === evt.id) {
              return { ...t, output: t.output + evt.data };
            }
            return t;
          }));
        }
      });
    };
    subscribe();
    
    // Cleanup: unsubscribe from events when component unmounts
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const createTerminal = async () => {
    const id = `term-${Date.now()}`;
    const newTerm: TerminalInstance = { id, title: `Terminal ${terminals.length + 1}`, output: '' };
    setTerminals(prev => [...prev, newTerm]);
    setActiveTerminalId(id);
    await ipc.send({ type: 'terminal.spawn', id });
  };

  const closeTerminal = async (id: string) => {
    await ipc.send({ type: 'terminal.kill', id, signal: 'SIGKILL' });
    setTerminals(prev => {
      const newTerms = prev.filter(t => t.id !== id);
      if (activeTerminalId === id) {
        setActiveTerminalId(newTerms.length > 0 ? newTerms[newTerms.length - 1].id : null);
      }
      return newTerms;
    });
  };

  const writeToTerminal = (data: string) => {
    if (activeTerminalId) {
      ipc.send({ type: 'terminal.write', id: activeTerminalId, data });
    }
  };

  return {
    terminals,
    activeTerminalId,
    setActiveTerminalId,
    createTerminal,
    closeTerminal,
    writeToTerminal
  };
}
