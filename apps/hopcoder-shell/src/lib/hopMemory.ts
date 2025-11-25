import { invoke } from '@tauri-apps/api/tauri';

export interface HopMemoryItem {
  id: string;
  kind: 'project' | 'session';
  projectId?: string | null;
  sessionId?: string | null;
  key: string;
  valueJson: string;
  createdAt: number;
  expiresAt?: number | null;
}

export async function hopMemorySaveProject(
  projectId: string,
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<string> {
  const result = await invoke<{ id: string }>('hop_memory_save', {
    args: {
      kind: 'project',
      projectId,
      sessionId: null,
      key,
      value,
      ttlSeconds: ttlSeconds ?? null,
    },
  });
  return result.id;
}

export async function hopMemoryLoadProject(projectId: string): Promise<HopMemoryItem[]> {
  const items = await invoke<HopMemoryItem[]>('hop_memory_load_project', {
    args: { projectId },
  });
  return items;
}
