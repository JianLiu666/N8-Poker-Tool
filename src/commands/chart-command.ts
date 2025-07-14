import { SqliteManager } from '../database/sqlite-manager';
import path from 'path';

export interface ChartCommandOptions {
  dbPath?: string;
  outputDir?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export class ChartCommand {
  private sqliteManager: SqliteManager;
  private outputDir: string;

  constructor(options: ChartCommandOptions) {
    const dbPath = options.dbPath || path.join(process.cwd(), 'data', 'poker.db');
    this.sqliteManager = new SqliteManager({ dbPath });
    this.outputDir = options.outputDir || path.join(process.cwd(), 'charts');
  }

  async execute(): Promise<void> {
    try {
      console.log('📊 Starting chart command...');
      
      // 連接資料庫
      await this.sqliteManager.connect();
      
      // 測試資料庫連線
      const isConnected = await this.sqliteManager.testConnection();
      if (!isConnected) {
        throw new Error('Database connection test failed');
      }

      console.log('✅ Chart command completed successfully!');
      console.log('📈 Note: Chart generation functionality will be implemented in next iteration');
      
    } catch (error) {
      console.error('❌ Chart command failed:', error);
      throw error;
    } finally {
      await this.sqliteManager.disconnect();
    }
  }
} 