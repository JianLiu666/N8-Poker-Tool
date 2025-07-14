import { Chart, ChartConfiguration, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { createCanvas } from 'canvas';
import path from 'path';
import { 
  ChartDataPoint, 
  ProfitChartData, 
  BB100ChartData, 
  ChartGenerationResult, 
  ChartConfig,
  YAxisRange,
  StreetProfitBarData,
  StreetProfitStats
} from './chart-types';
import { CHARTS, CHART_COLORS } from '../constants';
import { formatTimestamp, ensureDirectoryExists } from '../utils';

// Register Chart.js components
Chart.register(...registerables, ChartDataLabels);

/**
 * Chart generator class responsible for creating visual charts from poker data
 * Supports line charts for trends and bar charts for categorical data
 */
export class ChartGenerator {
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  /**
   * Generate profit trend chart showing cumulative profit over time
   */
  async generateProfitChart(data: ProfitChartData): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('profit');
    const chartConfig = this.buildProfitChartConfiguration(data, config);
    
    const finalValues = this.extractProfitFinalValues(data);
    return this.renderChart(chartConfig, config, finalValues);
  }

  /**
   * Generate BB/100 trend chart with dynamic Y-axis scaling
   */
  async generateBB100Chart(data: BB100ChartData): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('bb100');
    const yAxisRange = this.calculateOptimalYAxisRange(data);
    const chartConfig = this.buildBB100ChartConfiguration(data, config, yAxisRange);
    
    const finalValues = this.extractBB100FinalValues(data);
    return this.renderChart(chartConfig, config, finalValues);
  }

  /**
   * Generate street-based profit bar chart with conditional coloring
   */
  async generateStreetProfitChart(data: StreetProfitBarData): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('street-profit');
    const chartConfig = this.buildBarChartConfiguration(data, config);
    
    const finalValues = this.extractStreetProfitFinalValues(data.dataPoints);
    return this.renderChart(chartConfig, config, finalValues);
  }

  /**
   * Create standardized chart configuration based on chart type
   */
  private createChartConfig(type: 'profit' | 'bb100' | 'street-profit'): ChartConfig {
    const timestamp = formatTimestamp();
    const configs = {
      'profit': {
        title: 'Poker Profit Trend Analysis',
        xAxisLabel: 'Hands',
        yAxisLabel: 'Cumulative Profit',
        fileName: `poker-profit-chart-${timestamp}`
      },
      'bb100': {
        title: 'Poker BB/100 Trend Analysis',
        xAxisLabel: 'Hands',
        yAxisLabel: 'BB/100',
        fileName: `poker-bb100-chart-${timestamp}`
      },
      'street-profit': {
        title: 'Poker Street Profit Analysis',
        xAxisLabel: 'Street Categories',
        yAxisLabel: 'Cumulative Profit',
        fileName: `poker-street-profit-chart-${timestamp}`
      }
    };

    const baseConfig = configs[type];
    return {
      width: CHARTS.DEFAULT_WIDTH,
      height: CHARTS.DEFAULT_HEIGHT,
      ...baseConfig,
      fileName: `${baseConfig.fileName}${CHARTS.DEFAULT_FILE_EXTENSION}`
    };
  }

  /**
   * Build profit chart configuration
   */
  private buildProfitChartConfiguration(data: ProfitChartData, config: ChartConfig, yAxisRange?: YAxisRange): ChartConfiguration {
    return {
      type: 'line',
      data: {
        datasets: [
          this.createDataset(
            'Profit without rake',
            data.allHandsWithRake,
            CHART_COLORS.PROFIT_WITHOUT_RAKE,
            'rgba(134, 239, 172, 0.05)'
          ),
          this.createDataset(
            'No Showdown Profit',
            data.noShowdownOnly,
            CHART_COLORS.NO_SHOWDOWN_PROFIT,
            `rgba(239, 68, 68, ${CHART_COLORS.BACKGROUND_ALPHA})`
          ),
          this.createDataset(
            'Showdown Profit',
            data.showdownOnly,
            CHART_COLORS.SHOWDOWN_PROFIT,
            `rgba(59, 130, 246, ${CHART_COLORS.BACKGROUND_ALPHA})`
          ),
          this.createDataset(
            'Actual profit (after rake)',
            data.allHandsActual,
            CHART_COLORS.ACTUAL_PROFIT,
            `rgba(34, 197, 94, ${CHART_COLORS.BACKGROUND_ALPHA})`
          )
        ]
      },
      options: this.createChartOptions(config, yAxisRange)
    };
  }

  /**
   * Build BB/100 chart configuration
   */
  private buildBB100ChartConfiguration(data: BB100ChartData, config: ChartConfig, yAxisRange?: YAxisRange): ChartConfiguration {
    return {
      type: 'line',
      data: {
        datasets: [
          this.createDataset(
            'Profit without rake BB/100',
            data.allHandsWithRakeBB100,
            CHART_COLORS.PROFIT_WITHOUT_RAKE,
            'rgba(134, 239, 172, 0.05)'
          ),
          this.createDataset(
            'No Showdown BB/100',
            data.noShowdownOnlyBB100,
            CHART_COLORS.NO_SHOWDOWN_PROFIT,
            `rgba(239, 68, 68, ${CHART_COLORS.BACKGROUND_ALPHA})`
          ),
          this.createDataset(
            'Showdown BB/100',
            data.showdownOnlyBB100,
            CHART_COLORS.SHOWDOWN_PROFIT,
            `rgba(59, 130, 246, ${CHART_COLORS.BACKGROUND_ALPHA})`
          ),
          this.createDataset(
            'Actual profit BB/100',
            data.allHandsActualBB100,
            CHART_COLORS.ACTUAL_PROFIT,
            `rgba(34, 197, 94, ${CHART_COLORS.BACKGROUND_ALPHA})`
          )
        ]
      },
      options: this.createChartOptions(config, yAxisRange)
    };
  }

  /**
   * Build street profit chart configuration
   */
  private buildBarChartConfiguration(data: StreetProfitBarData, config: ChartConfig): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels: data.dataPoints.map(point => point.category),
        datasets: [{
          label: 'Cumulative Profit',
          data: data.dataPoints.map(point => point.totalProfit),
          backgroundColor: data.dataPoints.map(point => 
            point.totalProfit >= 0 ? CHART_COLORS.BAR_WINS : CHART_COLORS.BAR_LOSSES
          ),
          borderColor: data.dataPoints.map(point => 
            point.totalProfit >= 0 ? CHART_COLORS.BAR_WINS_BORDER : CHART_COLORS.BAR_LOSSES_BORDER
          ),
          borderWidth: 1,
          barPercentage: 0.8,
          categoryPercentage: 0.9
        }]
      },
      options: {
        responsive: false,
        animation: false as const,
        layout: {
          padding: 20
        },
        backgroundColor: CHARTS.BACKGROUND_COLOR,
        scales: {
          x: {
            title: {
              display: true,
              text: config.xAxisLabel,
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              font: {
                size: 10
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            title: {
              display: true,
              text: config.yAxisLabel,
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            ticks: {
              font: {
                size: 12
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            },
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: config.title,
            font: {
              size: 18,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 30
            }
          },
          legend: {
            display: true,
            position: 'top' as const,
            labels: {
              font: {
                size: 12
              }
            }
          },
          datalabels: {
            display: true,
            anchor: 'end' as const,
            align: 'top' as const,
            color: '#000000',
            font: {
              size: 11,
              weight: 'bold'
            },
            formatter: (value: number) => {
              // Format the value with appropriate decimal places and sign
              const formattedValue = Math.abs(value) < 0.01 ? value.toFixed(3) : value.toFixed(2);
              return value >= 0 ? `+${formattedValue}` : formattedValue;
            },
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            borderColor: 'rgba(0, 0, 0, 0.2)',
            borderWidth: 1,
            borderRadius: 4,
            padding: {
              top: 2,
              right: 4,
              bottom: 2,
              left: 4
            }
          }
        }
      }
    };
  }

  /**
   * Create dataset for line charts
   */
  private createDataset(
    label: string, 
    dataPoints: ChartDataPoint[], 
    borderColor: string, 
    backgroundColor: string
  ) {
    return {
      label,
      data: dataPoints.map(point => ({
        x: point.handNumber,
        y: point.value
      })),
      borderColor,
      backgroundColor,
      borderWidth: CHART_COLORS.BORDER_WIDTH,
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 3
    };
  }

  /**
   * Calculate Y-axis range for BB/100 data
   */
  private calculateOptimalYAxisRange(data: BB100ChartData): YAxisRange {
    const allValues = this.getAllBB100Values(data);

    if (allValues.length === 0) {
      return { min: -10, max: 10 };
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // If all values are close to zero, set reasonable default range
    if (Math.abs(max - min) < 1) {
      const center = (max + min) / 2;
      return {
        min: center - 5,
        max: center + 5
      };
    }

    // Add 20% padding to the actual range for better visualization
    const range = max - min;
    const padding = range * 0.2;
    
    return {
      min: Math.floor((min - padding) * 10) / 10,
      max: Math.ceil((max + padding) * 10) / 10
    };
  }

  /**
   * Get all BB/100 values for range calculation
   */
  private getAllBB100Values(data: BB100ChartData): number[] {
    return [
      ...data.allHandsWithRakeBB100.map(point => point.value),
      ...data.allHandsActualBB100.map(point => point.value),
      ...data.showdownOnlyBB100.map(point => point.value),
      ...data.noShowdownOnlyBB100.map(point => point.value)
    ];
  }

  /**
   * Calculate final values for street profit chart
   */
  private extractStreetProfitFinalValues(stats: StreetProfitStats[]): Record<string, number> {
    const finalValues: Record<string, number> = {};
    stats.forEach(stat => {
      finalValues[stat.category] = stat.totalProfit;
    });
    return finalValues;
  }

  /**
   * Calculate final values for BB/100 chart
   */
  private extractBB100FinalValues(data: BB100ChartData): Record<string, number> {
    return {
      'Profit without rake BB/100': this.getLastValue(data.allHandsWithRakeBB100),
      'Actual profit BB/100': this.getLastValue(data.allHandsActualBB100),
      'Showdown BB/100': this.getLastValue(data.showdownOnlyBB100),
      'No Showdown BB/100': this.getLastValue(data.noShowdownOnlyBB100)
    };
  }

  /**
   * Create chart options with standardized styling
   */
  private createChartOptions(config: ChartConfig, yAxisRange?: YAxisRange) {
    return {
      responsive: false,
      animation: false as const,
      layout: {
        padding: 0
      },
      backgroundColor: CHARTS.BACKGROUND_COLOR,
      scales: {
        x: this.createXAxisConfig(config.xAxisLabel),
        y: this.createYAxisConfig(config.yAxisLabel, yAxisRange)
      },
      plugins: {
        title: this.createTitleConfig(config.title),
        legend: this.createLegendConfig(),
        // Explicitly disable datalabels for line charts to maintain readability
        datalabels: {
          display: false
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
   * Create X-axis configuration
   */
  private createXAxisConfig(xAxisLabel: string) {
    return {
      type: 'linear' as const,
      display: true,
      title: {
        display: true,
        text: xAxisLabel,
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
    };
  }

  /**
   * Create Y-axis configuration
   */
  private createYAxisConfig(yAxisLabel: string, yAxisRange?: YAxisRange) {
    return {
      display: true,
      title: {
        display: true,
        text: yAxisLabel,
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
    };
  }

  /**
   * Create title configuration
   */
  private createTitleConfig(title: string) {
    return {
      display: true,
      text: title,
      font: {
        size: 20,
        weight: 'bold' as const
      },
      color: 'black'
    };
  }

  /**
   * Create legend configuration
   */
  private createLegendConfig() {
    return {
      display: true,
      position: 'top' as const,
      labels: {
        font: {
          size: 12
        },
        color: 'black'
      }
    };
  }

  /**
   * Render and save chart to file
   */
  private async renderChart(
    chartConfig: ChartConfiguration, 
    config: ChartConfig, 
    finalValues: Record<string, number>
  ): Promise<ChartGenerationResult> {
    await ensureDirectoryExists(this.outputDir);

    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // Draw white background for JPG output
    this.drawBackground(ctx, config);

    const chart = new Chart(ctx as any, chartConfig);

    // Wait for chart to render completely
    await this.waitForRender();

    // Create final canvas with white background
    const finalCanvas = this.createFinalCanvas(canvas, config);
    const filePath = path.join(this.outputDir, config.fileName);

    // Save chart as JPG file
    await this.saveChart(finalCanvas, filePath);

    // Clean up memory
    chart.destroy();

    return {
      filePath,
      totalHands: this.calculateTotalHands(chartConfig),
      finalValues
    };
  }

  /**
   * Draw white background on canvas
   */
  private drawBackground(ctx: any, config: ChartConfig): void {
    ctx.save();
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, config.height);
    ctx.restore();
  }

  /**
   * Wait for chart rendering to complete
   */
  private async waitForRender(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Create final canvas with background
   */
  private createFinalCanvas(originalCanvas: any, config: ChartConfig): any {
    const { createCanvas } = require('canvas');
    const finalCanvas = createCanvas(config.width, config.height);
    const finalCtx = finalCanvas.getContext('2d');
    
    // Draw white background
    finalCtx.fillStyle = CHARTS.BACKGROUND_COLOR;
    finalCtx.fillRect(0, 0, config.width, config.height);
    
    // Draw original chart content
    finalCtx.drawImage(originalCanvas, 0, 0);

    return finalCanvas;
  }

  /**
   * Save chart to file
   */
  private async saveChart(canvas: any, filePath: string): Promise<void> {
    const fs = await import('fs-extra');
    const buffer = canvas.toBuffer('image/jpeg', { 
      quality: CHARTS.DEFAULT_QUALITY,
      chromaSubsampling: false
    });
    await fs.writeFile(filePath, buffer);
  }

  /**
   * Calculate total hands from chart configuration
   */
  private calculateTotalHands(chartConfig: ChartConfiguration): number {
    const datasets = chartConfig.data?.datasets;
    return datasets && datasets[0] && datasets[0].data 
      ? (datasets[0].data as any[]).length 
      : 0;
  }

  /**
   * Get the last value from a data series
   */
  private getLastValue(dataPoints: ChartDataPoint[]): number {
    return dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : 0;
  }

  /**
   * Extract final values for profit charts
   */
  private extractProfitFinalValues(data: ProfitChartData): Record<string, number> {
    return {
      'Profit without rake': this.getLastValue(data.allHandsWithRake),
      'Actual profit (after rake)': this.getLastValue(data.allHandsActual),
      'Showdown profit': this.getLastValue(data.showdownOnly),
      'No showdown profit': this.getLastValue(data.noShowdownOnly)
    };
  }
} 