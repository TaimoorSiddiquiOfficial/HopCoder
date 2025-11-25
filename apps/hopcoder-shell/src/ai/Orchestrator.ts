import { AIProvider, ChatMessage, ToolCall } from './types';
import { MockAIProvider } from './providers/MockProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { toolRegistry } from './ToolRegistry';
import fsTools from '@proto/tools/fs-tools.json';

export class HopAIOrchestrator {
  private provider: AIProvider;
  private history: ChatMessage[] = [];
  private listeners: ((history: ChatMessage[]) => void)[] = [];

  constructor() {
    // In the future, we can load this from config
    const savedKey = localStorage.getItem('hop_openai_key');
    if (savedKey) {
      this.provider = new OpenAIProvider(savedKey);
      this.addSystemMessage("You are HopCoder AI, an advanced coding assistant integrated with the local environment.");
    } else {
      this.provider = new MockAIProvider();
      
      // Dynamically build help message from tools
      const toolHelp = fsTools.tools.map(t => `- ${t.name}: ${t.description}`).join('\n      ');
      
      this.addSystemMessage(`You are HopCoder AI.
      Available commands (Mock Mode):
      ${toolHelp}
      - terminal_run: Run a command in the terminal
      
      Usage:
      - read <path> (maps to fs.read)
      - list <path> (maps to fs.list)
      - run <command> (maps to terminal_run)
      - write <path> <content> (maps to fs.write)
      `);
    }
  }

  public getHistory() {
    return [...this.history];
  }

  public subscribe(listener: (history: ChatMessage[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.getHistory()));
  }

  private addSystemMessage(content: string) {
    this.history.push({ role: 'system', content, timestamp: Date.now() });
  }

  public async sendMessage(content: string) {
    // Add user message
    const userMsg: ChatMessage = { role: 'user', content, timestamp: Date.now() };
    this.history.push(userMsg);
    this.notify();

    await this.processTurn();
  }

  private async processTurn() {
    // Create placeholder for assistant response
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    this.history.push(assistantMsg);
    this.notify();

    let currentToolCall: ToolCall | null = null;

    // Stream response
    await this.provider.stream(
      this.history.slice(0, -1), 
      (chunk) => {
        assistantMsg.content += chunk;
        this.notify();
      },
      (toolCall) => {
        currentToolCall = toolCall;
        assistantMsg.toolCalls = assistantMsg.toolCalls || [];
        assistantMsg.toolCalls.push(toolCall);
        this.notify();
      }
    );

    // If tool was called, execute it and recurse
    if (currentToolCall) {
      await this.handleToolExecution(currentToolCall);
    }
  }

  private async handleToolExecution(toolCall: ToolCall) {
    try {
      const result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
      
      // Add tool result to history
      this.history.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: toolCall.id,
        timestamp: Date.now()
      });
      this.notify();

      // Let AI respond to the tool result
      await this.processTurn();

    } catch (err: any) {
      this.history.push({
        role: 'tool',
        content: `Error: ${err.message}`,
        toolCallId: toolCall.id,
        timestamp: Date.now()
      });
      this.notify();
      await this.processTurn();
    }
  }

  public clearHistory() {
    this.history = [];
    this.addSystemMessage("You are HopCoder AI, an advanced coding assistant. You can use tools to read files, run commands, and explore the workspace.");
    this.notify();
  }

  public setApiKey(key: string) {
    localStorage.setItem('hop_openai_key', key);
    this.provider = new OpenAIProvider(key);
    this.history = []; // Clear history on provider switch
    this.addSystemMessage("You are HopCoder AI, an advanced coding assistant integrated with the local environment.");
    this.notify();
  }

  public clearApiKey() {
    localStorage.removeItem('hop_openai_key');
    this.provider = new MockAIProvider();
    this.history = [];
    
    // Dynamically build help message from tools
    const toolHelp = fsTools.tools.map(t => `- ${t.name}: ${t.description}`).join('\n    ');
    
    this.addSystemMessage(`You are HopCoder AI.
    Available commands (Mock Mode):
    ${toolHelp}
    - terminal_run: Run a command in the terminal
    
    Usage:
    - read <path> (maps to fs.read)
    - list <path> (maps to fs.list)
    - run <command> (maps to terminal_run)
    - write <path> <content> (maps to fs.write)
    `);
    this.notify();
  }
}

export const aiOrchestrator = new HopAIOrchestrator();
