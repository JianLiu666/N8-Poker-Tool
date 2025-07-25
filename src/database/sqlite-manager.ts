import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs-extra';
import { 
  DatabaseConfig, 
  PokerHand, 
  DatabaseInsertHand,
  DateRange 
} from '../types';
import { DATABASE, LOG_EMOJIS } from '../constants';
import { createError, ensureDirectoryExists } from '../utils';

export class SqliteManager {
  private db: sqlite3.Database | null = null;
  private readonly dbPath: string;

  private static readonly SQL_QUERIES = {
    TEST_CONNECTION: 'SELECT 1 as test',
    SELECT_BY_ID: `SELECT * FROM ${DATABASE.TABLE_NAME} WHERE hand_id = ?`,
    SELECT_BASIC: `SELECT * FROM ${DATABASE.TABLE_NAME}`,
    SELECT_FOR_CHART: `SELECT 
      hand_id, hand_start_time, big_blind, hero_position, hero_profit, hero_rake,
      hero_hand_result, final_stage,
      hero_preflop_actions, hero_flop_actions, hero_turn_actions, hero_river_actions
    FROM ${DATABASE.TABLE_NAME}`,
    ORDER_BY_TIME_DESC: ' ORDER BY hand_start_time DESC',
    ORDER_BY_TIME_ASC: ' ORDER BY hand_start_time ASC',
    LIMIT_CLAUSE: ' LIMIT ?',
    OFFSET_CLAUSE: ' OFFSET ?',
    DATE_RANGE_WHERE: ' WHERE hand_start_time >= ? AND hand_start_time <= ?'
  } as const;

  constructor(config: DatabaseConfig) {
    this.dbPath = config.dbPath;
  }

  async connect(): Promise<void> {
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(this.dbPath);
      await ensureDirectoryExists(dbDir);

      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            reject(createError('Failed to connect to SQLite database', err));
          } else {
            console.log(`${LOG_EMOJIS.DATABASE} Connected to SQLite database at ${this.dbPath}`);
            resolve();
          }
        });
      });
    } catch (error) {
      throw createError('Database connection setup failed', error as Error);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(createError('Failed to close database', err));
        } else {
          console.log(`${LOG_EMOJIS.DATABASE} Database connection closed`);
          this.db = null;
          resolve();
        }
      });
    });
  }

  async initializeTables(): Promise<void> {
    this.ensureConnected();

    const createTablesSQL = this.getCreateTableSQL();

    return new Promise((resolve, reject) => {
      this.db!.exec(createTablesSQL, (err) => {
        if (err) {
          reject(createError('Failed to initialize tables', err));
        } else {
          console.log(`${LOG_EMOJIS.SUCCESS} Database tables initialized successfully`);
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
      this.db!.get(SqliteManager.SQL_QUERIES.TEST_CONNECTION, (err, row) => {
        if (err) {
          console.error(`${LOG_EMOJIS.ERROR} Database connection test failed:`, err.message);
          resolve(false);
        } else {
          console.log(`${LOG_EMOJIS.SUCCESS} Database connection test passed`);
          resolve(true);
        }
      });
    });
  }

  private ensureConnected(): void {
    if (!this.db) {
      throw new Error('Database not connected');
    }
  }

  getDatabase(): sqlite3.Database {
    this.ensureConnected();
    return this.db!;
  }

  async insertPokerHand(hand: DatabaseInsertHand): Promise<number> {
    this.ensureConnected();

    const sql = this.getInsertHandSQL();
    const params = this.buildInsertParams(hand);

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) {
          reject(createError('Failed to insert poker hand', err));
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getPokerHands(limit?: number, offset?: number): Promise<PokerHand[]> {
    this.ensureConnected();

    const { sql, params } = this.buildSelectQuery(limit, offset);

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(createError('Failed to get poker hands', err));
        } else {
          resolve(rows as PokerHand[]);
        }
      });
    });
  }

  async getPokerHandById(handId: string): Promise<PokerHand | null> {
    this.ensureConnected();

    return new Promise((resolve, reject) => {
      this.db!.get(SqliteManager.SQL_QUERIES.SELECT_BY_ID, [handId], (err, row) => {
        if (err) {
          reject(createError('Failed to get poker hand', err));
        } else {
          resolve(row as PokerHand || null);
        }
      });
    });
  }

  /**
   * Gets poker hands ordered by time (oldest to newest) for chart generation
   */
  async getPokerHandsForChart(dateRange?: DateRange): Promise<PokerHand[]> {
    this.ensureConnected();

    const { sql, params } = this.buildChartQuery(dateRange);

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(createError('Failed to get poker hands for chart', err));
        } else {
          resolve(rows as PokerHand[]);
        }
      });
    });
  }

  /**
   * Builds the CREATE TABLE SQL statement with optimized indexes
   */
  private getCreateTableSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${DATABASE.TABLE_NAME} (
        -- Auto-incrementing primary key
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Unique hand identifier (e.g., RC3723984611)
        hand_id TEXT UNIQUE NOT NULL,
        
        -- Hand start time (format: 2025/07/13 17:40:12)
        hand_start_time DATETIME NOT NULL,
        
        -- Game type (Rush & Cash or Cash Game)
        game_type TEXT NOT NULL,
        
        -- Small blind amount (e.g., 0.05)
        small_blind REAL NOT NULL,
        
        -- Big blind amount (e.g., 0.1)
        big_blind REAL NOT NULL,
        
        -- Hero's position (6-max: UTG, HJ, CO, BTN, SB, BB)
        hero_position TEXT NOT NULL,
        
        -- Hero's hole cards (e.g., "Ah 2s")
        hero_hole_cards TEXT NOT NULL,
        
        -- Flop cards (e.g., "3c Th 7d")
        flop_cards TEXT DEFAULT '',
        
        -- Turn card (e.g., "2d")
        turn_card TEXT DEFAULT '',
        
        -- River card (e.g., "Tc")
        river_card TEXT DEFAULT '',
        
        -- Hero's investment amounts by street
        hero_preflop_investment REAL DEFAULT 0,
        hero_flop_investment REAL DEFAULT 0,
        hero_turn_investment REAL DEFAULT 0,
        hero_river_investment REAL DEFAULT 0,
        
        -- Hero's action sequences (X=check, B=bet, C=call, R=raise, F=fold)
        hero_preflop_actions TEXT DEFAULT '',
        hero_flop_actions TEXT DEFAULT '',
        hero_turn_actions TEXT DEFAULT '',
        hero_river_actions TEXT DEFAULT '',
        
        -- Financial data
        pot_amount REAL DEFAULT 0,
        jackpot_amount REAL DEFAULT 0,
        hero_profit REAL DEFAULT 0,
        hero_rake REAL DEFAULT 0,
        
        -- Hand result and final stage
        hero_hand_result TEXT NOT NULL,
        final_stage TEXT NOT NULL,
        
        -- Record creation timestamp
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_hand_start_time ON ${DATABASE.TABLE_NAME}(hand_start_time);
      CREATE INDEX IF NOT EXISTS idx_hero_position ON ${DATABASE.TABLE_NAME}(hero_position);
      CREATE INDEX IF NOT EXISTS idx_final_stage ON ${DATABASE.TABLE_NAME}(final_stage);
      CREATE INDEX IF NOT EXISTS idx_hero_hand_result ON ${DATABASE.TABLE_NAME}(hero_hand_result);
    `;
  }

  /**
   * Builds the INSERT SQL statement for poker hands
   */
  private getInsertHandSQL(): string {
    return `
      INSERT OR IGNORE INTO ${DATABASE.TABLE_NAME} (
        hand_id, hand_start_time, game_type, small_blind, big_blind,
        hero_position, hero_hole_cards, flop_cards, turn_card, river_card,
        hero_preflop_investment, hero_flop_investment, hero_turn_investment, hero_river_investment,
        hero_preflop_actions, hero_flop_actions, hero_turn_actions, hero_river_actions,
        pot_amount, jackpot_amount, hero_profit, hero_rake, hero_hand_result, final_stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
  }

  /**
   * Builds parameter array for INSERT statement
   */
  private buildInsertParams(hand: DatabaseInsertHand): any[] {
    return [
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
    ];
  }

  /**
   * Builds SELECT query with optional pagination
   */
  private buildSelectQuery(limit?: number, offset?: number): { sql: string; params: any[] } {
    let sql = SqliteManager.SQL_QUERIES.SELECT_BASIC + SqliteManager.SQL_QUERIES.ORDER_BY_TIME_DESC;
    const params: any[] = [];

    if (limit) {
      sql += SqliteManager.SQL_QUERIES.LIMIT_CLAUSE;
      params.push(limit);
    }

    if (offset) {
      sql += SqliteManager.SQL_QUERIES.OFFSET_CLAUSE;
      params.push(offset);
    }

    return { sql, params };
  }

  /**
   * Builds SELECT query for chart data with optional date filtering and optimized fields
   */
  private buildChartQuery(dateRange?: DateRange): { sql: string; params: any[] } {
    let sql = SqliteManager.SQL_QUERIES.SELECT_FOR_CHART;
    const params: any[] = [];

    if (dateRange) {
      sql += SqliteManager.SQL_QUERIES.DATE_RANGE_WHERE;
      params.push(dateRange.start, dateRange.end);
    }

    sql += SqliteManager.SQL_QUERIES.ORDER_BY_TIME_ASC; // Oldest to newest for charts

    return { sql, params };
  }
} 