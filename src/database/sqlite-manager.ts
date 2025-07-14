import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs-extra';

export interface DatabaseConfig {
  dbPath: string;
}

export class SqliteManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(config: DatabaseConfig) {
    this.dbPath = config.dbPath;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 確保資料庫目錄存在
      const dbDir = path.dirname(this.dbPath);
      fs.ensureDirSync(dbDir);

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to connect to SQLite database: ${err.message}`));
        } else {
          console.log(`Connected to SQLite database at ${this.dbPath}`);
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(new Error(`Failed to close database: ${err.message}`));
          } else {
            console.log('Database connection closed');
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async initializeTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS poker_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        game_type TEXT NOT NULL,
        stakes TEXT NOT NULL,
        table_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS poker_hands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        hand_id TEXT UNIQUE NOT NULL,
        hand_number INTEGER NOT NULL,
        timestamp DATETIME NOT NULL,
        position TEXT,
        hole_cards TEXT,
        result REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES poker_sessions(session_id)
      );

      CREATE TABLE IF NOT EXISTS poker_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hand_id TEXT NOT NULL,
        action_sequence INTEGER NOT NULL,
        street TEXT NOT NULL,
        action_type TEXT NOT NULL,
        amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hand_id) REFERENCES poker_hands(hand_id)
      );
    `;

    return new Promise((resolve, reject) => {
      this.db!.exec(createTablesSQL, (err) => {
        if (err) {
          reject(new Error(`Failed to initialize tables: ${err.message}`));
        } else {
          console.log('Database tables initialized successfully');
          resolve();
        }
      });
    });
  }

  async testConnection(): Promise<boolean> {
    if (!this.db) {
      return false;
    }

    return new Promise((resolve) => {
      this.db!.get('SELECT 1 as test', (err, row) => {
        if (err) {
          console.error('Database connection test failed:', err.message);
          resolve(false);
        } else {
          console.log('Database connection test passed');
          resolve(true);
        }
      });
    });
  }

  getDatabase(): sqlite3.Database {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }
} 