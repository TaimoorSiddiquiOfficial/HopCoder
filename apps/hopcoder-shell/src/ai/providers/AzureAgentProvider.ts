import { AIProvider, ChatMessage, Tool, ToolCall } from '../types';
import { toolRegistry } from '../ToolRegistry';

export class AzureAgentProvider implements AIProvider {
  name = 'Azure AI Agent';
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  async complete(messages: ChatMessage[], tools?: Tool[]): Promise<string> {
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
    const openAiTools = toolRegistry.getAll().map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));

    // Use the provided endpoint directly
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${this.apiKey}`, // Azure Agents might use different auth or none if public/internal
        // If it's an Azure OpenAI resource, it usually needs api-key header
        'api-key': this.apiKey
      },
      body: JSON.stringify({
        messages: conversation,
        stream: true,
        tools: openAiTools.length > 0 ? openAiTools : undefined,
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Azure Agent API Error: ${err}`);
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
          const choice = json.choices[0];
          
          if (choice.delta?.content) {
            onChunk(choice.delta.content);
          }

          if (choice.delta?.tool_calls) {
            const tc = choice.delta.tool_calls[0];
            if (tc.id) {
              if (currentToolCall) {
                // Finish previous tool call if any (though usually one per delta stream start)
                // Actually, in streaming, we accumulate.
                // But here we just handle one at a time for simplicity or standard OpenAI behavior
                // OpenAI sends id only on the first chunk of the tool call
                currentToolCall = {
                  id: tc.id,
                  name: tc.function.name,
                  arguments: tc.function.arguments || ''
                };
              } else {
                currentToolCall = {
                  id: tc.id,
                  name: tc.function.name,
                  arguments: tc.function.arguments || ''
                };
              }
            } else if (tc.function?.arguments) {
              if (currentToolCall) {
                currentToolCall.arguments += tc.function.arguments;
              }
            }
          }

          if (choice.finish_reason === 'tool_calls' && currentToolCall) {
            try {
              const args = JSON.parse(currentToolCall.arguments);
              onToolCall?.({
                id: currentToolCall.id,
                name: currentToolCall.name,
                arguments: args
              });
              currentToolCall = null;
            } catch (e) {
              console.error('Failed to parse tool arguments', e);
            }
          }
        } catch (e) {
          console.error('Error parsing stream', e);
        }
      }
    }
  }
}
