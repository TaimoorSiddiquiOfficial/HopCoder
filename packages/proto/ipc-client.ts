import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { HOP_IPC_VERSION } from './ipc';
import type {
  HopRequestMessage,
  HopResponseMessage,
  HopNotificationMessage,
  HopRequest,
  HopResponse,
  HopEvent,
} from './ipc';

const EVENT_CHANNEL = 'hop://event';

export class HopIpcClient {
  private version = HOP_IPC_VERSION;

  async send<TResp extends HopResponse = HopResponse>(
    request: HopRequest,
    id: string = crypto.randomUUID(),
  ): Promise<TResp> {
    const msg: HopRequestMessage = { v: this.version, kind: 'request', id, request };
    const resp = (await invoke<HopResponseMessage>('hop_ipc', { message: msg })) as HopResponseMessage;
    if (!resp.response) throw new Error('Empty response');
    return resp.response as TResp;
  }

  onEvent(handler: (event: HopEvent) => void): Promise<UnlistenFn> {
    return listen<HopNotificationMessage>(EVENT_CHANNEL, (payload) => {
      const evt = payload.payload?.event;
      if (evt) handler(evt as HopEvent);
    });
  }
}

// Example usage:
// const ipc = new HopIpcClient();
// const content = await ipc.send<HopFsReadResponse>({ type: 'fs.read', path: '/tmp/foo.txt' });
