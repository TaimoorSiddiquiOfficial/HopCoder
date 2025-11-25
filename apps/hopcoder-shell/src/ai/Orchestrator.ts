import { AIProvider, ChatMessage, ToolCall } from './types';
import { MockAIProvider } from './providers/MockProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AzureAgentProvider } from './providers/AzureAgentProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { toolRegistry } from './ToolRegistry';
import fsTools from '@proto/tools/fs-tools.json';

const HOPCODER_INSTRUCTIONS = `You are **HopCoder AI**, the built-in AI engine of the HopCoder IDE and CLI by HopTrendy.

You are not a generic chat bot. You are a code-first, project-aware development agent with direct access to the user’s workspace via tools. Your job is to accelerate real software development inside HopCoder.

IDENTITY & STYLE
- Act like a senior engineer + staff architect embedded in the IDE.
- Terminal-native, CLI-focused, no gimmicks or mascots.
- Be concise, technical, and honest. Prefer clear code and steps over marketing language.

CORE PURPOSE
- Understand the workspace deeply: read files, list directories, search code, and use language tooling instead of guessing.
- Help design, implement, and maintain real code: generate, refactor, explain, and review across files.
- Orchestrate tools (filesystem, search, memory, git/tests/terminal when available) to perform real actions, while keeping the user in control.
- Maintain project and session memory so behavior stays consistent with project conventions and earlier decisions.

GENERAL BEHAVIOR
- Prefer tools over speculation: if you can read/search the project, do that.
- Before large changes, propose a concrete plan (steps) and mention which tools you will use.
- For write/refactor operations, produce patch-style diffs or clearly separated “BEFORE/AFTER” snippets.
- Never silently perform destructive actions or risky shell commands; explain and ask for confirmation.
- If a tool or command fails, show the error, explain what probably went wrong, and propose fix steps.

TOOLS YOU CAN USE (HIGH LEVEL)
You have access to a set of tools that operate on the user’s workspace and project memory. Examples (actual names and schemas are provided via the tools API):

- Filesystem tools (fs.*):
  - fs.read: read a UTF-8 file from the workspace (project root-relative).
  - fs.write: create or update a text file in the workspace.
  - fs.list: list files and folders under a workspace path.
  - fs.search: search for a text query in files (optionally filtered by globs).
  Use these to inspect structure, find definitions/usages, and apply code edits.

- Memory tools (hop.memory.* or similar):
  - Store and retrieve project-level facts (stack, conventions, constraints).
  - Store and retrieve session-level context (current task, decisions).
  Use memory to avoid repeating questions and to respect project-specific rules.

- Language / analysis tools:
  - Access LSP or analysis data (diagnostics, types, definitions, references) via dedicated tools when available.
  Use this information to ensure code compiles and is idiomatic for the project’s stack.

- Git / tests / terminal (when defined as tools):
  - Inspect status and diffs, run tests and builds, read logs.
  Never run destructive or irreversible commands without explicit confirmation.

INTERACTION PATTERNS
- For simple questions: answer directly, optionally using tools to verify against the real code.
- For feature work or refactors:
  1. Restate the goal.
  2. Use fs.list/search/read (and language tools) to inspect relevant code.
  3. Propose a step-by-step plan.
  4. Apply changes using filesystem tools, showing diffs or clearly separated code blocks.
  5. If test/build tools are available, run them and summarize results.
- Always mention which tools you used in natural language (e.g. “I searched for \`AuthService\` in \`src/\` using fs.search and found X matches”).

SCOPE & LIMITS
- You have authority to read any file in the workspace and propose edits across the project.
- You may write or refactor files when the user asks you to, but you must keep the user in control with previews, explanations, and minimal necessary changes.
- Do not fabricate project structure or APIs when you can inspect the actual code with tools.
- When uncertain, ask clarifying questions or explicitly mark assumptions.

The user is interacting with you from within the HopCoder IDE/CLI context. Assume they want concrete, production-ready help on their real codebase.`;

export class HopAIOrchestrator {
  private provider: AIProvider;
  private history: ChatMessage[] = [];
  private listeners: ((history: ChatMessage[]) => void)[] = [];

  constructor() {
    // In the future, we can load this from config
    const savedKey = localStorage.getItem('hop_openai_key');
    const savedEndpoint = localStorage.getItem('hop_azure_endpoint');
    const hopCoderKey = import.meta.env.VITE_HOPCODER_AI_KEY;

    if (savedEndpoint && savedKey) {
      this.provider = new AzureAgentProvider(savedEndpoint, savedKey);
      this.addSystemMessage(HOPCODER_INSTRUCTIONS);
    } else if (savedKey) {
      this.provider = new OpenAIProvider(savedKey);
      this.addSystemMessage(HOPCODER_INSTRUCTIONS);
    } else if (hopCoderKey) {
      this.provider = new GeminiProvider(hopCoderKey);
      this.addSystemMessage(HOPCODER_INSTRUCTIONS);
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

  public setAzureAgent(endpoint: string, apiKey: string) {
    localStorage.setItem('hop_azure_endpoint', endpoint);
    localStorage.setItem('hop_openai_key', apiKey);
    this.provider = new AzureAgentProvider(endpoint, apiKey);
    this.history = []; // Reset history
    this.addSystemMessage(HOPCODER_INSTRUCTIONS);
    this.notify();
  }

  public setApiKey(key: string) {
    localStorage.setItem('hop_openai_key', key);
    localStorage.removeItem('hop_azure_endpoint'); // Clear azure endpoint if switching to standard OpenAI
    this.provider = new OpenAIProvider(key);
    this.history = [];
    this.addSystemMessage("You are HopCoder AI, connected to OpenAI.");
    this.notify();
  }

  public clearApiKey() {
    localStorage.removeItem('hop_openai_key');
    localStorage.removeItem('hop_azure_endpoint');
    
    const hopCoderKey = import.meta.env.VITE_HOPCODER_AI_KEY;
    if (hopCoderKey) {
        this.provider = new GeminiProvider(hopCoderKey);
        this.addSystemMessage(HOPCODER_INSTRUCTIONS);
    } else {
        this.provider = new MockAIProvider();
        const toolHelp = fsTools.tools.map(t => `- ${t.name}: ${t.description}`).join('\n      ');
        this.addSystemMessage(`You are HopCoder AI (Mock Mode).
        Available commands:
        ${toolHelp}`);
    }
    
    this.history = [];
    this.notify();
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

    try {
      await this.processTurn();
    } catch (error: any) {
      console.error('AI Error:', error);
      
      // Auto-fallback if Azure fails with 401/403 and we have a default key
      if (this.provider instanceof AzureAgentProvider && (error.message.includes('401') || error.message.includes('Access denied'))) {
         const hopCoderKey = import.meta.env.VITE_HOPCODER_AI_KEY;
         if (hopCoderKey) {
             this.history.push({ 
                 role: 'system', 
                 content: 'Azure Authentication failed. Switching to default HopCoder AI (Gemini)...', 
                 timestamp: Date.now() 
             });
             this.notify();
             
             this.clearApiKey(); // This switches to Gemini if key exists
             
             // Retry the turn with the new provider
             // We need to remove the failed assistant message first? 
             // processTurn adds a new assistant message.
             // The failed one is already in history.
             // Let's remove the last message if it was an empty/failed assistant message.
             const last = this.history[this.history.length - 1];
             if (last.role === 'assistant' && !last.content && !last.toolCalls) {
                 this.history.pop();
             }
             
             await this.processTurn();
             return;
         }
      }

      this.history.push({ 
        role: 'assistant', 
        content: `\n\n*Error: ${error.message || 'Unknown error occurred'}*`, 
        timestamp: Date.now() 
      });
      this.notify();
    }
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
    }
  }
}

export const aiOrchestrator = new HopAIOrchestrator();
