import { SqliteManager } from '../database/sqlite-manager';
import { ChartCalculator } from '../charts/chart-calculator';
import { ChartGenerator } from '../charts/chart-generator';
import { ChartCommandOptions } from '../charts/chart-types';
import path from 'path';

// Re-export the ChartCommandOptions for backward compatibility
export { ChartCommandOptions } from '../charts/chart-types';

export class ChartCommand {
  private sqliteManager: SqliteManager;
  private chartCalculator: ChartCalculator;
  private chartGenerator: ChartGenerator;
  private options: ChartCommandOptions;

  constructor(options: ChartCommandOptions) {
    this.options = options;
    const dbPath = options.dbPath || path.join(process.cwd(), 'data', 'poker.db');
    const outputDir = options.outputDir || path.join(process.cwd(), 'charts');
    
    this.sqliteManager = new SqliteManager({ dbPath });
    this.chartCalculator = new ChartCalculator();
    this.chartGenerator = new ChartGenerator(outputDir);
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

      // 獲取手牌數據
      const hands = await this.sqliteManager.getPokerHandsForChart(this.options?.dateRange);
      
      if (hands.length === 0) {
        console.log('⚠️  No poker hands found in the database');
        return;
      }

      console.log(`📈 Processing ${hands.length} hands for chart generation...`);

      // 計算數據
      const interval = this.options.interval || 1;
      
      const profitData = this.chartCalculator.calculateProfitData(hands, interval);
      const bb100Data = this.chartCalculator.calculateBB100Data(hands, interval);

      // 獲取統計數據
      const statistics = this.chartCalculator.getFinalStatistics(profitData, bb100Data);

      // 生成圖表
      console.log(`📊 Generating profit trend chart (interval: ${interval} hands)...`);
      const profitChartResult = await this.chartGenerator.generateProfitChart(profitData);
      
      console.log(`📊 Generating BB/100 trend chart (interval: ${interval} hands)...`);
      const bb100ChartResult = await this.chartGenerator.generateBB100Chart(bb100Data);

      // 輸出結果
      this.logResults(profitChartResult, bb100ChartResult, statistics);

      console.log('✅ Chart command completed successfully!');
      
    } catch (error) {
      console.error('❌ Chart command failed:', error);
      throw error;
    } finally {
      await this.sqliteManager.disconnect();
    }
  }

  private logResults(profitResult: any, bb100Result: any, statistics: any): void {
    console.log(`📈 Charts generated successfully:`);
    console.log(`   - Profit chart: ${profitResult.filePath}`);
    console.log(`   - BB/100 chart: ${bb100Result.filePath}`);
    console.log(`📊 Chart statistics:`);
    console.log(`   - Total hands: ${statistics.totalHands}`);
    
    if (statistics.totalHands > 0) {
      console.log(`   - Profit without rake: ${statistics.statistics.profitWithoutRake}`);
      console.log(`   - Actual profit (after rake): ${statistics.statistics.actualProfit}`);
      console.log(`   - Rake total impact: ${statistics.statistics.rakeImpact.toFixed(2)}`);
      console.log(`   - Final showdown profit: ${statistics.statistics.showdownProfit}`);
      console.log(`   - Final no-showdown profit: ${statistics.statistics.noShowdownProfit}`);
      console.log(`   - BB/100 without rake: ${statistics.statistics.bb100WithoutRake.toFixed(2)}`);
      console.log(`   - BB/100 actual: ${statistics.statistics.bb100Actual.toFixed(2)}`);
      console.log(`   - BB/100 showdown: ${statistics.statistics.bb100Showdown.toFixed(2)}`);
      console.log(`   - BB/100 no-showdown: ${statistics.statistics.bb100NoShowdown.toFixed(2)}`);
    }
  }
} 