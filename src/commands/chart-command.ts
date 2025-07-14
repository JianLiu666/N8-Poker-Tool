import { SqliteManager } from '../database/sqlite-manager';
import path from 'path';
import fs from 'fs-extra';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { createCanvas } from 'canvas';
import { PokerHand, HandResult } from '../database/sqlite-manager';

// 註冊 Chart.js 所有組件
Chart.register(...registerables);

export interface ChartCommandOptions {
  dbPath?: string;
  outputDir?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ChartDataPoint {
  handNumber: number;
  cumulativeProfit: number;
  timestamp: string;
}

export interface ChartData {
  allHands: ChartDataPoint[];
  showdownOnly: ChartDataPoint[];
  noShowdownOnly: ChartDataPoint[];
}

export class ChartCommand {
  private sqliteManager: SqliteManager;
  private outputDir: string;
  private options: ChartCommandOptions;

  constructor(options: ChartCommandOptions) {
    this.options = options;
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

      // 確保輸出目錄存在
      await fs.ensureDir(this.outputDir);

      // 獲取手牌數據
      const hands = await this.sqliteManager.getPokerHandsForChart(this.options?.dateRange);
      
      if (hands.length === 0) {
        console.log('⚠️  No poker hands found in the database');
        return;
      }

      console.log(`📈 Processing ${hands.length} hands for chart generation...`);

      // 計算累積 profit 數據
      const chartData = this.calculateCumulativeData(hands);

      // 生成圖表
      await this.generateChart(chartData);

      console.log('✅ Chart command completed successfully!');
      
    } catch (error) {
      console.error('❌ Chart command failed:', error);
      throw error;
    } finally {
      await this.sqliteManager.disconnect();
    }
  }

  private calculateCumulativeData(hands: PokerHand[]): ChartData {
    const allHands: ChartDataPoint[] = [];
    const showdownOnly: ChartDataPoint[] = [];
    const noShowdownOnly: ChartDataPoint[] = [];

    let cumulativeAll = 0;
    let cumulativeShowdown = 0;
    let cumulativeNoShowdown = 0;

    hands.forEach((hand, index) => {
      const handNumber = index + 1;
      const profit = hand.hero_profit;
      
      // 累積所有手牌的 profit
      cumulativeAll += profit;
      allHands.push({
        handNumber,
        cumulativeProfit: parseFloat(cumulativeAll.toFixed(2)),
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
        cumulativeProfit: parseFloat(cumulativeShowdown.toFixed(2)),
        timestamp: hand.hand_start_time
      });

      noShowdownOnly.push({
        handNumber,
        cumulativeProfit: parseFloat(cumulativeNoShowdown.toFixed(2)),
        timestamp: hand.hand_start_time
      });
    });

    return {
      allHands,
      showdownOnly,
      noShowdownOnly
    };
  }

  private async generateChart(data: ChartData): Promise<void> {
    const width = 1200;
    const height = 800;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 先繪製白色背景，確保JPG格式輸出時背景為白色
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        datasets: [
          {
            label: '總體 Profit',
            data: data.allHands.map(point => ({
              x: point.handNumber,
              y: point.cumulativeProfit
            })),
            borderColor: 'rgb(34, 197, 94)', // 綠色
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0, // 隱藏資料點
            pointHoverRadius: 3
          },
          {
            label: 'Showdown Profit',
            data: data.showdownOnly.map(point => ({
              x: point.handNumber,
              y: point.cumulativeProfit
            })),
            borderColor: 'rgb(59, 130, 246)', // 藍色
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0, // 隱藏資料點
            pointHoverRadius: 3
          },
          {
            label: 'No Showdown Profit',
            data: data.noShowdownOnly.map(point => ({
              x: point.handNumber,
              y: point.cumulativeProfit
            })),
            borderColor: 'rgb(239, 68, 68)', // 紅色
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0, // 隱藏資料點
            pointHoverRadius: 3
          }
        ]
      },
      options: {
        responsive: false,
        animation: false,
        layout: {
          padding: 0
        },
        backgroundColor: '#FFFFFF',  // 明確設定圖表背景為白色
        scales: {
          x: {
            type: 'linear',
            display: true,
            title: {
              display: true,
              text: '牌局數量',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)',
              lineWidth: 1
            },
            border: {
              display: true,
              color: 'rgba(0, 0, 0, 0.8)',
              width: 2
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: '累積 Profit',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)',
              lineWidth: 1
            },
            border: {
              display: true,
              color: 'rgba(0, 0, 0, 0.8)',
              width: 2
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Poker Profit 趨勢分析',
            font: {
              size: 20,
              weight: 'bold'
            },
            color: 'black'
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                size: 12
              },
              color: 'black'
            }
          }
        },
        elements: {
          line: {
            borderJoinStyle: 'round'
          }
        }
      }
    };

    const chart = new Chart(ctx as any, config);

    // 等待圖表完全渲染
    await new Promise(resolve => setTimeout(resolve, 100));

    // 在保存前，確保背景仍然是白色（針對JPG格式）
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixelData = imageData.data;
    
    // 創建新的畫布來確保白色背景
    const finalCanvas = createCanvas(width, height);
    const finalCtx = finalCanvas.getContext('2d');
    
    // 繪製白色背景
    finalCtx.fillStyle = '#FFFFFF';
    finalCtx.fillRect(0, 0, width, height);
    
    // 繪製原圖表內容
    finalCtx.drawImage(canvas, 0, 0);

    // 生成文件名包含時間戳
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `poker-profit-chart-${timestamp}.jpg`;
    const filePath = path.join(this.outputDir, fileName);

    // 保存圖表為 JPG 文件（使用最終畫布確保白色背景）
    const buffer = finalCanvas.toBuffer('image/jpeg', { 
      quality: 0.95,
      chromaSubsampling: false
    });
    await fs.writeFile(filePath, buffer);

    console.log(`📈 Chart generated successfully: ${filePath}`);
    console.log(`📊 Chart statistics:`);
    console.log(`   - Total hands: ${data.allHands.length}`);
    console.log(`   - All three lines have ${data.allHands.length} data points`);
    console.log(`   - Final total profit: ${data.allHands[data.allHands.length - 1]?.cumulativeProfit || 0}`);
    console.log(`   - Final showdown profit: ${data.showdownOnly[data.showdownOnly.length - 1]?.cumulativeProfit || 0}`);
    console.log(`   - Final no-showdown profit: ${data.noShowdownOnly[data.noShowdownOnly.length - 1]?.cumulativeProfit || 0}`);

    // 銷毀圖表實例以釋放記憶體
    chart.destroy();
  }
} 