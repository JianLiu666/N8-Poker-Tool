import path from 'path';
import { SqliteManager } from '../database/sqlite-manager';
import { ChartCalculator } from '../charts/chart-calculator';
import { ChartGenerator } from '../charts/chart-generator';
import { ChartCommandOptions, FinalStatistics, ChartGenerationResult, PokerHand } from '../types';
import { DATABASE, CHARTS, LOG_EMOJIS } from '../constants';
import { createError } from '../utils';

interface ChartResults {
  streetAnalysisResult: ChartGenerationResult;
  combinedPositionAnalysisResult: ChartGenerationResult;
}

export class ChartCommand {
  private readonly sqliteManager: SqliteManager;
  private readonly chartCalculator: ChartCalculator;
  private readonly chartGenerator: ChartGenerator;
  private readonly options: ChartCommandOptions;

  constructor(options: ChartCommandOptions) {
    this.options = options;
    const dbPath = options.dbPath || path.join(process.cwd(), DATABASE.DEFAULT_PATH);
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
      const interval = this.options.interval || CHARTS.DEFAULT_SAMPLING_INTERVAL;
      const streetProfitData = this.chartCalculator.calculateStreetProfitAnalysisChartData(hands);
      const actionAnalysisData = this.chartCalculator.calculateActionAnalysisChartData(hands);
      const combinedPositionData = this.chartCalculator.calculateCombinedPositionData(hands, interval);
      const chartResults = await this.generateCharts(streetProfitData, actionAnalysisData, combinedPositionData);
      const statistics = this.getBasicStatistics(hands);

      // Output results
      this.logResults(chartResults, statistics);
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
  private async getHandsData(): Promise<PokerHand[]> {
    try {
      return await this.sqliteManager.getPokerHandsForChart(this.options?.dateRange);
    } catch (error) {
      throw createError('Failed to fetch poker hands for chart', error as Error);
    }
  }

  /**
   * Get basic statistics for display
   */
  private getBasicStatistics(hands: PokerHand[]): FinalStatistics {
    const totalHands = hands.length;
    
    if (totalHands === 0) {
      return {
        totalHands: 0,
        statistics: {
          profitWithoutRake: 0,
          actualProfit: 0,
          rakeImpact: 0,
          showdownProfit: 0,
          noShowdownProfit: 0,
          bb100WithoutRake: 0,
          bb100Actual: 0,
          bb100Showdown: 0,
          bb100NoShowdown: 0
        }
      };
    }

    // Calculate basic statistics from hands
    let totalProfit = 0;
    let totalRake = 0;
    let showdownProfit = 0;
    let noShowdownProfit = 0;
    let totalBigBlinds = 0;

    hands.forEach(hand => {
      totalProfit += hand.hero_profit;
      totalRake += (hand.hero_profit > 0 ? hand.hero_rake : 0);
      totalBigBlinds += hand.big_blind;
      
      if (hand.hero_hand_result.includes('showdown')) {
        showdownProfit += hand.hero_profit;
      } else {
        noShowdownProfit += hand.hero_profit;
      }
    });

    const profitWithoutRake = totalProfit + totalRake;
    const bb100Actual = totalBigBlinds > 0 ? (totalProfit / totalBigBlinds) * 100 : 0;
    const bb100WithoutRake = totalBigBlinds > 0 ? (profitWithoutRake / totalBigBlinds) * 100 : 0;
    const bb100Showdown = totalBigBlinds > 0 ? (showdownProfit / totalBigBlinds) * 100 : 0;
    const bb100NoShowdown = totalBigBlinds > 0 ? (noShowdownProfit / totalBigBlinds) * 100 : 0;

    return {
      totalHands,
      statistics: {
        profitWithoutRake,
        actualProfit: totalProfit,
        rakeImpact: totalRake,
        showdownProfit,
        noShowdownProfit,
        bb100WithoutRake,
        bb100Actual,
        bb100Showdown,
        bb100NoShowdown
      }
    };
  }

  /**
   * Generate street analysis and combined position analysis charts
   */
  private async generateCharts(streetProfitData: any, actionAnalysisData: any, combinedPositionData: any): Promise<ChartResults> {
    const interval = this.options.interval || CHARTS.DEFAULT_SAMPLING_INTERVAL;
    
    console.log(`${LOG_EMOJIS.CHART} Generating Street Analysis chart (high resolution)...`);
    const streetAnalysisResult = await this.chartGenerator.generateStreetAnalysisChart(actionAnalysisData, streetProfitData);

    console.log(`${LOG_EMOJIS.CHART} Generating Combined Position Analysis chart (interval: ${interval} hands)...`);
    const combinedPositionAnalysisResult = await this.chartGenerator.generateCombinedPositionAnalysisChart(combinedPositionData);

    return { streetAnalysisResult, combinedPositionAnalysisResult };
  }



  /**
   * Log the results of chart generation
   */
  private logResults(chartResults: ChartResults, statistics: FinalStatistics): void {
    console.log(`${LOG_EMOJIS.CHART} Charts generated successfully:`);
    console.log(`   - Street Analysis chart: ${chartResults.streetAnalysisResult.filePath}`);
    console.log(`   - Combined Position Analysis chart: ${chartResults.combinedPositionAnalysisResult.filePath}`);
    
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
    
    console.log(`${LOG_EMOJIS.INFO} Street Analysis chart shows action analysis and profit analysis by position for each stage`);
    console.log(`${LOG_EMOJIS.INFO} Combined Position Analysis chart shows profit trends (left) and BB/100 analysis (right) for each position with 7 vertical subcharts`);
  }
} 