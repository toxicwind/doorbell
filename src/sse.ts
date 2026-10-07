/** SSE fan-out with mutex. endpoint event then stay open; list_changed on tier changes. */
import { sseMutex } from "./effects.ts";

export interface StreamSink {
  id: string;
  enqueue: (c: Uint8Array) => void;
}

const agentStreams = new Map<string, Set<StreamSink>>();
const enc = new TextEncoder();

export function addSink(key: string, sink: StreamSink) {
  const set = agentStreams.get(key) ?? new Set<StreamSink>();
  set.add(sink);
  agentStreams.set(key, set);
}

export function removeSink(key: string, sinkId: string) {
  const set = agentStreams.get(key);
  if (!set) return;
  for (const s of set) if (s.id === sinkId) set.delete(s);
  if (set.size === 0) agentStreams.delete(key);
}

export function endpointEvent(origin: string, sessionId: string, agentId: string): Uint8Array {
  return enc.encode(
    `event: endpoint\ndata: ${origin}/doorbell-mcp?sessionId=${sessionId}&agentId=${agentId}\n\n`,
  );
}

export async function broadcast(key: string, notification: unknown): Promise<number> {
  return sseMutex.run(async () => {
    const sinks = agentStreams.get(key);
    if (!sinks || sinks.size === 0) return 0;
    const payload = enc.encode(`event: message\ndata: ${JSON.stringify(notification)}\n\n`);
    let delivered = 0;
    for (const sink of sinks) {
      try {
        sink.enqueue(payload);
        delivered++;
      } catch {
        sinks.delete(sink);
      }
    }
    return delivered;
  });
}

export function listChangedNotification() {
  return { jsonrpc: "2.0", method: "notifications/tools/list_changed", params: {} };
}

export function streamCount(key: string) {
  return agentStreams.get(key)?.size ?? 0;
}

export function clearStreams(key: string) {
  agentStreams.delete(key);
}
