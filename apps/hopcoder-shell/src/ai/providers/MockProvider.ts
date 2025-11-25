import { AIProvider, ChatMessage, ToolCall } from '../types';

export class MockAIProvider implements AIProvider {
  name = 'Mock AI (Local)';

  async complete(messages: ChatMessage[]): Promise<string> {
    const last = messages[messages.length - 1];
    return `[Mock AI] I received your message: "${last.content}". I am a placeholder for the real HopCoder AI.`;
  }

  async stream(
    messages: ChatMessage[], 
    onChunk: (chunk: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<void> {
    const last = messages[messages.length - 1];
    
    if (last.role === 'user' && onToolCall) {
      const text = last.content.trim();
      
      // Simple command parsing
      const readMatch = text.match(/^read\s+(.+)$/i);
      if (readMatch) {
        onChunk(`Reading file: ${readMatch[1]}...\n`);
        onToolCall({ id: 'call_' + Date.now(), name: 'fs.read', arguments: { path: readMatch[1] } });
        return;
      }

      const listMatch = text.match(/^list\s+(.+)$/i);
      if (listMatch) {
        onChunk(`Listing directory: ${listMatch[1]}...\n`);
        onToolCall({ id: 'call_' + Date.now(), name: 'fs.list', arguments: { path: listMatch[1] } });
        return;
      }

      const runMatch = text.match(/^run\s+(.+)$/i);
      if (runMatch) {
        onChunk(`Running command: ${runMatch[1]}...\n`);
        onToolCall({ id: 'call_' + Date.now(), name: 'terminal.run', arguments: { command: runMatch[1] } });
        return;
      }
      
      const writeMatch = text.match(/^write\s+(\S+)\s+([\s\S]+)$/i);
      if (writeMatch) {
        onChunk(`Writing to file: ${writeMatch[1]}...\n`);
        onToolCall({ id: 'call_' + Date.now(), name: 'fs.write', arguments: { path: writeMatch[1], content: writeMatch[2] } });
        return;
      }
    }

    // Handle tool results
    if (last.role === 'tool') {
      onChunk(`Tool execution completed.\nResult: ${last.content.substring(0, 200)}${last.content.length > 200 ? '...' : ''}`);
      return;
    }

    const response = await this.complete(messages);
    const chunks = response.split(' ');
    for (const chunk of chunks) {
      await new Promise((r) => setTimeout(r, 50)); // Simulate network delay
      onChunk(chunk + ' ');
    }
  }
}
