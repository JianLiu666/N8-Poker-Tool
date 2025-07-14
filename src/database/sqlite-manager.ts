import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs-extra';

export interface DatabaseConfig {
  dbPath: string;
}

export interface PokerHand {
  id?: number;
  hand_id: string;
  hand_start_time: string;
  game_type: string;
  small_blind: number;
  big_blind: number;
  hero_position: string;
  hero_hole_cards: string;
  flop_cards: string;
  turn_card: string;
  river_card: string;
  hero_preflop_investment: number;
  hero_flop_investment: number;
  hero_turn_investment: number;
  hero_river_investment: number;
  hero_preflop_actions: string;
  hero_flop_actions: string;
  hero_turn_actions: string;
  hero_river_actions: string;
  pot_amount: number;
  jackpot_amount: number;
  hero_profit: number;
  hero_rake: number;
  hero_hand_result: string;
  final_stage: string;
  created_at?: string;
}

export enum GameType {
  RUSH_AND_CASH = 'Rush & Cash',
  CASH_GAME = 'Cash Game'
}

export enum HandResult {
  SHOWDOWN_WIN = 'showdown_win',
  SHOWDOWN_LOSS = 'showdown_loss',
  NO_SHOWDOWN_WIN = 'no_showdown_win',
  NO_SHOWDOWN_LOSS = 'no_showdown_loss'
}

export enum FinalStage {
  PREFLOP = 'preflop',
  FLOP = 'flop',
  TURN = 'turn',
  RIVER = 'river',
  SHOWDOWN = 'showdown'
}

export enum PokerPosition {
  UTG = 'UTG',        // Under The Gun
  HJ = 'HJ',          // Hijack
  CO = 'CO',          // Cutoff
  BTN = 'BTN',        // Button
  SB = 'SB',          // Small Blind
  BB = 'BB'           // Big Blind
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
      CREATE TABLE IF NOT EXISTS poker_hands (
        -- 自動遞增的主鍵
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- 牌局唯一識別碼 (例如: RC3723984611)
        hand_id TEXT UNIQUE NOT NULL,
        
        -- 牌局開始時間 (格式: 2025/07/13 17:40:12)
        hand_start_time DATETIME NOT NULL,
        
        -- 牌局類型 (Rush & Cash 或 Cash Game)
        game_type TEXT NOT NULL,
        
        -- 小盲金額 (例如: 0.05)
        small_blind REAL NOT NULL,
        
        -- 大盲金額 (例如: 0.1)
        big_blind REAL NOT NULL,
        
        -- Hero 的座位位置 (六人桌: UTG, HJ, CO, BTN, SB, BB)
        hero_position TEXT NOT NULL,
        
        -- Hero 的底牌 (例如: "Ah 2s")
        hero_hole_cards TEXT NOT NULL,
        
        -- Flop 開出的三張牌 (例如: "3c Th 7d")
        flop_cards TEXT DEFAULT '',
        
        -- Turn 開出的一張牌 (例如: "2d")
        turn_card TEXT DEFAULT '',
        
        -- River 開出的一張牌 (例如: "Tc")
        river_card TEXT DEFAULT '',
        
        -- Hero 在 Preflop 階段的總投入金額
        hero_preflop_investment REAL DEFAULT 0,
        
        -- Hero 在 Flop 階段的總投入金額
        hero_flop_investment REAL DEFAULT 0,
        
        -- Hero 在 Turn 階段的總投入金額
        hero_turn_investment REAL DEFAULT 0,
        
        -- Hero 在 River 階段的總投入金額
        hero_river_investment REAL DEFAULT 0,
        
        -- Hero 在 Preflop 的動作序列 (X=check, B=bet, C=call, R=raise, F=fold)
        hero_preflop_actions TEXT DEFAULT '',
        
        -- Hero 在 Flop 的動作序列 (X=check, B=bet, C=call, R=raise, F=fold)
        hero_flop_actions TEXT DEFAULT '',
        
        -- Hero 在 Turn 的動作序列 (X=check, B=bet, C=call, R=raise, F=fold)
        hero_turn_actions TEXT DEFAULT '',
        
        -- Hero 在 River 的動作序列 (X=check, B=bet, C=call, R=raise, F=fold)
        hero_river_actions TEXT DEFAULT '',
        
        -- 底池總金額 (未扣除 rake 和 jackpot 的金額)
        pot_amount REAL DEFAULT 0,
        
        -- Jackpot 金額
        jackpot_amount REAL DEFAULT 0,
        
        -- Hero 在此牌局的實際盈利 (正數為贏錢，負數為輸錢)
        hero_profit REAL DEFAULT 0,
        
        -- Hero 在此牌局被抽的水 (只有贏錢時才會有 rake)
        hero_rake REAL DEFAULT 0,
        
        -- Hero 的牌局結果 (showdown_win, showdown_loss, no_showdown_win, no_showdown_loss)
        hero_hand_result TEXT NOT NULL,
        
        -- 牌局最終停在哪個階段 (preflop, flop, turn, river, showdown)
        final_stage TEXT NOT NULL,
        
        -- 記錄建立時間
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  async insertPokerHand(hand: Omit<PokerHand, 'id' | 'created_at'>): Promise<number> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const sql = `
      INSERT INTO poker_hands (
        hand_id, hand_start_time, game_type, small_blind, big_blind,
        hero_position, hero_hole_cards, flop_cards, turn_card, river_card,
        hero_preflop_investment, hero_flop_investment, hero_turn_investment, hero_river_investment,
        hero_preflop_actions, hero_flop_actions, hero_turn_actions, hero_river_actions,
        pot_amount, jackpot_amount, hero_profit, hero_rake, hero_hand_result, final_stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db!.run(sql, [
        hand.hand_id,
        hand.hand_start_time,
        hand.game_type,
        hand.small_blind,
        hand.big_blind,
        hand.hero_position,
        hand.hero_hole_cards,
        hand.flop_cards,
        hand.turn_card,
        hand.river_card,
        hand.hero_preflop_investment,
        hand.hero_flop_investment,
        hand.hero_turn_investment,
        hand.hero_river_investment,
        hand.hero_preflop_actions,
        hand.hero_flop_actions,
        hand.hero_turn_actions,
        hand.hero_river_actions,
        hand.pot_amount,
        hand.jackpot_amount,
        hand.hero_profit,
        hand.hero_rake,
        hand.hero_hand_result,
        hand.final_stage
      ], function(err) {
        if (err) {
          reject(new Error(`Failed to insert poker hand: ${err.message}`));
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getPokerHands(limit?: number, offset?: number): Promise<PokerHand[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    let sql = 'SELECT * FROM poker_hands ORDER BY hand_start_time DESC';
    const params: any[] = [];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    if (offset) {
      sql += ' OFFSET ?';
      params.push(offset);
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(new Error(`Failed to get poker hands: ${err.message}`));
        } else {
          resolve(rows as PokerHand[]);
        }
      });
    });
  }

  async getPokerHandById(handId: string): Promise<PokerHand | null> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const sql = 'SELECT * FROM poker_hands WHERE hand_id = ?';

    return new Promise((resolve, reject) => {
      this.db!.get(sql, [handId], (err, row) => {
        if (err) {
          reject(new Error(`Failed to get poker hand: ${err.message}`));
        } else {
          resolve(row as PokerHand || null);
        }
      });
    });
  }
} 