import { Tool } from './types';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string) {
    return this.tools.get(name);
  }

  getAll() {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: any) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.execute(args);
  }
}

export const toolRegistry = new ToolRegistry();
