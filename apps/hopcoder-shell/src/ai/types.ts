export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  execute: (args: any) => Promise<any>;
}

export interface AIProvider {
  name: string;
  complete(messages: ChatMessage[], tools?: Tool[]): Promise<string>;
  stream(
    messages: ChatMessage[], 
    onChunk: (chunk: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<void>;
}
