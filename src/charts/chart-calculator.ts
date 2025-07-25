import { PokerHand, PokerPosition } from '../types';
import { 
  ChartDataPoint, 
  FinalStatistics,
  StatisticsData,
  StreetProfitPositionStats,
  StreetProfitAnalysisData,
  CompleteStreetProfitChartData,
  ActionAnalysisPositionStats,
  StreetActionAnalysisData,
  CompleteActionAnalysisChartData,
  PositionProfitChartData,
  CompletePositionProfitChartData,
  PositionBB100ChartData,
  CompletePositionBB100ChartData,
  CombinedPositionChartData
} from '../types';
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
   * Calculate position-specific profit trend data for vertical layout chart
   */
  calculatePositionProfitData(hands: PokerHand[], smoothInterval: number = CHARTS.DEFAULT_SAMPLING_INTERVAL): CompletePositionProfitChartData {
    const positions = this.getAllPositions();
    
    // Calculate overall data
    const overall = this.calculateSinglePositionProfitData(hands, null, 'Overall', smoothInterval);
    
    // Calculate position-specific data
    const positionData: any = { overall };
    
    positions.forEach(position => {
      const positionHands = hands.filter(hand => hand.hero_position === position);
      const key = position.toLowerCase();
      positionData[key] = this.calculateSinglePositionProfitData(positionHands, position, position, smoothInterval);
    });
    
    return positionData as CompletePositionProfitChartData;
  }

  /**
   * Calculate position-specific BB/100 trend data for vertical layout chart
   */
  calculatePositionBB100Data(hands: PokerHand[], smoothInterval: number = CHARTS.DEFAULT_BB100_INTERVAL): CompletePositionBB100ChartData {
    const positions = this.getAllPositions();
    
    // Calculate overall data
    const overall = this.calculateSinglePositionBB100Data(hands, null, 'Overall', smoothInterval);
    
    // Calculate position-specific data
    const positionData: any = { overall };
    
    positions.forEach(position => {
      const positionHands = hands.filter(hand => hand.hero_position === position);
      const key = position.toLowerCase();
      positionData[key] = this.calculateSinglePositionBB100Data(positionHands, position, position, smoothInterval);
    });
    
    return positionData as CompletePositionBB100ChartData;
  }

  /**
   * Calculate combined position chart data (profit + BB/100)
   */
  calculateCombinedPositionData(hands: PokerHand[], smoothInterval: number = CHARTS.DEFAULT_SAMPLING_INTERVAL): CombinedPositionChartData {
    const profitData = this.calculatePositionProfitData(hands, smoothInterval);
    const bb100Data = this.calculatePositionBB100Data(hands, smoothInterval);
    
    return {
      profitData,
      bb100Data
    };
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


  // ===== POSITION-SPECIFIC CALCULATION METHODS =====

  /**
   * Calculate profit trend data for a single position
   */
  private calculateSinglePositionProfitData(
    hands: PokerHand[], 
    position: PokerPosition | null, 
    positionLabel: string,
    smoothInterval: number
  ): PositionProfitChartData {
    const result: PositionProfitChartData = {
      position: positionLabel,
      actualProfit: [],
      profitWithoutRake: [],
      showdownProfit: [],
      noShowdownProfit: []
    };

    let cumulativeStats = {
      actual: 0,
      withoutRake: 0,
      showdown: 0,
      noShowdown: 0
    };

    let intervalAccumulator = {
      actual: 0,
      withoutRake: 0,
      showdown: 0,
      noShowdown: 0,
      count: 0
    };

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      const profit = hand.hero_profit;
      const rake = hand.hero_rake;
      
      // Rake only exists when hero wins money
      const adjustedRake = profit > 0 ? rake : 0;
      
      // Update cumulative stats
      cumulativeStats.actual += profit;
      cumulativeStats.withoutRake += profit + adjustedRake;
      
      if (isShowdownResult(hand.hero_hand_result)) {
        cumulativeStats.showdown += profit;
      } else {
        cumulativeStats.noShowdown += profit;
      }
      
      // Accumulate for interval averaging
      intervalAccumulator.actual += cumulativeStats.actual;
      intervalAccumulator.withoutRake += cumulativeStats.withoutRake;
      intervalAccumulator.showdown += cumulativeStats.showdown;
      intervalAccumulator.noShowdown += cumulativeStats.noShowdown;
      intervalAccumulator.count++;

      // Check if we should create a data point
      if (this.shouldCreateDataPoint(handNumber, smoothInterval, index, hands.length)) {
        const avgActual = intervalAccumulator.actual / intervalAccumulator.count;
        const avgWithoutRake = intervalAccumulator.withoutRake / intervalAccumulator.count;
        const avgShowdown = intervalAccumulator.showdown / intervalAccumulator.count;
        const avgNoShowdown = intervalAccumulator.noShowdown / intervalAccumulator.count;

        result.actualProfit.push(this.createDataPoint(handNumber, avgActual, hand.hand_start_time));
        result.profitWithoutRake.push(this.createDataPoint(handNumber, avgWithoutRake, hand.hand_start_time));
        result.showdownProfit.push(this.createDataPoint(handNumber, avgShowdown, hand.hand_start_time));
        result.noShowdownProfit.push(this.createDataPoint(handNumber, avgNoShowdown, hand.hand_start_time));
        
        intervalAccumulator = { actual: 0, withoutRake: 0, showdown: 0, noShowdown: 0, count: 0 };
      }
    });

    return result;
  }

  /**
   * Calculate BB/100 trend data for a single position
   */
  private calculateSinglePositionBB100Data(
    hands: PokerHand[], 
    position: PokerPosition | null, 
    positionLabel: string,
    smoothInterval: number
  ): PositionBB100ChartData {
    const result: PositionBB100ChartData = {
      position: positionLabel,
      actualBB100: [],
      profitWithoutRakeBB100: [],
      showdownBB100: [],
      noShowdownBB100: []
    };

    let cumulativeStats = {
      actual: 0,
      withoutRake: 0,
      showdown: 0,
      noShowdown: 0
    };

    let cumulativeBigBlinds = 0;

    let intervalAccumulator = {
      bb100Actual: 0,
      bb100WithoutRake: 0,
      bb100Showdown: 0,
      bb100NoShowdown: 0,
      count: 0
    };

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      const profit = hand.hero_profit;
      const rake = hand.hero_rake;
      
      // Rake only exists when hero wins money
      const adjustedRake = profit > 0 ? rake : 0;
      
      // Update cumulative stats
      cumulativeStats.actual += profit;
      cumulativeStats.withoutRake += profit + adjustedRake;
      cumulativeBigBlinds += hand.big_blind;
      
      if (isShowdownResult(hand.hero_hand_result)) {
        cumulativeStats.showdown += profit;
      } else {
        cumulativeStats.noShowdown += profit;
      }
      
      // Calculate current BB/100 values
      const currentBB100 = this.calculateCurrentPositionBB100(cumulativeStats, cumulativeBigBlinds);
      
      // Accumulate for interval averaging
      intervalAccumulator.bb100Actual += currentBB100.actual;
      intervalAccumulator.bb100WithoutRake += currentBB100.withoutRake;
      intervalAccumulator.bb100Showdown += currentBB100.showdown;
      intervalAccumulator.bb100NoShowdown += currentBB100.noShowdown;
      intervalAccumulator.count++;

      // Check if we should create a data point
      if (this.shouldCreateDataPoint(handNumber, smoothInterval, index, hands.length)) {
        const avgBB100Actual = intervalAccumulator.bb100Actual / intervalAccumulator.count;
        const avgBB100WithoutRake = intervalAccumulator.bb100WithoutRake / intervalAccumulator.count;
        const avgBB100Showdown = intervalAccumulator.bb100Showdown / intervalAccumulator.count;
        const avgBB100NoShowdown = intervalAccumulator.bb100NoShowdown / intervalAccumulator.count;

        result.actualBB100.push(this.createDataPoint(handNumber, avgBB100Actual, hand.hand_start_time));
        result.profitWithoutRakeBB100.push(this.createDataPoint(handNumber, avgBB100WithoutRake, hand.hand_start_time));
        result.showdownBB100.push(this.createDataPoint(handNumber, avgBB100Showdown, hand.hand_start_time));
        result.noShowdownBB100.push(this.createDataPoint(handNumber, avgBB100NoShowdown, hand.hand_start_time));
        
        intervalAccumulator = { bb100Actual: 0, bb100WithoutRake: 0, bb100Showdown: 0, bb100NoShowdown: 0, count: 0 };
      }
    });

    return result;
  }

  // ===== PRIVATE PROCESSING METHODS =====


  // ===== HELPER METHODS =====


  /**
   * Calculate current BB/100 values for position-specific analysis
   */
  private calculateCurrentPositionBB100(cumulativeStats: any, cumulativeBigBlinds: number) {
    if (cumulativeBigBlinds <= 0) {
      return {
        actual: 0,
        withoutRake: 0,
        showdown: 0,
        noShowdown: 0
      };
    }

    return {
      actual: (cumulativeStats.actual / cumulativeBigBlinds) * 100,
      withoutRake: (cumulativeStats.withoutRake / cumulativeBigBlinds) * 100,
      showdown: (cumulativeStats.showdown / cumulativeBigBlinds) * 100,
      noShowdown: (cumulativeStats.noShowdown / cumulativeBigBlinds) * 100
    };
  }


  /**
   * Check if we should create a data point at this interval
   */
  private shouldCreateDataPoint(handNumber: number, interval: number, index: number, totalHands: number): boolean {
    return handNumber % interval === 0 || index === totalHands - 1;
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
   * Get stage order index
   */
  private getStageIndex(stage: string): number {
    return POKER.STAGES.indexOf(stage as any);
  }




} 