import { PokerHand, HandResult } from '../database/sqlite-manager';
import { ChartDataPoint, ProfitChartData, BB100ChartData } from './chart-types';

export class ChartCalculator {
  
  /**
   * 計算累積 profit 數據
   */
  calculateProfitData(hands: PokerHand[], smoothInterval: number = 1): ProfitChartData {
    return this.calculateSmoothProfitData(hands, smoothInterval);
  }

  /**
   * 計算平滑的 profit 數據
   * @param hands 手牌數據
   * @param interval 取樣間隔（每多少手計算一個平均值節點）
   */
  private calculateSmoothProfitData(hands: PokerHand[], interval: number = 1): ProfitChartData {
    const allHandsWithRake: ChartDataPoint[] = [];
    const allHandsActual: ChartDataPoint[] = [];
    const showdownOnly: ChartDataPoint[] = [];
    const noShowdownOnly: ChartDataPoint[] = [];

    let cumulativeAllWithRake = 0;
    let cumulativeAllActual = 0;
    let cumulativeShowdown = 0;
    let cumulativeNoShowdown = 0;

    // 用於在區間內累積計算平均值
    let intervalSum = {
      allWithRake: 0,
      allActual: 0,
      showdown: 0,
      noShowdown: 0
    };
    let intervalCount = 0;
    let intervalStart = 0;

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      const profit = hand.hero_profit;
      const rake = hand.hero_rake;
      
      // rake 只有在 hero_profit > 0 (贏錢) 時才存在
      const adjustedRake = profit > 0 ? rake : 0;
      
      // 累積總體 profit
      cumulativeAllWithRake += profit + adjustedRake;
      cumulativeAllActual += profit;

      // 根據是否攤牌分別累積
      const isShowdown = hand.hero_hand_result === HandResult.SHOWDOWN_WIN || 
                        hand.hero_hand_result === HandResult.SHOWDOWN_LOSS;

      if (isShowdown) {
        cumulativeShowdown += profit;
      } else {
        cumulativeNoShowdown += profit;
      }

      // 在區間內累積數據
      intervalSum.allWithRake += cumulativeAllWithRake;
      intervalSum.allActual += cumulativeAllActual;
      intervalSum.showdown += cumulativeShowdown;
      intervalSum.noShowdown += cumulativeNoShowdown;
      intervalCount++;

      // 檢查是否到達區間結束或最後一手
      const isLastHand = index === hands.length - 1;
      const isIntervalEnd = handNumber % interval === 0;

      if (isIntervalEnd || isLastHand) {
        // 計算區間內的平均值
        const avgAllWithRake = intervalSum.allWithRake / intervalCount;
        const avgAllActual = intervalSum.allActual / intervalCount;
        const avgShowdown = intervalSum.showdown / intervalCount;
        const avgNoShowdown = intervalSum.noShowdown / intervalCount;

        allHandsWithRake.push({
          handNumber,
          value: parseFloat(avgAllWithRake.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        allHandsActual.push({
          handNumber,
          value: parseFloat(avgAllActual.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        showdownOnly.push({
          handNumber,
          value: parseFloat(avgShowdown.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        noShowdownOnly.push({
          handNumber,
          value: parseFloat(avgNoShowdown.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        // 重置區間累積器
        intervalSum = {
          allWithRake: 0,
          allActual: 0,
          showdown: 0,
          noShowdown: 0
        };
        intervalCount = 0;
        intervalStart = handNumber;
      }
    });

    return {
      allHandsWithRake,
      allHandsActual,
      showdownOnly,
      noShowdownOnly
    };
  }

  /**
   * 計算 BB/100 數據（平滑版本，每 100 手一個節點）
   * BB/100 = (累積profit / 累積big_blind總和) * 100
   */
  calculateBB100Data(hands: PokerHand[], smoothInterval: number = 100): BB100ChartData {
    return this.calculateSmoothBB100Data(hands, smoothInterval);
  }

  /**
   * 計算平滑的 BB/100 數據
   * @param hands 手牌數據
   * @param interval 取樣間隔（每多少手計算一個平均值節點）
   */
  private calculateSmoothBB100Data(hands: PokerHand[], interval: number = 100): BB100ChartData {
    const allHandsWithRakeBB100: ChartDataPoint[] = [];
    const allHandsActualBB100: ChartDataPoint[] = [];
    const showdownOnlyBB100: ChartDataPoint[] = [];
    const noShowdownOnlyBB100: ChartDataPoint[] = [];

    let cumulativeAllWithRake = 0;
    let cumulativeAllActual = 0;
    let cumulativeShowdown = 0;
    let cumulativeNoShowdown = 0;
    let cumulativeBigBlinds = 0;

    // 用於在區間內累積計算平均值
    let intervalSum = {
      bb100AllWithRake: 0,
      bb100AllActual: 0,
      bb100Showdown: 0,
      bb100NoShowdown: 0
    };
    let intervalCount = 0;

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      const profit = hand.hero_profit;
      const rake = hand.hero_rake;
      const bigBlind = hand.big_blind;
      
      // 累積 big blinds
      cumulativeBigBlinds += bigBlind;
      
      // rake 只有在 hero_profit > 0 (贏錢) 時才存在
      const adjustedRake = profit > 0 ? rake : 0;
      
      // 累積各種 profit
      cumulativeAllWithRake += profit + adjustedRake;
      cumulativeAllActual += profit;

      // 根據是否攤牌分別累積
      const isShowdown = hand.hero_hand_result === HandResult.SHOWDOWN_WIN || 
                        hand.hero_hand_result === HandResult.SHOWDOWN_LOSS;

      if (isShowdown) {
        cumulativeShowdown += profit;
      } else {
        cumulativeNoShowdown += profit;
      }

      // 計算當前的 BB/100 值
      const bb100AllWithRake = cumulativeBigBlinds > 0 
        ? (cumulativeAllWithRake / cumulativeBigBlinds) * 100 
        : 0;
      const bb100AllActual = cumulativeBigBlinds > 0 
        ? (cumulativeAllActual / cumulativeBigBlinds) * 100 
        : 0;
      const bb100Showdown = cumulativeBigBlinds > 0 
        ? (cumulativeShowdown / cumulativeBigBlinds) * 100 
        : 0;
      const bb100NoShowdown = cumulativeBigBlinds > 0 
        ? (cumulativeNoShowdown / cumulativeBigBlinds) * 100 
        : 0;

      // 在區間內累積 BB/100 數據
      intervalSum.bb100AllWithRake += bb100AllWithRake;
      intervalSum.bb100AllActual += bb100AllActual;
      intervalSum.bb100Showdown += bb100Showdown;
      intervalSum.bb100NoShowdown += bb100NoShowdown;
      intervalCount++;

      // 檢查是否到達區間結束或最後一手
      const isLastHand = index === hands.length - 1;
      const isIntervalEnd = handNumber % interval === 0;

      if (isIntervalEnd || isLastHand) {
        // 計算區間內的平均 BB/100 值
        const avgBB100AllWithRake = intervalSum.bb100AllWithRake / intervalCount;
        const avgBB100AllActual = intervalSum.bb100AllActual / intervalCount;
        const avgBB100Showdown = intervalSum.bb100Showdown / intervalCount;
        const avgBB100NoShowdown = intervalSum.bb100NoShowdown / intervalCount;

        allHandsWithRakeBB100.push({
          handNumber,
          value: parseFloat(avgBB100AllWithRake.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        allHandsActualBB100.push({
          handNumber,
          value: parseFloat(avgBB100AllActual.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        showdownOnlyBB100.push({
          handNumber,
          value: parseFloat(avgBB100Showdown.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        noShowdownOnlyBB100.push({
          handNumber,
          value: parseFloat(avgBB100NoShowdown.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        // 重置區間累積器
        intervalSum = {
          bb100AllWithRake: 0,
          bb100AllActual: 0,
          bb100Showdown: 0,
          bb100NoShowdown: 0
        };
        intervalCount = 0;
      }
    });

    return {
      allHandsWithRakeBB100,
      allHandsActualBB100,
      showdownOnlyBB100,
      noShowdownOnlyBB100
    };
  }

  /**
   * 獲取最終統計數據
   */
  getFinalStatistics(profitData: ProfitChartData, bb100Data: BB100ChartData) {
    const totalHands = profitData.allHandsWithRake.length;
    
    if (totalHands === 0) {
      return { totalHands: 0, statistics: {} };
    }

    const profitLastIndex = totalHands - 1;
    const bb100LastIndex = bb100Data.allHandsWithRakeBB100.length - 1;
    
    return {
      totalHands,
      statistics: {
        profitWithoutRake: profitData.allHandsWithRake[profitLastIndex]?.value || 0,
        actualProfit: profitData.allHandsActual[profitLastIndex]?.value || 0,
        rakeImpact: (profitData.allHandsWithRake[profitLastIndex]?.value || 0) - (profitData.allHandsActual[profitLastIndex]?.value || 0),
        showdownProfit: profitData.showdownOnly[profitLastIndex]?.value || 0,
        noShowdownProfit: profitData.noShowdownOnly[profitLastIndex]?.value || 0,
        bb100WithoutRake: bb100Data.allHandsWithRakeBB100[bb100LastIndex]?.value || 0,
        bb100Actual: bb100Data.allHandsActualBB100[bb100LastIndex]?.value || 0,
        bb100Showdown: bb100Data.showdownOnlyBB100[bb100LastIndex]?.value || 0,
        bb100NoShowdown: bb100Data.noShowdownOnlyBB100[bb100LastIndex]?.value || 0
      }
    };
  }
} 