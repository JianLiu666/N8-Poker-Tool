import { PokerHand, PokerPosition } from '../types';
import { 
  ChartDataPoint, 
  ProfitChartData, 
  BB100ChartData, 
  FinalStatistics,
  StatisticsData,
  StreetProfitPositionStats,
  StreetProfitAnalysisData,
  CompleteStreetProfitChartData,
  ActionAnalysisPositionStats,
  StreetActionAnalysisData,
  CompleteActionAnalysisChartData
} from './chart-types';
import { CHARTS, POKER } from '../constants';
import { roundToDecimals, isShowdownResult } from '../utils';

/**
 * Chart calculator responsible for processing poker hand data and generating chart datasets
 * Optimized for performance with large datasets using interval-based smoothing
 */
export class ChartCalculator {
  
  // ===== CONSTANTS =====
  


  // ===== PUBLIC CALCULATION METHODS =====

  /**
   * Calculate cumulative profit data with optional smoothing for better performance
   */
  calculateProfitData(hands: PokerHand[], smoothInterval: number = CHARTS.DEFAULT_SAMPLING_INTERVAL): ProfitChartData {
    return this.processProfitDataWithSmoothing(hands, smoothInterval);
  }

  /**
   * Calculate BB/100 data with optional smoothing
   */
  calculateBB100Data(hands: PokerHand[], smoothInterval: number = CHARTS.DEFAULT_BB100_INTERVAL): BB100ChartData {
    return this.processBB100DataWithSmoothing(hands, smoothInterval);
  }





  /**
   * Calculate action analysis chart data for action proportion analysis by position
   */
  calculateActionAnalysisChartData(hands: PokerHand[]): CompleteActionAnalysisChartData {
    const positions = this.getAllPositions();
    const result: any = {};

    POKER.STAGES.forEach(stage => {
      if (stage === 'showdown') {
        // For showdown, calculate win percentage instead of actions
        result[stage] = this.calculateShowdownWinRates(hands, positions);
      } else {
        // For preflop, flop, turn, river - calculate action proportions
        result[stage] = this.calculateActionProportions(hands, stage, positions);
      }
    });

    return result as CompleteActionAnalysisChartData;
  }

  /**
   * Calculate street profit analysis chart data for profit/loss analysis by position
   */
  calculateStreetProfitAnalysisChartData(hands: PokerHand[]): CompleteStreetProfitChartData {
    const positions = this.getAllPositions();
    const result: any = {};

    POKER.STAGES.forEach(stage => {
      const stageHands = hands.filter(hand => hand.final_stage === stage);
      const positionStats: StreetProfitPositionStats[] = [];

      // Calculate overall statistics for this stage
      const allProfitHands = stageHands.filter(hand => hand.hero_profit > 0);
      const allLossHands = stageHands.filter(hand => hand.hero_profit <= 0);
      const totalOverallProfit = allProfitHands.reduce((sum, hand) => sum + hand.hero_profit, 0);
      const totalOverallLoss = allLossHands.reduce((sum, hand) => sum + hand.hero_profit, 0);

      // Use average BB from all stage hands for conversion
      const avgBigBlind = stageHands.length > 0 
        ? stageHands.reduce((sum, hand) => sum + hand.big_blind, 0) / stageHands.length 
        : 0.10; // Default to $0.10 if no hands

      // Add Overall statistics first
      const overallProfitBB = roundToDecimals(totalOverallProfit / avgBigBlind, 2);
      const overallLossBB = roundToDecimals(totalOverallLoss / avgBigBlind, 2);
      positionStats.push({
        position: 'Overall',
        profit: overallProfitBB,
        loss: overallLossBB,
        totalPnL: roundToDecimals(overallProfitBB + overallLossBB, 2),
        profitCount: allProfitHands.length,
        lossCount: allLossHands.length
      });

      // Then add individual position statistics
      positions.forEach(position => {
        const positionHands = stageHands.filter(hand => hand.hero_position === position);
        const profitHands = positionHands.filter(hand => hand.hero_profit > 0);
        const lossHands = positionHands.filter(hand => hand.hero_profit <= 0);

        const totalProfit = profitHands.reduce((sum, hand) => sum + hand.hero_profit, 0);
        const totalLoss = lossHands.reduce((sum, hand) => sum + hand.hero_profit, 0);

        const positionProfitBB = roundToDecimals(totalProfit / avgBigBlind, 2);
        const positionLossBB = roundToDecimals(totalLoss / avgBigBlind, 2);
        positionStats.push({
          position: position,
          profit: positionProfitBB,
          loss: positionLossBB,
          totalPnL: roundToDecimals(positionProfitBB + positionLossBB, 2),
          profitCount: profitHands.length,
          lossCount: lossHands.length
        });
      });

      result[stage] = {
        stage: stage,
        positions: positionStats
      };
    });

    return result as CompleteStreetProfitChartData;
  }

  // ===== ACTION ANALYSIS HELPER METHODS =====

  /**
   * Calculate action proportions for a specific street and all positions
   */
  private calculateActionProportions(hands: PokerHand[], stage: string, positions: PokerPosition[]): StreetActionAnalysisData {
    const positionStats: ActionAnalysisPositionStats[] = [];

    // Calculate overall statistics first
    const overallStats = this.calculatePositionActionStats(hands, stage, null);
    positionStats.push(overallStats);

    // Calculate for each specific position
    positions.forEach(position => {
      const positionActionStats = this.calculatePositionActionStats(hands, stage, position);
      positionStats.push(positionActionStats);
    });

    return {
      stage: stage,
      positions: positionStats
    };
  }

  /**
   * Calculate showdown win rates for all positions
   */
  private calculateShowdownWinRates(hands: PokerHand[], positions: PokerPosition[]): StreetActionAnalysisData {
    const positionStats: ActionAnalysisPositionStats[] = [];
    
    // Filter hands that went to showdown
    const showdownHands = hands.filter(hand => hand.final_stage === 'showdown');

    // Calculate overall win rate
    const overallWins = showdownHands.filter(hand => hand.hero_profit > 0).length;
    const overallTotal = showdownHands.length;
    const overallWinRate = overallTotal > 0 ? (overallWins / overallTotal) * 100 : 0;

    positionStats.push({
      position: 'Overall',
      raisePct: overallWinRate,  // Use raisePct to store win rate for consistency
      betPct: 0,
      callPct: 0,
      checkPct: 0,
      foldPct: 0,
      totalHands: overallTotal
    });

    // Calculate for each position
    positions.forEach(position => {
      const positionShowdownHands = showdownHands.filter(hand => hand.hero_position === position);
      const positionWins = positionShowdownHands.filter(hand => hand.hero_profit > 0).length;
      const positionTotal = positionShowdownHands.length;
      const positionWinRate = positionTotal > 0 ? (positionWins / positionTotal) * 100 : 0;

      positionStats.push({
        position: position,
        raisePct: positionWinRate,  // Use raisePct to store win rate for consistency
        betPct: 0,
        callPct: 0,
        checkPct: 0,
        foldPct: 0,
        totalHands: positionTotal
      });
    });

    return {
      stage: 'showdown',
      positions: positionStats
    };
  }

  /**
   * Calculate action statistics for a specific position (or overall if position is null)
   */
  private calculatePositionActionStats(hands: PokerHand[], stage: string, position: PokerPosition | null): ActionAnalysisPositionStats {
    // Filter hands by position if specified
    const filteredHands = position 
      ? hands.filter(hand => hand.hero_position === position)
      : hands;

    // Filter hands that actually reached this stage AND have actions on this stage
    const stageHands = filteredHands.filter(hand => {
      if (!this.handReachedStage(hand, stage)) {
        return false;
      }
      // Only include hands that have actual actions on this stage
      const lastAction = this.getLastActionForStage(hand, stage);
      return lastAction !== null;
    });

    // Extract last action for each hand on this stage
    const actionCounts = { R: 0, B: 0, C: 0, X: 0, F: 0 };
    
    stageHands.forEach(hand => {
      const lastAction = this.getLastActionForStage(hand, stage);
      if (lastAction && actionCounts.hasOwnProperty(lastAction)) {
        actionCounts[lastAction as keyof typeof actionCounts]++;
      }
    });

    const totalValidActionHands = stageHands.length;
    
    return {
      position: position || 'Overall',
      raisePct: totalValidActionHands > 0 ? roundToDecimals((actionCounts.R / totalValidActionHands) * 100, 1) : 0,
      betPct: totalValidActionHands > 0 ? roundToDecimals((actionCounts.B / totalValidActionHands) * 100, 1) : 0,
      callPct: totalValidActionHands > 0 ? roundToDecimals((actionCounts.C / totalValidActionHands) * 100, 1) : 0,
      checkPct: totalValidActionHands > 0 ? roundToDecimals((actionCounts.X / totalValidActionHands) * 100, 1) : 0,
      foldPct: totalValidActionHands > 0 ? roundToDecimals((actionCounts.F / totalValidActionHands) * 100, 1) : 0,
      totalHands: totalValidActionHands
    };
  }

  /**
   * Check if a hand reached a specific stage
   */
  private handReachedStage(hand: PokerHand, stage: string): boolean {
    const targetStageIndex = this.getStageIndex(stage);
    const handFinalStageIndex = this.getStageIndex(hand.final_stage);
    
    return handFinalStageIndex >= targetStageIndex;
  }

  /**
   * Get the last action for a specific stage from the hero's actions
   */
  private getLastActionForStage(hand: PokerHand, stage: string): string | null {
    let actions: string;
    
    switch (stage) {
      case 'preflop':
        actions = hand.hero_preflop_actions;
        break;
      case 'flop':
        actions = hand.hero_flop_actions;
        break;
      case 'turn':
        actions = hand.hero_turn_actions;
        break;
      case 'river':
        actions = hand.hero_river_actions;
        break;
      default:
        return null;
    }

    // Return the last character (last action) if actions exist
    return actions && actions.length > 0 ? actions.charAt(actions.length - 1) : null;
  }

  /**
   * Get final statistics for all chart data
   */
  getFinalStatistics(profitData: ProfitChartData, bb100Data: BB100ChartData): FinalStatistics {
    const totalHands = profitData.allHandsWithRake.length;
    
    if (totalHands === 0) {
      return {
        totalHands: 0,
        statistics: this.createEmptyStatistics()
      };
    }

    const profitIndex = profitData.allHandsWithRake.length - 1;
    const bb100Index = bb100Data.allHandsWithRakeBB100.length - 1;
    
    return {
      totalHands,
      statistics: this.buildStatistics(profitData, bb100Data, profitIndex, bb100Index)
    };
  }

  // ===== PRIVATE PROCESSING METHODS =====

  /**
   * Calculate smooth profit data with interval-based averaging
   */
  private processProfitDataWithSmoothing(hands: PokerHand[], interval: number): ProfitChartData {
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
  private processBB100DataWithSmoothing(hands: PokerHand[], interval: number): BB100ChartData {
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

  // ===== HELPER METHODS =====

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

  // ===== UTILITY METHODS =====

  /**
   * Get all poker positions in standard order
   */
  private getAllPositions(): PokerPosition[] {
    return [
      PokerPosition.UTG,
      PokerPosition.HJ,
      PokerPosition.CO,
      PokerPosition.BTN,
      PokerPosition.SB,
      PokerPosition.BB
    ];
  }

  /**
   * Check if a stage is valid
   */
  private isValidStage(stage: string): boolean {
    return POKER.STAGES.includes(stage as any);
  }

  /**
   * Get stage order index
   */
  private getStageIndex(stage: string): number {
    return POKER.STAGES.indexOf(stage as any);
  }



  /**
   * Calculate total profit for a filtered set of hands
   */
  private calculateTotalProfit(filteredHands: PokerHand[]): number {
    return filteredHands.reduce((sum, hand) => sum + hand.hero_profit, 0);
  }

} 