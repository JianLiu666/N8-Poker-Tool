import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { createCanvas } from 'canvas';
import path from 'path';
import fs from 'fs-extra';
import { ChartDataPoint, ProfitChartData, BB100ChartData, ChartGenerationResult, ChartType, ChartConfig } from './chart-types';

// 註冊 Chart.js 所有組件
Chart.register(...registerables);

export class ChartGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  /**
   * 生成 Profit 趨勢圖表
   */
  async generateProfitChart(data: ProfitChartData): Promise<ChartGenerationResult> {
    const config = this.createProfitChartConfig();
    const chartConfig = this.buildProfitChartConfiguration(data, config);
    
    return this.renderChart(chartConfig, config, {
      'Profit without rake': data.allHandsWithRake[data.allHandsWithRake.length - 1]?.value || 0,
      'Actual profit (after rake)': data.allHandsActual[data.allHandsActual.length - 1]?.value || 0,
      'Showdown profit': data.showdownOnly[data.showdownOnly.length - 1]?.value || 0,
      'No showdown profit': data.noShowdownOnly[data.noShowdownOnly.length - 1]?.value || 0
    });
  }

  /**
   * 生成 BB/100 趨勢圖表
   */
  async generateBB100Chart(data: BB100ChartData): Promise<ChartGenerationResult> {
    const config = this.createBB100ChartConfig();
    
    // 計算 BB/100 數據的 Y 軸範圍
    const yAxisRange = this.calculateBB100YAxisRange(data);
    const chartConfig = this.buildBB100ChartConfiguration(data, config, yAxisRange);
    
    return this.renderChart(chartConfig, config, {
      'Profit without rake BB/100': data.allHandsWithRakeBB100[data.allHandsWithRakeBB100.length - 1]?.value || 0,
      'Actual profit BB/100': data.allHandsActualBB100[data.allHandsActualBB100.length - 1]?.value || 0,
      'Showdown BB/100': data.showdownOnlyBB100[data.showdownOnlyBB100.length - 1]?.value || 0,
      'No showdown BB/100': data.noShowdownOnlyBB100[data.noShowdownOnlyBB100.length - 1]?.value || 0
    });
  }

  /**
   * 創建 Profit 圖表配置
   */
  private createProfitChartConfig(): ChartConfig {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return {
      width: 1200,
      height: 800,
      title: 'Poker Profit Trend Analysis',
      xAxisLabel: 'Hands',
      yAxisLabel: 'Cumulative Profit',
      fileName: `poker-profit-chart-${timestamp}.jpg`
    };
  }

  /**
   * 創建 BB/100 圖表配置
   */
  private createBB100ChartConfig(): ChartConfig {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return {
      width: 1200,
      height: 800,
      title: 'Poker BB/100 Trend Analysis',
      xAxisLabel: 'Hands',
      yAxisLabel: 'BB/100',
      fileName: `poker-bb100-chart-${timestamp}.jpg`
    };
  }

  /**
   * 構建 Profit 圖表配置
   */
  private buildProfitChartConfiguration(data: ProfitChartData, config: ChartConfig): ChartConfiguration {
    return {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Profit without rake',
            data: data.allHandsWithRake.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgba(134, 239, 172, 0.6)', // 淡綠色
            backgroundColor: 'rgba(134, 239, 172, 0.05)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          },
          {
            label: 'No Showdown Profit',
            data: data.noShowdownOnly.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgb(239, 68, 68)', // 紅色
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          },
          {
            label: 'Showdown Profit',
            data: data.showdownOnly.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgb(59, 130, 246)', // 藍色
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          },
          {
            label: 'Actual profit (after rake)',
            data: data.allHandsActual.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgb(34, 197, 94)', // 深綠色
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          }
        ]
      },
      options: this.createChartOptions(config)
    };
  }

  /**
   * 計算 BB/100 數據的 Y 軸範圍
   */
  private calculateBB100YAxisRange(data: BB100ChartData): { min: number; max: number } {
    // 收集所有 BB/100 數值
    const allValues: number[] = [
      ...data.allHandsWithRakeBB100.map(point => point.value),
      ...data.allHandsActualBB100.map(point => point.value),
      ...data.showdownOnlyBB100.map(point => point.value),
      ...data.noShowdownOnlyBB100.map(point => point.value)
    ];

    if (allValues.length === 0) {
      return { min: -10, max: 10 };
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // 如果所有值都很接近零，設置合理的預設範圍
    if (Math.abs(max - min) < 1) {
      const center = (max + min) / 2;
      return {
        min: center - 5,
        max: center + 5
      };
    }

    // 在實際範圍基礎上增加 20% 的緩衝區，讓圖表更好看
    const range = max - min;
    const padding = range * 0.2;
    
    return {
      min: Math.floor((min - padding) * 10) / 10, // 四捨五入到一位小數
      max: Math.ceil((max + padding) * 10) / 10
    };
  }

  /**
   * 構建 BB/100 圖表配置
   */
  private buildBB100ChartConfiguration(data: BB100ChartData, config: ChartConfig, yAxisRange?: { min: number; max: number }): ChartConfiguration {
    return {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Profit without rake BB/100',
            data: data.allHandsWithRakeBB100.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgba(134, 239, 172, 0.6)', // 淡綠色
            backgroundColor: 'rgba(134, 239, 172, 0.05)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          },
          {
            label: 'No Showdown BB/100',
            data: data.noShowdownOnlyBB100.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgb(239, 68, 68)', // 紅色
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          },
          {
            label: 'Showdown BB/100',
            data: data.showdownOnlyBB100.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgb(59, 130, 246)', // 藍色
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          },
          {
            label: 'Actual profit BB/100',
            data: data.allHandsActualBB100.map(point => ({
              x: point.handNumber,
              y: point.value
            })),
            borderColor: 'rgb(34, 197, 94)', // 深綠色
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3
          }
        ]
      },
      options: this.createChartOptions(config, yAxisRange)
    };
  }

  /**
   * 創建通用圖表選項
   */
  private createChartOptions(config: ChartConfig, yAxisRange?: { min: number; max: number }) {
    return {
      responsive: false,
      animation: false as const,
      layout: {
        padding: 0
      },
      backgroundColor: '#FFFFFF',
      scales: {
        x: {
          type: 'linear' as const,
          display: true,
          title: {
            display: true,
            text: config.xAxisLabel,
            font: {
              size: 14,
              weight: 'bold' as const
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
            text: config.yAxisLabel,
            font: {
              size: 14,
              weight: 'bold' as const
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
          },
          ...(yAxisRange && {
            min: yAxisRange.min,
            max: yAxisRange.max
          })
        }
      },
      plugins: {
        title: {
          display: true,
          text: config.title,
          font: {
            size: 20,
            weight: 'bold' as const
          },
          color: 'black'
        },
        legend: {
          display: true,
          position: 'top' as const,
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
          borderJoinStyle: 'round' as const
        }
      }
    };
  }

  /**
   * 渲染和保存圖表
   */
  private async renderChart(
    chartConfig: ChartConfiguration, 
    config: ChartConfig, 
    finalValues: { [key: string]: number }
  ): Promise<ChartGenerationResult> {
    await fs.ensureDir(this.outputDir);

    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // 先繪製白色背景，確保JPG格式輸出時背景為白色
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.width, config.height);
    ctx.restore();

    const chart = new Chart(ctx as any, chartConfig);

    // 等待圖表完全渲染
    await new Promise(resolve => setTimeout(resolve, 100));

    // 創建新的畫布來確保白色背景
    const finalCanvas = createCanvas(config.width, config.height);
    const finalCtx = finalCanvas.getContext('2d');
    
    // 繪製白色背景
    finalCtx.fillStyle = '#FFFFFF';
    finalCtx.fillRect(0, 0, config.width, config.height);
    
    // 繪製原圖表內容
    finalCtx.drawImage(canvas, 0, 0);

    const filePath = path.join(this.outputDir, config.fileName);

    // 保存圖表為 JPG 文件
    const buffer = finalCanvas.toBuffer('image/jpeg', { 
      quality: 0.95,
      chromaSubsampling: false
    });
    await fs.writeFile(filePath, buffer);

    // 銷毀圖表實例以釋放記憶體
    chart.destroy();

    // 計算總手數
    const totalHands = Object.values(finalValues).length > 0 
      ? (chartConfig.data?.datasets?.[0]?.data as any[])?.length || 0 
      : 0;

    return {
      filePath,
      totalHands,
      finalValues
    };
  }
} 