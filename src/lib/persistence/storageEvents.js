export const APP_DATA_EVENT_CHANNEL = 'yt-mentor-app-data-v1';

const SAFE_EVENT_TYPES = new Set([
  'generation-ready',
  'generation-active',
  'record-updated',
  'fallback-active',
]);

export function createPersistenceEvents({
  BroadcastChannelClass = globalThis.BroadcastChannel,
  channelName = APP_DATA_EVENT_CHANNEL,
} = {}) {
  const channel = typeof BroadcastChannelClass === 'function'
    ? new BroadcastChannelClass(channelName)
    : null;
  const listeners = new Set();

  if (channel) {
    channel.onmessage = (event) => {
      const message = event?.data;
      if (!message || !SAFE_EVENT_TYPES.has(message.type)) return;
      listeners.forEach((listener) => listener(message));
    };
  }

  return {
    publish(type, metadata = {}) {
      if (!SAFE_EVENT_TYPES.has(type)) throw new Error('Unsupported persistence event type');
      const message = {
        type,
        generationId: metadata.generationId || null,
        storageKey: metadata.storageKey || null,
      };
      channel?.postMessage(message);
      listeners.forEach((listener) => listener(message));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      listeners.clear();
      channel?.close();
    },
  };
}
