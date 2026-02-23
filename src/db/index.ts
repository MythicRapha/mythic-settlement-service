import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "../config/index.js";

let db: Database.Database;

export function initDb(): Database.Database {
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS posted_roots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      l2_slot INTEGER NOT NULL UNIQUE,
      state_root TEXT NOT NULL,
      tx_count INTEGER NOT NULL,
      l1_signature TEXT NOT NULL,
      posted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watcher_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

export function getLastPostedSlot(): number {
  const row = getDb()
    .prepare("SELECT value FROM watcher_state WHERE key = 'last_posted_slot'")
    .get() as { value: string } | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

export function setLastPostedSlot(slot: number): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO watcher_state (key, value) VALUES ('last_posted_slot', ?)"
    )
    .run(slot.toString());
}

export function getLastStateRoot(): Buffer {
  const row = getDb()
    .prepare("SELECT value FROM watcher_state WHERE key = 'last_state_root'")
    .get() as { value: string } | undefined;
  return row ? Buffer.from(row.value, "hex") : Buffer.alloc(32);
}

export function setLastStateRoot(root: Buffer): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO watcher_state (key, value) VALUES ('last_state_root', ?)"
    )
    .run(root.toString("hex"));
}

export function recordPostedRoot(
  l2Slot: number,
  stateRoot: string,
  txCount: number,
  l1Signature: string
): void {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO posted_roots (l2_slot, state_root, tx_count, l1_signature) VALUES (?, ?, ?, ?)"
    )
    .run(l2Slot, stateRoot, txCount, l1Signature);
}
