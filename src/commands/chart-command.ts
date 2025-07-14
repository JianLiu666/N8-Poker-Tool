import path from 'path';
import { SqliteManager } from '../database/sqlite-manager';
import { ChartCalculator } from '../charts/chart-calculator';
import { ChartGenerator } from '../charts/chart-generator';
import { ChartCommandOptions, FinalStatistics } from '../types';
import { DATABASE, CHARTS, LOG_EMOJIS } from '../constants';
import { createError } from '../utils';

export class ChartCommand {
  private sqliteManager: SqliteManager;
  private chartCalculator: ChartCalculator;
  private chartGenerator: ChartGenerator;
  private options: ChartCommandOptions;

  constructor(options: ChartCommandOptions) {
    this.options = options;
    const dbPath = options.dbPath || path.join(process.cwd(), 'data', DATABASE.DEFAULT_PATH.split('/').pop()!);
    const outputDir = options.outputDir || path.join(process.cwd(), CHARTS.DEFAULT_OUTPUT_DIR.substring(2));
    
    this.sqliteManager = new SqliteManager({ dbPath });
    this.chartCalculator = new ChartCalculator();
    this.chartGenerator = new ChartGenerator(outputDir);
  }

  async execute(): Promise<void> {
    try {
      console.log(`${LOG_EMOJIS.CHART} Starting chart command...`);
      
      await this.initializeDatabase();
      const hands = await this.getHandsData();
      
      if (hands.length === 0) {
        console.log(`${LOG_EMOJIS.WARNING} No poker hands found in the database`);
        return;
      }

      console.log(`${LOG_EMOJIS.CHART} Processing ${hands.length} hands for chart generation...`);

      // Calculate data and generate charts
      const { profitData, bb100Data } = this.calculateChartData(hands);
      const { profitResult, bb100Result } = await this.generateCharts(profitData, bb100Data);
      const statistics = this.chartCalculator.getFinalStatistics(profitData, bb100Data);

      // Output results
      this.logResults(profitResult, bb100Result, statistics);
      console.log(`${LOG_EMOJIS.SUCCESS} Chart command completed successfully!`);
      
    } catch (error) {
      console.error(`${LOG_EMOJIS.ERROR} Chart command failed:`, error);
      throw error;
    } finally {
      await this.sqliteManager.disconnect();
    }
  }

  /**
   * Initialize database connection and test it
   */
  private async initializeDatabase(): Promise<void> {
    await this.sqliteManager.connect();
    
    const isConnected = await this.sqliteManager.testConnection();
    if (!isConnected) {
      throw createError('Database connection test failed', 'Connection test returned false');
    }
  }

  /**
   * Get hands data from database
   */
  private async getHandsData() {
    try {
      return await this.sqliteManager.getPokerHandsForChart(this.options?.dateRange);
    } catch (error) {
      throw createError('Failed to fetch poker hands for chart', error as Error);
    }
  }

  /**
   * Calculate chart data using the chart calculator
   */
  private calculateChartData(hands: any[]) {
    const interval = this.options.interval || CHARTS.DEFAULT_SAMPLING_INTERVAL;
    
    const profitData = this.chartCalculator.calculateProfitData(hands, interval);
    const bb100Data = this.chartCalculator.calculateBB100Data(hands, interval);

    return { profitData, bb100Data };
  }

  /**
   * Generate both profit and BB/100 charts
   */
  private async generateCharts(profitData: any, bb100Data: any) {
    const interval = this.options.interval || CHARTS.DEFAULT_SAMPLING_INTERVAL;
    
    console.log(`${LOG_EMOJIS.CHART} Generating profit trend chart (interval: ${interval} hands)...`);
    const profitResult = await this.chartGenerator.generateProfitChart(profitData);
    
    console.log(`${LOG_EMOJIS.CHART} Generating BB/100 trend chart (interval: ${interval} hands)...`);
    const bb100Result = await this.chartGenerator.generateBB100Chart(bb100Data);

    return { profitResult, bb100Result };
  }

  /**
   * Log the results of chart generation
   */
  private logResults(profitResult: any, bb100Result: any, statistics: FinalStatistics): void {
    console.log(`${LOG_EMOJIS.CHART} Charts generated successfully:`);
    console.log(`   - Profit chart: ${profitResult.filePath}`);
    console.log(`   - BB/100 chart: ${bb100Result.filePath}`);
    
    this.logStatistics(statistics);
  }

  /**
   * Log detailed statistics
   */
  private logStatistics(statistics: FinalStatistics): void {
    console.log(`${LOG_EMOJIS.CHART} Chart statistics:`);
    console.log(`   - Total hands: ${statistics.totalHands}`);
    
    if (statistics.totalHands > 0) {
      const stats = statistics.statistics;
      console.log(`   - Profit without rake: ${stats.profitWithoutRake}`);
      console.log(`   - Actual profit (after rake): ${stats.actualProfit}`);
      console.log(`   - Rake total impact: ${stats.rakeImpact.toFixed(2)}`);
      console.log(`   - Final showdown profit: ${stats.showdownProfit}`);
      console.log(`   - Final no-showdown profit: ${stats.noShowdownProfit}`);
      console.log(`   - BB/100 without rake: ${stats.bb100WithoutRake.toFixed(2)}`);
      console.log(`   - BB/100 actual: ${stats.bb100Actual.toFixed(2)}`);
      console.log(`   - BB/100 showdown: ${stats.bb100Showdown.toFixed(2)}`);
      console.log(`   - BB/100 no-showdown: ${stats.bb100NoShowdown.toFixed(2)}`);
    }
  }
} 