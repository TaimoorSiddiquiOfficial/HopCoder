import { HopIpcClient } from '@proto/ipc-client';
import { LspClient } from './LspClient';
import * as monaco from 'monaco-editor';

class LspService {
  private clients = new Map<string, LspClient>();
  private ipc: HopIpcClient;

  constructor() {
    this.ipc = new HopIpcClient();
  }

  async getClient(languageId: string, rootPath: string): Promise<LspClient> {
    if (this.clients.has(languageId)) {
      return this.clients.get(languageId)!;
    }

    // Map language ID to server ID (as defined in Rust lsp.rs)
    const serverId = languageId === 'rust' ? 'rust' : languageId === 'typescript' ? 'typescript' : null;
    
    if (!serverId) {
      throw new Error(`No LSP server configured for ${languageId}`);
    }

    const client = new LspClient(this.ipc, serverId, languageId);
    this.clients.set(languageId, client);

    // Register providers
    monaco.languages.registerCompletionItemProvider(languageId, client.getCompletionProvider());
    monaco.languages.registerHoverProvider(languageId, client.getHoverProvider());

    await client.start(rootPath);
    return client;
  }
}

export const lspService = new LspService();
