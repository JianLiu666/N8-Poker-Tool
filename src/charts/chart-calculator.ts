import { PokerHand, HandResult } from '../database/sqlite-manager';
import { ChartDataPoint, ProfitChartData, BB100ChartData } from './chart-types';

export class ChartCalculator {
  
  /**
   * 計算累積 profit 數據
   */
  calculateProfitData(hands: PokerHand[]): ProfitChartData {
    const allHandsWithRake: ChartDataPoint[] = [];
    const allHandsActual: ChartDataPoint[] = [];
    const showdownOnly: ChartDataPoint[] = [];
    const noShowdownOnly: ChartDataPoint[] = [];

    let cumulativeAllWithRake = 0;
    let cumulativeAllActual = 0;
    let cumulativeShowdown = 0;
    let cumulativeNoShowdown = 0;

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      const profit = hand.hero_profit;
      const rake = hand.hero_rake;
      
      // rake 只有在 hero_profit > 0 (贏錢) 時才存在
      const adjustedRake = profit > 0 ? rake : 0;
      
      // 累積總體 profit (含rake) - 只有贏錢時才加上rake
      cumulativeAllWithRake += profit + adjustedRake;
      allHandsWithRake.push({
        handNumber,
        value: parseFloat(cumulativeAllWithRake.toFixed(2)),
        timestamp: hand.hand_start_time
      });

      // 累積實際 profit (不含rake)
      cumulativeAllActual += profit;
      allHandsActual.push({
        handNumber,
        value: parseFloat(cumulativeAllActual.toFixed(2)),
        timestamp: hand.hand_start_time
      });

      // 根據是否攤牌分別累積，但每條線都要有相同的長度
      const isShowdown = hand.hero_hand_result === HandResult.SHOWDOWN_WIN || 
                        hand.hero_hand_result === HandResult.SHOWDOWN_LOSS;

      if (isShowdown) {
        // 這手是 showdown，showdown 線增加 profit，no_showdown 線增加 0
        cumulativeShowdown += profit;
        // cumulativeNoShowdown += 0; // 不變
      } else {
        // 這手是 no_showdown，no_showdown 線增加 profit，showdown 線增加 0
        cumulativeNoShowdown += profit;
        // cumulativeShowdown += 0; // 不變
      }

      // 兩條線都要有相同的資料點數量
      showdownOnly.push({
        handNumber,
        value: parseFloat(cumulativeShowdown.toFixed(2)),
        timestamp: hand.hand_start_time
      });

      noShowdownOnly.push({
        handNumber,
        value: parseFloat(cumulativeNoShowdown.toFixed(2)),
        timestamp: hand.hand_start_time
      });
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
   * @param interval 取樣間隔（每多少手記錄一個節點）
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

      // 只在達到取樣間隔或最後一手時記錄數據點
      const isLastHand = index === hands.length - 1;
      const shouldRecord = handNumber % interval === 0 || isLastHand;

      if (shouldRecord) {
        // 計算 BB/100 (防止除以零)
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

        allHandsWithRakeBB100.push({
          handNumber,
          value: parseFloat(bb100AllWithRake.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        allHandsActualBB100.push({
          handNumber,
          value: parseFloat(bb100AllActual.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        showdownOnlyBB100.push({
          handNumber,
          value: parseFloat(bb100Showdown.toFixed(2)),
          timestamp: hand.hand_start_time
        });

        noShowdownOnlyBB100.push({
          handNumber,
          value: parseFloat(bb100NoShowdown.toFixed(2)),
          timestamp: hand.hand_start_time
        });
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