import { AIProvider, ChatMessage, Tool, ToolCall } from '../types';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI (GPT-4)';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4-turbo-preview') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(messages: ChatMessage[], tools?: Tool[]): Promise<string> {
    // Non-streaming implementation (simplified)
    return ''; 
  }

  async stream(
    messages: ChatMessage[], 
    onChunk: (chunk: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<void> {
    const systemMsg = messages.find(m => m.role === 'system');
    const conversation = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content
        };
      }
      if (m.role === 'assistant' && m.toolCalls) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
          }))
        };
      }
      return { role: m.role, content: m.content };
    });

    if (systemMsg) {
      conversation.unshift({ role: 'system', content: systemMsg.content });
    }

    // Convert internal tools to OpenAI format
    const openAiTools = (await import('../ToolRegistry')).toolRegistry.getAll().map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: conversation,
        stream: true,
        tools: openAiTools.length > 0 ? openAiTools : undefined,
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API Error: ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolCall: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices[0].delta;

          if (delta.content) {
            onChunk(delta.content);
          }

          if (delta.tool_calls) {
            const tc = delta.tool_calls[0];
            if (tc.id) {
              if (currentToolCall) {
                // Flush previous tool call if any (though usually one per stream in this loop logic, 
                // but OpenAI can send multiple. For simplicity we handle one sequence).
                // In streaming, we build it up.
              }
              currentToolCall = {
                id: tc.id,
                name: tc.function.name,
                arguments: ''
              };
            }
            if (tc.function?.arguments) {
              currentToolCall.arguments += tc.function.arguments;
            }
          }
          
          if (json.choices[0].finish_reason === 'tool_calls' && currentToolCall) {
             if (onToolCall) {
               try {
                 const args = JSON.parse(currentToolCall.arguments);
                 onToolCall({
                   id: currentToolCall.id,
                   name: currentToolCall.name,
                   arguments: args
                 });
               } catch (e) {
                 console.error('Failed to parse tool arguments', e);
               }
             }
             currentToolCall = null;
          }

        } catch (e) {
          console.error('Error parsing stream chunk', e);
        }
      }
    }
  }
}
