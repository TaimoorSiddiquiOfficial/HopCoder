import type {
  HopFsReadResponse,
  HopFsWriteResponse,
  HopWorkspaceEntry,
  HopWorkspaceListResponse,
} from '@proto/ipc';
import fsTools from '@proto/tools/fs-tools.json';
import { ipc } from '../lib/ipc';
import { toolRegistry } from './ToolRegistry';

type ToolSpec = (typeof fsTools.tools)[number];

const specsByName = new Map<string, ToolSpec>(
  fsTools.tools.map((tool) => [tool.name, tool]),
);

let workspaceRoot: string | null = null;
const utf8Encoder = new TextEncoder();

export function setFsToolsWorkspaceRoot(root: string | null) {
  workspaceRoot = root && root.trim().length > 0 ? root : null;
}

function ensureWorkspaceRoot(): string {
  if (!workspaceRoot) {
    throw new Error('Workspace is not open. Please open a workspace first.');
  }
  return workspaceRoot;
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

function sanitizeRelativePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed === '.') {
    return '';
  }
  if (/^(?:[a-zA-Z]:|\/|\\\\)/.test(trimmed)) {
    throw new Error('Paths must be workspace-relative (e.g. "src/main.rs").');
  }
  const normalized = normalizeSlashes(trimmed).replace(/^\.\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) {
    throw new Error('Path traversal ("..") is not allowed.');
  }
  return segments.join('/');
}

function resolveWorkspacePath(relativePath: string): string {
  const root = normalizeSlashes(ensureWorkspaceRoot()).replace(/\/+$/, '');
  const sanitized = sanitizeRelativePath(relativePath);
  if (!sanitized) {
    return root;
  }
  return `${root}/${sanitized}`;
}

function toWorkspaceRelative(absPath: string): string {
  const root = normalizeSlashes(ensureWorkspaceRoot()).replace(/\/+$/, '');
  const normalized = normalizeSlashes(absPath);
  if (normalized === root) {
    return '.';
  }
  if (normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }
  return normalized;
}

function byteLength(text: string): number {
  return utf8Encoder.encode(text).length;
}

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (maxBytes <= 0) {
    return { text: '', truncated: text.length > 0 };
  }
  let bytes = 0;
  let output = '';
  let truncated = false;
  for (const char of text) {
    const charBytes = utf8Encoder.encode(char).length;
    if (bytes + charBytes > maxBytes) {
      truncated = true;
      break;
    }
    output += char;
    bytes += charBytes;
  }
  return { text: output, truncated };
}

function isHiddenPath(relPath: string): boolean {
  const normalized = normalizeSlashes(relPath);
  if (normalized === '.' || !normalized.length) {
    return false;
  }
  return normalized
    .split('/')
    .filter(Boolean)
    .some((segment) => segment.startsWith('.'));
}

function getBaseName(relPath: string): string {
  const normalized = normalizeSlashes(relPath).replace(/\/+$/, '');
  if (!normalized || normalized === '.') {
    return '.';
  }
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

async function listDirectoryEntries(path: string): Promise<HopWorkspaceEntry[]> {
  const resp = await ipc.send<HopWorkspaceListResponse>({
    type: 'workspace.list',
    root: path,
  });
  if (!resp.ok || !resp.entries) {
    throw new Error(resp.error || 'Failed to list directory.');
  }
  return resp.entries;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function globToRegExp(glob: string): RegExp {
  let pattern = normalizeSlashes(glob.trim());
  if (!pattern.length) {
    return /^$/;
  }
  let regex = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      const next = pattern[i + 1];
      if (next === '*') {
        regex += '.*';
        i += 1;
      } else {
        regex += '[^/]*';
      }
    } else if (ch === '?') {
      regex += '[^/]';
    } else {
      regex += escapeRegExp(ch);
    }
  }
  regex += '$';
  return new RegExp(regex);
}

function compileGlobList(globs?: string[] | null): RegExp[] | null {
  if (!globs || globs.length === 0) {
    return null;
  }
  return globs.map((glob) => globToRegExp(glob));
}

function matchesIncludePatterns(relPath: string, matchers: RegExp[] | null): boolean {
  if (!matchers || matchers.length === 0) {
    return true;
  }
  return matchers.some((matcher) => matcher.test(normalizeSlashes(relPath)));
}

function matchesExcludePatterns(relPath: string, matchers: RegExp[] | null): boolean {
  if (!matchers || matchers.length === 0) {
    return false;
  }
  return matchers.some((matcher) => matcher.test(normalizeSlashes(relPath)));
}

function registerFsReadTool() {
  const spec = specsByName.get('fs.read');
  toolRegistry.register({
    name: 'fs.read',
    description: spec?.description ?? 'Read a UTF-8 file from the workspace.',
    parameters: spec?.input_schema ?? {},
    async execute({ path, max_bytes }: { path: string; max_bytes?: number }) {
      try {
        const absPath = resolveWorkspacePath(path);
        const resp = await ipc.send<HopFsReadResponse>({ type: 'fs.read', path: absPath });
        if (!resp.ok || typeof resp.content !== 'string') {
          return { ok: false, error: resp.error || 'Unable to read file.' };
        }
        if (typeof max_bytes === 'number' && max_bytes > 0) {
          const { text, truncated } = truncateUtf8(resp.content, max_bytes);
          return { ok: true, content: text, truncated };
        }
        return { ok: true, content: resp.content, truncated: false };
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    },
  });
}

async function tryReadFileContent(absPath: string) {
  try {
    const resp = await ipc.send<HopFsReadResponse>({ type: 'fs.read', path: absPath });
    return resp;
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

function registerFsWriteTool() {
  const spec = specsByName.get('fs.write');
  toolRegistry.register({
    name: 'fs.write',
    description: spec?.description ?? 'Write text to a workspace file.',
    parameters: spec?.input_schema ?? {},
    async execute({
      path,
      content,
      create_if_missing = true,
      append = false,
      overwrite = true,
    }: {
      path: string;
      content: string;
      create_if_missing?: boolean;
      append?: boolean;
      overwrite?: boolean;
    }) {
      try {
        const absPath = resolveWorkspacePath(path);
        const existing = await tryReadFileContent(absPath);
        const exists = existing.ok && typeof existing.content === 'string';

        if (!exists && !create_if_missing) {
          return { ok: false, error: 'File does not exist and create_if_missing is false.' };
        }
        if (exists && !append && overwrite === false) {
          return { ok: false, error: 'File exists and overwrite is false.' };
        }

        let finalContent = content;
        if (append) {
          const base = exists ? existing.content || '' : '';
          if (!exists && !create_if_missing) {
            return { ok: false, error: 'Cannot append because the file does not exist.' };
          }
          finalContent = `${base}${content}`;
        }

        const resp = await ipc.send<HopFsWriteResponse>({
          type: 'fs.write',
          path: absPath,
          content: finalContent,
        });

        if (!resp.ok) {
          return { ok: false, error: resp.error || 'Failed to write file.' };
        }

        return { ok: true, bytes_written: byteLength(finalContent) };
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    },
  });
}

function registerFsListTool() {
  const spec = specsByName.get('fs.list');
  toolRegistry.register({
    name: 'fs.list',
    description: spec?.description ?? 'List workspace directory entries.',
    parameters: spec?.input_schema ?? {},
    async execute({
      path,
      recursive = false,
      max_entries,
      include_hidden = false,
    }: {
      path: string;
      recursive?: boolean;
      max_entries?: number;
      include_hidden?: boolean;
    }) {
      try {
        const absPath = resolveWorkspacePath(path);
        const queue: string[] = [absPath];
        const entries: any[] = [];
        const limit = typeof max_entries === 'number' && max_entries > 0 ? max_entries : undefined;
        let truncated = false;

        while (queue.length) {
          const current = queue.shift()!;
          const dirEntries = await listDirectoryEntries(current);
          for (const entry of dirEntries) {
            const rel = toWorkspaceRelative(entry.path);
            if (!include_hidden && isHiddenPath(rel)) {
              continue;
            }
            const record = {
              path: rel,
              name: getBaseName(rel),
              type: entry.kind as 'file' | 'dir' | 'symlink',
              size: entry.kind === 'file' ? entry.size ?? null : 0,
              modified_ms: entry.modified_ms ?? null,
            };
            entries.push(record);
            if (limit && entries.length >= limit) {
              truncated = true;
              break;
            }
            if (recursive && entry.kind === 'dir') {
              queue.push(entry.path);
            }
          }
          if (limit && entries.length >= limit) {
            break;
          }
        }

        return { ok: true, entries, truncated };
      } catch (err: any) {
        return { ok: false, entries: [], error: err?.message || String(err) };
      }
    },
  });
}

interface FileNode {
  abs: string;
  rel: string;
}

async function collectFilesForSearch(
  absStart: string,
  excludeMatchers: RegExp[] | null,
  includeHidden: boolean,
): Promise<FileNode[]> {
  const files: FileNode[] = [];
  const queue: string[] = [absStart];
  const visited = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const entries = await listDirectoryEntries(current);
    for (const entry of entries) {
      const rel = toWorkspaceRelative(entry.path);
      if (!includeHidden && isHiddenPath(rel)) {
        continue;
      }
      if (entry.kind === 'dir') {
        if (matchesExcludePatterns(rel, excludeMatchers)) {
          continue;
        }
        queue.push(entry.path);
      } else {
        files.push({ abs: entry.path, rel });
      }
    }
  }

  return files;
}

function registerFsSearchTool() {
  const spec = specsByName.get('fs.search');
  toolRegistry.register({
    name: 'fs.search',
    description: spec?.description ?? 'Search for text in workspace files.',
    parameters: spec?.input_schema ?? {},
    async execute({
      query,
      path = '.',
      max_results = 100,
      case_sensitive = false,
      include_globs,
      exclude_globs,
    }: {
      query: string;
      path?: string;
      max_results?: number;
      case_sensitive?: boolean;
      include_globs?: string[];
      exclude_globs?: string[];
    }) {
      try {
        if (!query || !query.trim()) {
          return { ok: false, matches: [], error: 'Query must not be empty.' };
        }
        const absStart = resolveWorkspacePath(path);
        const includeMatchers = compileGlobList(include_globs);
        const excludeMatchers = compileGlobList(exclude_globs);
        const files = await collectFilesForSearch(absStart, excludeMatchers, true);
        const limit = Math.max(1, max_results ?? 100);
        const matches: any[] = [];
        const needle = case_sensitive ? query : query.toLowerCase();

        outer: for (const file of files) {
          if (!matchesIncludePatterns(file.rel, includeMatchers)) {
            continue;
          }
          if (matchesExcludePatterns(file.rel, excludeMatchers)) {
            continue;
          }
          const resp = await ipc.send<HopFsReadResponse>({ type: 'fs.read', path: file.abs });
          if (!resp.ok || typeof resp.content !== 'string') {
            continue;
          }
          if (resp.content.includes('\u0000')) {
            continue;
          }
          const lines = resp.content.split(/\r?\n/);
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
            const lineText = lines[lineIdx];
            const haystack = case_sensitive ? lineText : lineText.toLowerCase();
            let searchIndex = 0;
            while (true) {
              const idx = haystack.indexOf(needle, searchIndex);
              if (idx === -1) {
                break;
              }
              matches.push({
                path: file.rel,
                line: lineIdx,
                column: idx,
                preview: lineText.trim(),
              });
              if (matches.length >= limit) {
                break outer;
              }
              searchIndex = idx + needle.length;
            }
          }
          if (matches.length >= limit) {
            break;
          }
        }

        const truncated = matches.length >= limit;
        return { ok: true, matches, truncated };
      } catch (err: any) {
        return { ok: false, matches: [], error: err?.message || String(err) };
      }
    },
  });
}

registerFsReadTool();
registerFsWriteTool();
registerFsListTool();
registerFsSearchTool();
