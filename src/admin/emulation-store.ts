import { randomUUID } from "node:crypto";

import type BetterSqlite3 from "better-sqlite3";

export interface EmulationMessage {
  id: string;
  thread_id: string;
  sender: string;
  content: string;
  direction: "inbound" | "outbound";
  source_type: "text" | "reaction" | "image";
  created_at: string;
}

export class EmulationStore {
  public active = false;

  private readonly db: BetterSqlite3.Database;

  public constructor(db: BetterSqlite3.Database) {
    this.db = db;
  }

  public recordInbound(
    entityId: string,
    threadId: string,
    content: string,
    sourceType: "text" | "reaction" | "image" = "text",
  ): EmulationMessage {
    const message: EmulationMessage = {
      id: randomUUID(),
      thread_id: threadId,
      sender: entityId,
      content,
      direction: "inbound",
      source_type: sourceType,
      created_at: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO emulation_messages (id, thread_id, sender, content, direction, source_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.thread_id,
        message.sender,
        message.content,
        message.direction,
        message.source_type,
        message.created_at,
      );

    return message;
  }

  public recordOutbound(
    threadId: string,
    content: string,
    _concerning: string[],
  ): EmulationMessage {
    const message: EmulationMessage = {
      id: randomUUID(),
      thread_id: threadId,
      sender: "assistant",
      content,
      direction: "outbound",
      source_type: "text",
      created_at: new Date().toISOString(),
    };

    this.db
      .prepare(
        `INSERT INTO emulation_messages (id, thread_id, sender, content, direction, source_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.thread_id,
        message.sender,
        message.content,
        message.direction,
        message.source_type,
        message.created_at,
      );

    return message;
  }

  public getMessages(threadId: string, since?: string): EmulationMessage[] {
    if (since) {
      return this.db
        .prepare(
          `SELECT id, thread_id, sender, content, direction, source_type, created_at
           FROM emulation_messages
           WHERE thread_id = ? AND created_at > ?
           ORDER BY created_at ASC`,
        )
        .all(threadId, since) as EmulationMessage[];
    }

    return this.db
      .prepare(
        `SELECT id, thread_id, sender, content, direction, source_type, created_at
         FROM emulation_messages
         WHERE thread_id = ?
         ORDER BY created_at ASC`,
      )
      .all(threadId) as EmulationMessage[];
  }

  public getAllMessages(): EmulationMessage[] {
    return this.db
      .prepare(
        `SELECT id, thread_id, sender, content, direction, source_type, created_at
         FROM emulation_messages
         ORDER BY created_at ASC`,
      )
      .all() as EmulationMessage[];
  }

  public clearAll(): void {
    this.db.prepare("DELETE FROM emulation_messages").run();
  }
}
