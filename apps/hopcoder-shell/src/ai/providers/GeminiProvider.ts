import { AIProvider, ChatMessage, Tool, ToolCall } from '../types';
import { toolRegistry } from '../ToolRegistry';

export class GeminiProvider implements AIProvider {
  name = 'HopCoder AI';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(messages: ChatMessage[], tools?: Tool[]): Promise<string> {
    throw new Error('Not implemented for streaming only');
  }

  async stream(
    messages: ChatMessage[], 
    onChunk: (chunk: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): Promise<void> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}`;

    const systemMessage = messages.find(m => m.role === 'system');
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        let role = 'user';
        if (m.role === 'assistant') role = 'model';
        
        const parts: any[] = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        
        if (m.role === 'assistant' && m.toolCalls) {
             m.toolCalls.forEach(tc => {
                 parts.push({
                     functionCall: {
                         name: tc.name,
                         args: tc.arguments
                     }
                 });
             });
        }
        
        if (m.role === 'tool') {
            role = 'function';
            return {
                role,
                parts: [{
                    functionResponse: {
                        name: m.toolCallId, // Assuming toolCallId holds the function name for now as we don't persist it elsewhere easily
                        response: { result: m.content } 
                    }
                }]
            };
        }

        return { role, parts };
      });

    const toolsConfig = toolRegistry.getAll().map(t => {
      // Gemini doesn't support 'additionalProperties' in schema
      const cleanSchema = (schema: any): any => {
        if (!schema || typeof schema !== 'object') return schema;
        const { additionalProperties, ...rest } = schema;
        if (rest.properties) {
          const newProps: any = {};
          for (const key in rest.properties) {
            newProps[key] = cleanSchema(rest.properties[key]);
          }
          rest.properties = newProps;
        }
        if (rest.items) {
          rest.items = cleanSchema(rest.items);
        }
        return rest;
      };

      return {
        name: t.name,
        description: t.description,
        parameters: cleanSchema(t.parameters)
      };
    });

    const body: any = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    };

    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    if (toolsConfig.length > 0) {
      body.tools = [{ functionDeclarations: toolsConfig }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Gemini API Error: ${txt}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      let startIndex = 0;
      let braceCount = 0;
      let inString = false;
      let escaped = false;
      
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            continue;
        }
        
        if (!inString) {
            if (char === '{') {
                if (braceCount === 0) startIndex = i;
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    const jsonStr = buffer.substring(startIndex, i + 1);
                    try {
                        const chunk = JSON.parse(jsonStr);
                        this.processChunk(chunk, onChunk, onToolCall);
                    } catch (e) {
                        console.error('Failed to parse chunk', e);
                    }
                    buffer = buffer.substring(i + 1);
                    i = -1;
                }
            }
        }
      }
    }
  }

  private processChunk(chunk: any, onChunk: (c: string) => void, onToolCall?: (tc: ToolCall) => void) {
    const candidate = chunk.candidates?.[0];
    if (!candidate) return;

    const parts = candidate.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.text) {
          onChunk(part.text);
        }
        if (part.functionCall && onToolCall) {
          onToolCall({
            id: part.functionCall.name, // Gemini uses name as ID effectively for simple turns, but we need to be careful.
            name: part.functionCall.name,
            arguments: part.functionCall.args
          });
        }
      }
    }
  }
}
