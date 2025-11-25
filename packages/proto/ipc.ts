/** Protocol version, useful for migrations */
export const HOP_IPC_VERSION = 1 as const;

/** High-level message envelope */
export type HopMessage =
  | HopRequestMessage
  | HopResponseMessage
  | HopNotificationMessage;

/** Every message has a direction + id (except fire-and-forget notifications) */
export interface HopBaseMessage {
  /** Protocol version */
  v: typeof HOP_IPC_VERSION;
}

/** Client → Server request */
export interface HopRequestMessage extends HopBaseMessage {
  kind: 'request';
  /** Correlation id; echoed back in the response */
  id: string;
  /** The actual operation */
  request: HopRequest;
}

/** Server → Client response */
export interface HopResponseMessage extends HopBaseMessage {
  kind: 'response';
  /** Must match the request id */
  id: string;
  /** Result of executing a HopRequest */
  response: HopResponse;
}

/** Server → Client (or client → server) push events */
export interface HopNotificationMessage extends HopBaseMessage {
  kind: 'notification';
  /** Unidirectional event, no response expected */
  event: HopEvent;
}

/* ------------------------------------------------------------------ */
/* Requests                                                           */
/* ------------------------------------------------------------------ */

export type HopRequest =
  | HopFsReadRequest
  | HopFsWriteRequest
  | HopFsDeleteRequest
  | HopFsSearchRequest
  | HopWorkspaceOpenRequest
  | HopWorkspaceListRequest
  | HopTerminalSpawnRequest
  | HopTerminalWriteRequest
  | HopTerminalResizeRequest
  | HopTerminalKillRequest
  | HopLspRequest;

export interface HopFsReadRequest {
  type: 'fs.read';
  path: string;
  root?: string;
}

export interface HopFsWriteRequest {
  type: 'fs.write';
  path: string;
  content: string;
  root?: string;
}

export interface HopFsDeleteRequest {
  type: 'fs.delete';
  path: string;
  root?: string;
}

export interface HopFsSearchRequest {
  type: 'fs.search';
  query: string;
  root?: string;
}

export interface HopWorkspaceOpenRequest {
  type: 'workspace.open';
  root: string;
}

export interface HopWorkspaceListRequest {
  type: 'workspace.list';
  root: string;
}

export interface HopTerminalSpawnRequest {
  type: 'terminal.spawn';
  /** User-friendly terminal id (client-side) */
  id: string;
  /** Optional shell binary (e.g. /bin/bash, powershell.exe) */
  shell?: string;
}

export interface HopTerminalWriteRequest {
  type: 'terminal.write';
  id: string;
  data: string;
}

export interface HopTerminalResizeRequest {
  type: 'terminal.resize';
  id: string;
  cols: number;
  rows: number;
}

export interface HopTerminalKillRequest {
  type: 'terminal.kill';
  id: string;
  signal?: string;
}

export interface HopLspRequest {
  type: 'lsp.request';
  /** LSP server identifier, e.g. "tsserver", "pyright" */
  server: string;
  /** Raw LSP payload (JSON-RPC) */
  payload: unknown;
}

/* ------------------------------------------------------------------ */
/* Responses (typed per operation)                                    */
/* ------------------------------------------------------------------ */

/**
 * Top-level response union per request type.
 * You always wrap these inside HopResponseMessage.
 */
export type HopResponse =
  | HopFsReadResponse
  | HopFsWriteResponse
  | HopFsDeleteResponse
  | HopFsSearchResponse
  | HopWorkspaceOpenResponse
  | HopWorkspaceListResponse
  | HopTerminalSpawnResponse
  | HopTerminalWriteResponse
  | HopTerminalResizeResponse
  | HopTerminalKillResponse
  | HopLspResponse
  | HopGenericErrorResponse;

/** Base success/failure discriminant */
interface HopBaseResponse {
  /** The original request type this responds to (for debugging) */
  type: HopRequest['type'] | 'error';
}

export interface HopFsReadResponse extends HopBaseResponse {
  type: 'fs.read';
  ok: boolean;
  /** File content on success */
  content?: string;
  /** Error message if ok === false */
  error?: string;
}

export interface HopFsWriteResponse extends HopBaseResponse {
  type: 'fs.write';
  ok: boolean;
  error?: string;
}

export interface HopFsDeleteResponse extends HopBaseResponse {
  type: 'fs.delete';
  ok: boolean;
  error?: string;
}

export interface HopFsSearchResponse extends HopBaseResponse {
  type: 'fs.search';
  ok: boolean;
  matches?: string[];
  error?: string;
}

export interface HopWorkspaceOpenResponse extends HopBaseResponse {
  type: 'workspace.open';
  ok: boolean;
  /** Normalized root path, project metadata, etc. */
  workspaceRoot?: string;
  error?: string;
}

export interface HopWorkspaceListResponse extends HopBaseResponse {
  type: 'workspace.list';
  ok: boolean;
  entries?: HopWorkspaceEntry[];
  error?: string;
}

export interface HopWorkspaceEntry {
  path: string;
  kind: 'file' | 'dir' | 'symlink';
  size?: number;
  modified_ms?: number;
}

export interface HopTerminalSpawnResponse extends HopBaseResponse {
  type: 'terminal.spawn';
  ok: boolean;
  /** Internal server-side pid or handle */
  pid?: number;
  error?: string;
}

export interface HopTerminalWriteResponse extends HopBaseResponse {
  type: 'terminal.write';
  ok: boolean;
  error?: string;
}

export interface HopTerminalResizeResponse extends HopBaseResponse {
  type: 'terminal.resize';
  ok: boolean;
  error?: string;
}

export interface HopTerminalKillResponse extends HopBaseResponse {
  type: 'terminal.kill';
  ok: boolean;
  error?: string;
}

export interface HopLspResponse extends HopBaseResponse {
  type: 'lsp.request';
  ok: boolean;
  /** Raw LSP JSON-RPC result or error object */
  result?: unknown;
  error?: string;
}

/** Catch-all protocol-level error */
export interface HopGenericErrorResponse extends HopBaseResponse {
  type: 'error';
  ok: false;
  /** Machine-readable code (optional but recommended) */
  code?: string;
  /** Human-readable description */
  error: string;
}

/* ------------------------------------------------------------------ */
/* Events / notifications (streaming, logs, etc.)                     */
/* ------------------------------------------------------------------ */

export type HopEvent =
  | HopTerminalDataEvent
  | HopTerminalExitEvent
  | HopLspMessageEvent
  | HopLogEvent;

export interface HopTerminalDataEvent {
  type: 'terminal.data';
  id: string; // terminal id
  data: string; // chunk of output
}

export interface HopTerminalExitEvent {
  type: 'terminal.exit';
  id: string;
  code: number | null;
  signal?: string | null;
}

export interface HopLspMessageEvent {
  type: 'lsp.message';
  server: string;
  message: any; // JSON-RPC message
}

export interface HopLogEvent {
  type: 'log';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  scope?: string;
}
