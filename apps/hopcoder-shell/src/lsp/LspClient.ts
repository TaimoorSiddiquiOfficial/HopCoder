import { HopIpcClient } from '@proto/ipc-client';
import type { HopEvent } from '@proto/ipc';
import * as monaco from 'monaco-editor';

export class LspClient {
  private ipc: HopIpcClient;
  private serverId: string;
  private languageId: string;
  private isInitialized = false;
  private pendingRequests = new Map<number, (result: any) => void>();
  private nextId = 1;

  constructor(ipc: HopIpcClient, serverId: string, languageId: string) {
    this.ipc = ipc;
    this.serverId = serverId;
    this.languageId = languageId;

    this.ipc.onEvent((evt: HopEvent) => {
      if (evt.type === 'lsp.message' && evt.server === this.serverId) {
        this.handleMessage(evt.message);
      }
    });
  }

  async start(rootPath: string) {
    // Send initialize request
    const rootUri = `file://${rootPath.replace(/\\/g, '/')}`;
    const initResult = await this.sendRequest('initialize', {
      processId: null,
      rootUri,
      capabilities: {
        textDocument: {
          completion: { completionItem: { snippetSupport: true } },
          hover: {},
          publishDiagnostics: {},
        },
      },
    });
    
    this.isInitialized = true;
    this.sendNotification('initialized', {});
    console.log(`[LSP:${this.serverId}] Initialized`, initResult);
  }

  async sendRequest(method: string, params: any): Promise<any> {
    const id = this.nextId++;
    const payload = { jsonrpc: '2.0', id, method, params };
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, resolve);
      this.ipc.send({ type: 'lsp.request', server: this.serverId, payload })
        .then((resp) => {
          if (!resp.ok) {
            this.pendingRequests.delete(id);
            reject(resp.error);
          }
        })
        .catch((err) => {
          this.pendingRequests.delete(id);
          reject(err);
        });
    });
  }

  sendNotification(method: string, params: any) {
    const payload = { jsonrpc: '2.0', method, params };
    this.ipc.send({ type: 'lsp.request', server: this.serverId, payload }).catch(console.error);
  }

  private handleMessage(msg: any) {
    if (msg.id && this.pendingRequests.has(msg.id)) {
      // Response to our request
      const resolve = this.pendingRequests.get(msg.id);
      this.pendingRequests.delete(msg.id);
      if (msg.error) {
        console.error(`[LSP:${this.serverId}] Error:`, msg.error);
      } else {
        resolve?.(msg.result);
      }
    } else if (msg.method) {
      // Notification from server
      this.handleNotification(msg.method, msg.params);
    }
  }

  private handleNotification(method: string, params: any) {
    if (method === 'textDocument/publishDiagnostics') {
      const { uri, diagnostics } = params;
      // Convert URI to model
      // Monaco models are stored with their URI.
      // LSP sends encoded URIs (e.g. file:///c%3A/...). Monaco might use decoded or slightly different format.
      // Best way is to parse the LSP URI and find the model with that fsPath or toString match.
      
      const targetUri = monaco.Uri.parse(uri);
      const model = monaco.editor.getModel(targetUri) || 
                    monaco.editor.getModels().find(m => m.uri.toString() === uri || m.uri.fsPath === targetUri.fsPath);

      if (model) {
        const markers: monaco.editor.IMarkerData[] = diagnostics.map((d: any) => ({
          severity: d.severity === 1 ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
          startLineNumber: d.range.start.line + 1,
          startColumn: d.range.start.character + 1,
          endLineNumber: d.range.end.line + 1,
          endColumn: d.range.end.character + 1,
          message: d.message,
          source: d.source,
        }));
        monaco.editor.setModelMarkers(model, this.serverId, markers);
      }
    }
  }

  // Monaco Providers
  
  getCompletionProvider(): monaco.languages.CompletionItemProvider {
    return {
      provideCompletionItems: async (model, position) => {
        if (!this.isInitialized) return { suggestions: [] };
        
        const result = await this.sendRequest('textDocument/completion', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
        });

        const items = Array.isArray(result) ? result : result.items;
        return {
          suggestions: items.map((i: any) => ({
            label: i.label,
            // Map LSP kinds to Monaco kinds
            kind: this.mapKind(i.kind),
            insertText: i.insertText || i.label,
            detail: i.detail,
            documentation: i.documentation,
            range: undefined, // Let Monaco decide or map range if provided
          })),
        };
      },
    };
  }

  private mapKind(lspKind: number): monaco.languages.CompletionItemKind {
    // LSP: Text = 1, Method = 2, Function = 3, Constructor = 4, Field = 5, Variable = 6, Class = 7, Interface = 8, Module = 9, Property = 10
    // Monaco: Method = 0, Function = 1, Constructor = 2, Field = 3, Variable = 4, Class = 5, Struct = 6, Interface = 7, Module = 8, Property = 9
    // They are OFF BY ONE or completely different depending on version.
    // Actually, monaco.languages.CompletionItemKind keys:
    // Method = 0, Function = 1, Constructor = 2, Field = 3, Variable = 4, Class = 5, Struct = 6, Interface = 7, Module = 8, Property = 9, Event = 10, Operator = 11, Unit = 12, Value = 13, Constant = 14, Enum = 15, EnumMember = 16, Keyword = 17, Text = 18, Color = 19, File = 20, Reference = 21, Customcolor = 22, Folder = 23, TypeParameter = 24, User = 25, Issue = 26, Snippet = 27
    
    // LSP (3.17): Text=1, Method=2, Function=3, Constructor=4, Field=5, Variable=6, Class=7, Interface=8, Module=9, Property=10, Unit=11, Value=12, Enum=13, Keyword=14, Snippet=15, Color=16, File=17, Reference=18, Folder=19, EnumMember=20, Constant=21, Struct=22, Event=23, Operator=24, TypeParameter=25
    
    // Mapping seems necessary.
    switch (lspKind) {
      case 1: return monaco.languages.CompletionItemKind.Text;
      case 2: return monaco.languages.CompletionItemKind.Method;
      case 3: return monaco.languages.CompletionItemKind.Function;
      case 4: return monaco.languages.CompletionItemKind.Constructor;
      case 5: return monaco.languages.CompletionItemKind.Field;
      case 6: return monaco.languages.CompletionItemKind.Variable;
      case 7: return monaco.languages.CompletionItemKind.Class;
      case 8: return monaco.languages.CompletionItemKind.Interface;
      case 9: return monaco.languages.CompletionItemKind.Module;
      case 10: return monaco.languages.CompletionItemKind.Property;
      case 11: return monaco.languages.CompletionItemKind.Unit;
      case 12: return monaco.languages.CompletionItemKind.Value;
      case 13: return monaco.languages.CompletionItemKind.Enum;
      case 14: return monaco.languages.CompletionItemKind.Keyword;
      case 15: return monaco.languages.CompletionItemKind.Snippet;
      case 16: return monaco.languages.CompletionItemKind.Color;
      case 17: return monaco.languages.CompletionItemKind.File;
      case 18: return monaco.languages.CompletionItemKind.Reference;
      case 19: return monaco.languages.CompletionItemKind.Folder;
      case 20: return monaco.languages.CompletionItemKind.EnumMember;
      case 21: return monaco.languages.CompletionItemKind.Constant;
      case 22: return monaco.languages.CompletionItemKind.Struct;
      case 23: return monaco.languages.CompletionItemKind.Event;
      case 24: return monaco.languages.CompletionItemKind.Operator;
      case 25: return monaco.languages.CompletionItemKind.TypeParameter;
      default: return monaco.languages.CompletionItemKind.Text;
    }
  }

  getHoverProvider(): monaco.languages.HoverProvider {
    return {
      provideHover: async (model, position) => {
        if (!this.isInitialized) return null;

        const result = await this.sendRequest('textDocument/hover', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
        });

        if (!result || !result.contents) return null;

        return {
          contents: Array.isArray(result.contents) 
            ? result.contents.map((c: any) => ({ value: typeof c === 'string' ? c : c.value }))
            : [{ value: typeof result.contents === 'string' ? result.contents : result.contents.value }],
        };
      },
    };
  }
  
  // Document Sync
  
  notifyOpen(model: monaco.editor.ITextModel) {
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: model.uri.toString(),
        languageId: this.languageId,
        version: model.getVersionId(),
        text: model.getValue(),
      },
    });
  }

  notifyChange(model: monaco.editor.ITextModel, changes: monaco.editor.IModelContentChange[]) {
    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: model.uri.toString(),
        version: model.getVersionId(),
      },
      contentChanges: changes.map(c => ({
        range: {
          start: { line: c.range.startLineNumber - 1, character: c.range.startColumn - 1 },
          end: { line: c.range.endLineNumber - 1, character: c.range.endColumn - 1 },
        },
        rangeLength: c.rangeLength,
        text: c.text,
      })),
    });
  }
}
