import { SqliteManager } from '../database/sqlite-manager';
import path from 'path';
import fs from 'fs-extra';

export interface ParseCommandOptions {
  inputDir: string;
  dbPath?: string;
}

export class ParseCommand {
  private sqliteManager: SqliteManager;

  constructor(options: ParseCommandOptions) {
    const dbPath = options.dbPath || path.join(process.cwd(), 'data', 'poker.db');
    this.sqliteManager = new SqliteManager({ dbPath });
  }

  async execute(): Promise<void> {
    try {
      console.log('🚀 Starting parse command...');
      
      // 連接資料庫
      await this.sqliteManager.connect();
      await this.sqliteManager.initializeTables();
      
      // 測試資料庫連線
      const isConnected = await this.sqliteManager.testConnection();
      if (!isConnected) {
        throw new Error('Database connection test failed');
      }

      console.log('✅ Parse command completed successfully!');
      console.log('📝 Note: Log parsing functionality will be implemented in next iteration');
      
    } catch (error) {
      console.error('❌ Parse command failed:', error);
      throw error;
    } finally {
      await this.sqliteManager.disconnect();
    }
  }
} 