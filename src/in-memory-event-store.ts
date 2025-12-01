import type { EventStore, StreamId, EventId } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Simple in-memory event store for MCP session resumability
 */
export class InMemoryEventStore implements EventStore {
  private events: Map<StreamId, Array<{ id: EventId; message: JSONRPCMessage }>> = new Map();

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    if (!this.events.has(streamId)) {
      this.events.set(streamId, []);
    }
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.events.get(streamId)!.push({ id: eventId, message });
    return eventId;
  }

  async replayEventsAfter(lastEventId: EventId, { send }: {
    send: (eventId: EventId, message: JSONRPCMessage) => Promise<void>;
  }): Promise<StreamId> {
    // Find the stream that contains the lastEventId
    for (const [streamId, events] of this.events.entries()) {
      const eventIndex = events.findIndex(event => event.id === lastEventId);
      if (eventIndex >= 0) {
        // Replay events after the lastEventId
        const eventsToReplay = events.slice(eventIndex + 1);
        for (const event of eventsToReplay) {
          await send(event.id, event.message);
        }
        return streamId;
      }
    }
    throw new Error(`Event ID ${lastEventId} not found`);
  }

  async clearSession(streamId: StreamId): Promise<void> {
    this.events.delete(streamId);
  }
}
