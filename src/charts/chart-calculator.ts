import { PokerHand, HandResult } from '../types';
import { 
  ChartDataPoint, 
  ProfitChartData, 
  BB100ChartData, 
  FinalStatistics,
  StatisticsData,
  StreetProfitStats,
  StreetProfitBarData
} from './chart-types';
import { CHARTS } from '../constants';
import { roundToDecimals, isShowdownResult } from '../utils';

export class ChartCalculator {
  
  /**
   * Calculate cumulative profit data with smoothing
   */
  calculateProfitData(hands: PokerHand[], smoothInterval: number = CHARTS.DEFAULT_SAMPLING_INTERVAL): ProfitChartData {
    return this.calculateSmoothProfitData(hands, smoothInterval);
  }

  /**
   * Calculate BB/100 data with smoothing
   */
  calculateBB100Data(hands: PokerHand[], smoothInterval: number = CHARTS.DEFAULT_BB100_INTERVAL): BB100ChartData {
    return this.calculateSmoothBB100Data(hands, smoothInterval);
  }

  /**
   * Calculate street-based profit statistics for bar chart
   */
  calculateStreetProfitData(hands: PokerHand[]): StreetProfitBarData {
    const dataPoints: StreetProfitStats[] = [];
    
    // Define the exact order you want
    const categories = [
      { street: 'preflop', result: 'win', label: 'Preflop Win' },
      { street: 'preflop', result: 'loss', label: 'Preflop Loss' },
      { street: 'flop', result: 'win', label: 'Flop Win' },
      { street: 'flop', result: 'loss', label: 'Flop Loss' },
      { street: 'turn', result: 'win', label: 'Turn Win' },
      { street: 'turn', result: 'loss', label: 'Turn Loss' },
      { street: 'river', result: 'win', label: 'River Win' },
      { street: 'river', result: 'loss', label: 'River Loss' },
      { street: 'showdown', result: 'win', label: 'Showdown Win' },
      { street: 'showdown', result: 'loss', label: 'Showdown Loss' }
    ];
    
    for (const category of categories) {
      const filteredHands = hands.filter(hand => {
        // Match street
        if (hand.final_stage !== category.street) return false;
        
        // Match result (win/loss)
        if (category.result === 'win') {
          return hand.hero_hand_result === 'showdown_win' || hand.hero_hand_result === 'no_showdown_win';
        } else {
          return hand.hero_hand_result === 'showdown_loss' || hand.hero_hand_result === 'no_showdown_loss';
        }
      });
      
      const totalProfit = filteredHands.reduce((sum, hand) => sum + hand.hero_profit, 0);
      
      dataPoints.push({
        category: category.label,
        totalProfit: roundToDecimals(totalProfit, 2),
        handCount: filteredHands.length
      });
    }
    
    return { dataPoints };
  }

  /**
   * Get final statistics from chart data
   */
  getFinalStatistics(profitData: ProfitChartData, bb100Data: BB100ChartData): FinalStatistics {
    const totalHands = profitData.allHandsWithRake.length;
    
    if (totalHands === 0) {
      return { totalHands: 0, statistics: this.createEmptyStatistics() };
    }

    const lastProfitIndex = totalHands - 1;
    const lastBB100Index = bb100Data.allHandsWithRakeBB100.length - 1;
    
    return {
      totalHands,
      statistics: this.buildStatistics(profitData, bb100Data, lastProfitIndex, lastBB100Index)
    };
  }

  /**
   * Calculate smooth profit data with interval-based averaging
   */
  private calculateSmoothProfitData(hands: PokerHand[], interval: number): ProfitChartData {
    const result: ProfitChartData = {
      allHandsWithRake: [],
      allHandsActual: [],
      showdownOnly: [],
      noShowdownOnly: []
    };

    let cumulativeStats = this.initializeCumulativeStats();
    let intervalAccumulator = this.initializeIntervalAccumulator();

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      
      // Update cumulative stats
      this.updateCumulativeStats(cumulativeStats, hand);
      
      // Accumulate for interval averaging
      this.accumulateIntervalData(intervalAccumulator, cumulativeStats);

      // Check if we should create a data point
      if (this.shouldCreateDataPoint(handNumber, interval, index, hands.length)) {
        this.addProfitDataPoints(
          result, 
          intervalAccumulator, 
          handNumber, 
          hand.hand_start_time
        );
        intervalAccumulator = this.initializeIntervalAccumulator();
      }
    });

    return result;
  }

  /**
   * Calculate smooth BB/100 data with interval-based averaging
   */
  private calculateSmoothBB100Data(hands: PokerHand[], interval: number): BB100ChartData {
    const result: BB100ChartData = {
      allHandsWithRakeBB100: [],
      allHandsActualBB100: [],
      showdownOnlyBB100: [],
      noShowdownOnlyBB100: []
    };

    let cumulativeStats = this.initializeCumulativeStats();
    let cumulativeBigBlinds = 0;
    let intervalAccumulator = this.initializeBB100Accumulator();

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      
      // Update cumulative stats
      this.updateCumulativeStats(cumulativeStats, hand);
      cumulativeBigBlinds += hand.big_blind;
      
      // Calculate current BB/100 values
      const currentBB100 = this.calculateCurrentBB100(cumulativeStats, cumulativeBigBlinds);
      
      // Accumulate for interval averaging
      this.accumulateBB100Data(intervalAccumulator, currentBB100);

      // Check if we should create a data point
      if (this.shouldCreateDataPoint(handNumber, interval, index, hands.length)) {
        this.addBB100DataPoints(
          result, 
          intervalAccumulator, 
          handNumber, 
          hand.hand_start_time
        );
        intervalAccumulator = this.initializeBB100Accumulator();
      }
    });

    return result;
  }

  /**
   * Initialize cumulative statistics tracking
   */
  private initializeCumulativeStats() {
    return {
      allWithRake: 0,
      allActual: 0,
      showdown: 0,
      noShowdown: 0
    };
  }

  /**
   * Initialize interval accumulator for profit data
   */
  private initializeIntervalAccumulator() {
    return {
      allWithRake: 0,
      allActual: 0,
      showdown: 0,
      noShowdown: 0,
      count: 0
    };
  }

  /**
   * Initialize interval accumulator for BB/100 data
   */
  private initializeBB100Accumulator() {
    return {
      bb100AllWithRake: 0,
      bb100AllActual: 0,
      bb100Showdown: 0,
      bb100NoShowdown: 0,
      count: 0
    };
  }

  /**
   * Update cumulative statistics with a new hand
   */
  private updateCumulativeStats(stats: any, hand: PokerHand): void {
    const profit = hand.hero_profit;
    const rake = hand.hero_rake;
    
    // Rake only exists when hero wins money
    const adjustedRake = profit > 0 ? rake : 0;
    
    stats.allWithRake += profit + adjustedRake;
    stats.allActual += profit;

    // Categorize by showdown/no-showdown
    if (isShowdownResult(hand.hero_hand_result)) {
      stats.showdown += profit;
    } else {
      stats.noShowdown += profit;
    }
  }

  /**
   * Accumulate interval data for profit calculations
   */
  private accumulateIntervalData(accumulator: any, cumulativeStats: any): void {
    accumulator.allWithRake += cumulativeStats.allWithRake;
    accumulator.allActual += cumulativeStats.allActual;
    accumulator.showdown += cumulativeStats.showdown;
    accumulator.noShowdown += cumulativeStats.noShowdown;
    accumulator.count++;
  }

  /**
   * Calculate current BB/100 values
   */
  private calculateCurrentBB100(cumulativeStats: any, cumulativeBigBlinds: number) {
    if (cumulativeBigBlinds <= 0) {
      return {
        allWithRake: 0,
        allActual: 0,
        showdown: 0,
        noShowdown: 0
      };
    }

    return {
      allWithRake: (cumulativeStats.allWithRake / cumulativeBigBlinds) * 100,
      allActual: (cumulativeStats.allActual / cumulativeBigBlinds) * 100,
      showdown: (cumulativeStats.showdown / cumulativeBigBlinds) * 100,
      noShowdown: (cumulativeStats.noShowdown / cumulativeBigBlinds) * 100
    };
  }

  /**
   * Accumulate BB/100 data for interval averaging
   */
  private accumulateBB100Data(accumulator: any, currentBB100: any): void {
    accumulator.bb100AllWithRake += currentBB100.allWithRake;
    accumulator.bb100AllActual += currentBB100.allActual;
    accumulator.bb100Showdown += currentBB100.showdown;
    accumulator.bb100NoShowdown += currentBB100.noShowdown;
    accumulator.count++;
  }

  /**
   * Check if we should create a data point at this interval
   */
  private shouldCreateDataPoint(handNumber: number, interval: number, index: number, totalHands: number): boolean {
    return handNumber % interval === 0 || index === totalHands - 1;
  }

  /**
   * Add profit data points to result
   */
  private addProfitDataPoints(
    result: ProfitChartData, 
    accumulator: any, 
    handNumber: number, 
    timestamp: string
  ): void {
    const avgAllWithRake = accumulator.allWithRake / accumulator.count;
    const avgAllActual = accumulator.allActual / accumulator.count;
    const avgShowdown = accumulator.showdown / accumulator.count;
    const avgNoShowdown = accumulator.noShowdown / accumulator.count;

    result.allHandsWithRake.push(this.createDataPoint(handNumber, avgAllWithRake, timestamp));
    result.allHandsActual.push(this.createDataPoint(handNumber, avgAllActual, timestamp));
    result.showdownOnly.push(this.createDataPoint(handNumber, avgShowdown, timestamp));
    result.noShowdownOnly.push(this.createDataPoint(handNumber, avgNoShowdown, timestamp));
  }

  /**
   * Add BB/100 data points to result
   */
  private addBB100DataPoints(
    result: BB100ChartData, 
    accumulator: any, 
    handNumber: number, 
    timestamp: string
  ): void {
    const avgBB100AllWithRake = accumulator.bb100AllWithRake / accumulator.count;
    const avgBB100AllActual = accumulator.bb100AllActual / accumulator.count;
    const avgBB100Showdown = accumulator.bb100Showdown / accumulator.count;
    const avgBB100NoShowdown = accumulator.bb100NoShowdown / accumulator.count;

    result.allHandsWithRakeBB100.push(this.createDataPoint(handNumber, avgBB100AllWithRake, timestamp));
    result.allHandsActualBB100.push(this.createDataPoint(handNumber, avgBB100AllActual, timestamp));
    result.showdownOnlyBB100.push(this.createDataPoint(handNumber, avgBB100Showdown, timestamp));
    result.noShowdownOnlyBB100.push(this.createDataPoint(handNumber, avgBB100NoShowdown, timestamp));
  }

  /**
   * Create a standardized data point
   */
  private createDataPoint(handNumber: number, value: number, timestamp: string): ChartDataPoint {
    return {
      handNumber,
      value: roundToDecimals(value),
      timestamp
    };
  }

  /**
   * Create empty statistics object
   */
  private createEmptyStatistics(): StatisticsData {
    return {
      profitWithoutRake: 0,
      actualProfit: 0,
      rakeImpact: 0,
      showdownProfit: 0,
      noShowdownProfit: 0,
      bb100WithoutRake: 0,
      bb100Actual: 0,
      bb100Showdown: 0,
      bb100NoShowdown: 0
    };
  }

  /**
   * Build statistics from chart data
   */
  private buildStatistics(
    profitData: ProfitChartData, 
    bb100Data: BB100ChartData, 
    profitIndex: number, 
    bb100Index: number
  ): StatisticsData {
    const profitWithoutRake = profitData.allHandsWithRake[profitIndex]?.value || 0;
    const actualProfit = profitData.allHandsActual[profitIndex]?.value || 0;

    return {
      profitWithoutRake,
      actualProfit,
      rakeImpact: profitWithoutRake - actualProfit,
      showdownProfit: profitData.showdownOnly[profitIndex]?.value || 0,
      noShowdownProfit: profitData.noShowdownOnly[profitIndex]?.value || 0,
      bb100WithoutRake: bb100Data.allHandsWithRakeBB100[bb100Index]?.value || 0,
      bb100Actual: bb100Data.allHandsActualBB100[bb100Index]?.value || 0,
      bb100Showdown: bb100Data.showdownOnlyBB100[bb100Index]?.value || 0,
      bb100NoShowdown: bb100Data.noShowdownOnlyBB100[bb100Index]?.value || 0
    };
  }

  /**
   * Format category label for display
   */
  private formatCategoryLabel(category: string): string {
    const [street, result] = category.split('_');
    const streetFormatted = street.charAt(0).toUpperCase() + street.slice(1);
    const resultFormatted = result.charAt(0).toUpperCase() + result.slice(1);
    return `${streetFormatted} ${resultFormatted}`;
  }
} 