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
  CompleteStreetProfitChartData,
  StreetProfitAnalysisData,
  StreetProfitPositionStats
} from './chart-types';
import { CHARTS, CHART_COLORS } from '../constants';
import { formatTimestamp, ensureDirectoryExists } from '../utils';

// Register Chart.js components
Chart.register(...registerables, ChartDataLabels);

type ChartType = 'profit' | 'bb100' | 'street-profit-analysis';

/**
 * Chart generator class responsible for creating visual charts from poker data
 * Supports line charts for trends and bar charts for categorical data
 */
export class ChartGenerator {
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  // ===== PUBLIC CHART GENERATION METHODS =====

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
   * Generate BB/100 trend chart showing BB/100 over time
   */
  async generateBB100Chart(data: BB100ChartData): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('bb100');
    const yAxisRange = this.calculateOptimalYAxisRange(data);
    const chartConfig = this.buildBB100ChartConfiguration(data, config, yAxisRange);
    
    const finalValues = this.extractBB100FinalValues(data);
    return this.renderChart(chartConfig, config, finalValues);
  }



  /**
   * Generate street profit analysis chart with 5 separate bar charts
   */
  async generateStreetProfitAnalysisChart(data: CompleteStreetProfitChartData): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('street-profit-analysis');
    const finalValues = this.extractStreetProfitFinalValues(data);
    
    // Create 5 separate charts for each stage
    const filePath = await this.renderStreetProfitChart(data, config);
    
    return {
      filePath,
      totalHands: this.calculateTotalHandsFromStreetProfit(data),
      finalValues
    };
  }

  // ===== CHART CONFIGURATION METHODS =====

  /**
   * Create standardized chart configuration based on chart type
   */
  private createChartConfig(type: ChartType): ChartConfig {
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

      'street-profit-analysis': {
        title: 'Poker Street Profit Analysis',
        xAxisLabel: 'Position',
        yAxisLabel: 'Profit (BB)',
        fileName: `poker-street-profit-analysis-chart-${timestamp}`
      }
    };

    const baseConfig = configs[type];
    return {
      width: CHARTS.DEFAULT_WIDTH,
      height: type === 'street-profit-analysis' ? CHARTS.DEFAULT_HEIGHT * 2 : CHARTS.DEFAULT_HEIGHT,
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

  // ===== DATASET AND CALCULATION METHODS =====

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



  // ===== COMPOSITE CHART RENDERING METHODS =====



  /**
   * Calculate total hands from street profit data
   */
  private calculateTotalHandsFromStreetProfit(data: CompleteStreetProfitChartData): number {
    let totalHands = 0;
    Object.values(data).forEach((stageData: StreetProfitAnalysisData) => {
      stageData.positions.forEach((pos: StreetProfitPositionStats) => {
        totalHands += pos.profitCount + pos.lossCount;
      });
    });
    return totalHands;
  }

  /**
   * Extract final values for street profit chart
   */
  private extractStreetProfitFinalValues(data: CompleteStreetProfitChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    Object.entries(data).forEach(([stage, stageData]: [string, StreetProfitAnalysisData]) => {
      const stageProfit = stageData.positions.reduce((sum: number, pos: StreetProfitPositionStats) => sum + pos.profit + pos.loss, 0);
      const stageHands = stageData.positions.reduce((sum: number, pos: StreetProfitPositionStats) => sum + pos.profitCount + pos.lossCount, 0);
      finalValues[`${stage.charAt(0).toUpperCase() + stage.slice(1)} (${stageHands} hands)`] = stageProfit;
    });
    
    return finalValues;
  }



  /**
   * Render street profit chart with 5 separate bar charts for each stage
   */
  private async renderStreetProfitChart(
    data: CompleteStreetProfitChartData, 
    config: ChartConfig
  ): Promise<string> {
    await ensureDirectoryExists(this.outputDir);

    // Create a large canvas that will hold all 5 charts
    const totalHeight = config.height;
    const separatorMargin = 10; // Margin between charts and separators
    const chartHeight = Math.floor((totalHeight - (4 * separatorMargin)) / 5); // 4 separators between 5 charts
    const canvas = createCanvas(config.width, totalHeight);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, totalHeight);

    let currentY = 0;

    // Define the stages in order
    const stages = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const stageLabels = {
      'preflop': 'Preflop Profit Analysis',
      'flop': 'Flop Profit Analysis', 
      'turn': 'Turn Profit Analysis',
      'river': 'River Profit Analysis',
      'showdown': 'Showdown Profit Analysis'
    };

    // Render each stage chart
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageData = data[stage as keyof CompleteStreetProfitChartData];
      
              await this.renderSingleStreetProfitSection(
          ctx, 
          stageData, 
          stageLabels[stage as keyof typeof stageLabels], 
          0, 
          currentY, 
          config.width, 
          chartHeight
        );
      
      currentY += chartHeight;
      
      // Add separator line between charts (except after the last chart)
      if (i < stages.length - 1) {
        currentY += separatorMargin / 2; // Add margin before separator
        
        ctx.strokeStyle = 'rgba(50, 50, 50, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(config.width, currentY);
        ctx.stroke();
        
        currentY += separatorMargin / 2; // Add margin after separator
      }
    }

    // Save the composite chart
    const filePath = path.join(this.outputDir, config.fileName);
    await this.saveChart(canvas, filePath);

    return filePath;
  }





  /**
   * Render a single street profit chart section with profit/loss bars per position
   */
  private async renderSingleStreetProfitSection(
    ctx: any,
    data: StreetProfitAnalysisData,
    title: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    // Save the current context state
    ctx.save();
    
    // Set clipping region for this chart section
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    
    // Translate to the chart section position
    ctx.translate(x, y);
    
    // Draw section background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);
    
    // Define chart margins and areas
    const marginTop = 40;
    const marginBottom = 60;
    const marginLeft = 80;
    const marginRight = 30;
    
    const chartAreaX = marginLeft;
    const chartAreaY = marginTop;
    const chartAreaWidth = width - marginLeft - marginRight;
    const chartAreaHeight = height - marginTop - marginBottom;
    
    // Draw title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 20);
    
    if (data.positions && data.positions.length > 0) {
      // Calculate the range for scaling - include both profit and loss values
      const allValues = data.positions.flatMap(pos => [pos.profit, pos.loss]);
      const minValue = Math.min(0, ...allValues);
      const maxValue = Math.max(0, ...allValues);
      const valueRange = maxValue - minValue || 1;
      
      // Draw Y-axis grid lines and labels
      this.drawYAxisGrid(ctx, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight, minValue, maxValue);
      
      // Draw zero baseline (horizontal line at y=0)
      const zeroY = chartAreaY + chartAreaHeight * (1 - (-minValue / valueRange));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(chartAreaX, zeroY);
      ctx.lineTo(chartAreaX + chartAreaWidth, zeroY);
      ctx.stroke();
      
      // Calculate bar dimensions - 3 bars per position (profit, total P&L, loss)
      const positionCount = data.positions.length;
      const groupWidth = chartAreaWidth / positionCount;
      const barWidth = groupWidth * 0.25; // Each bar takes 25% of group width
      const barSpacing = groupWidth * 0.08; // 8% spacing between bars in a group
      
              // Calculate gradient intensity based on value magnitude
        const maxProfit = Math.max(...data.positions.map((p: StreetProfitPositionStats) => p.profit));
        const maxLoss = Math.min(...data.positions.map((p: StreetProfitPositionStats) => p.loss));
        const maxAbsTotalPnL = Math.max(...data.positions.map((p: StreetProfitPositionStats) => Math.abs(p.totalPnL)));
      
              // Draw bars and labels for each position
        data.positions.forEach((position: StreetProfitPositionStats, index: number) => {
        const groupX = chartAreaX + index * groupWidth;
        const centerX = groupX + groupWidth / 2;
        
        // Bar positions: profit (left), total P&L (center), loss (right)
        const profitBarX = centerX - barWidth - barSpacing;
        const totalPnLBarX = centerX - barWidth / 2;
        const lossBarX = centerX + barSpacing;
        
        // Draw profit bar (green) - left position
        if (position.profit > 0) {
          const profitBarHeight = (position.profit / valueRange) * chartAreaHeight * 0.8;
          const profitBarY = zeroY - profitBarHeight;
          
          // Calculate gradient intensity for profit
          const profitRatio = maxProfit > 0 ? position.profit / maxProfit : 0;
          const profitIntensity = 0.3 + (profitRatio * 0.5); // 0.3 to 0.8
          
          ctx.fillStyle = `rgba(34, 197, 94, ${profitIntensity})`;
          ctx.fillRect(profitBarX, profitBarY, barWidth, profitBarHeight);
          
          // Draw profit value label
          ctx.fillStyle = '#000000';
          ctx.font = '8px Arial';
          ctx.textAlign = 'center';
          const profitLabel = `+${position.profit.toFixed(1)}`;
          ctx.fillText(profitLabel, profitBarX + barWidth / 2, profitBarY - 3);
        }
        
        // Draw total P&L bar (center position) - green if positive, red if negative
        if (position.totalPnL !== 0) {
          const isPositive = position.totalPnL > 0;
          const totalPnLBarHeight = Math.abs(position.totalPnL) / valueRange * chartAreaHeight * 0.8;
          const totalPnLBarY = isPositive ? zeroY - totalPnLBarHeight : zeroY;
          
          // Calculate gradient intensity for total P&L
          const totalPnLRatio = maxAbsTotalPnL > 0 ? Math.abs(position.totalPnL) / maxAbsTotalPnL : 0;
          const totalPnLIntensity = 0.4 + (totalPnLRatio * 0.4); // 0.4 to 0.8
          
          const color = isPositive ? `rgba(34, 197, 94, ${totalPnLIntensity})` : `rgba(239, 68, 68, ${totalPnLIntensity})`;
          ctx.fillStyle = color;
          ctx.fillRect(totalPnLBarX, totalPnLBarY, barWidth, totalPnLBarHeight);
          
          // Draw total P&L value label
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 8px Arial';
          ctx.textAlign = 'center';
          const totalPnLLabel = isPositive ? `+${position.totalPnL.toFixed(1)}` : position.totalPnL.toFixed(1);
          const labelY = isPositive ? totalPnLBarY - 3 : totalPnLBarY + totalPnLBarHeight + 10;
          ctx.fillText(totalPnLLabel, totalPnLBarX + barWidth / 2, labelY);
        }
        
        // Draw loss bar (red) - right position
        if (position.loss < 0) {
          const lossBarHeight = Math.abs(position.loss) / valueRange * chartAreaHeight * 0.8;
          const lossBarY = zeroY;
          
          // Calculate gradient intensity for loss
          const lossRatio = maxLoss < 0 ? Math.abs(position.loss) / Math.abs(maxLoss) : 0;
          const lossIntensity = 0.3 + (lossRatio * 0.5); // 0.3 to 0.8
          
          ctx.fillStyle = `rgba(239, 68, 68, ${lossIntensity})`;
          ctx.fillRect(lossBarX, lossBarY, barWidth, lossBarHeight);
          
          // Draw loss value label
          ctx.fillStyle = '#000000';
          ctx.font = '8px Arial';
          ctx.textAlign = 'center';
          const lossLabel = position.loss.toFixed(1);
          ctx.fillText(lossLabel, lossBarX + barWidth / 2, lossBarY + lossBarHeight + 10);
        }
        
        // Draw position label
        ctx.fillStyle = '#000000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(position.position, centerX, chartAreaY + chartAreaHeight + 20);
        
        // Draw vertical separator line between groups (except after the last group)
        if (index < data.positions.length - 1) {
          const separatorX = groupX + groupWidth;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(separatorX, chartAreaY);
          ctx.lineTo(separatorX, chartAreaY + chartAreaHeight);
          ctx.stroke();
        }
        
        // Draw group border for Overall group (first group)
        if (index === 0) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.rect(groupX + 5, chartAreaY, groupWidth - 10, chartAreaHeight);
          ctx.stroke();
        }
      });
      
      // Draw Y-axis label
      ctx.save();
      ctx.translate(15, chartAreaY + chartAreaHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Profit (BB)', 0, 0);
      ctx.restore();
    }
    
    // Restore context state
    ctx.restore();
  }

  // ===== CHART RENDERING HELPER METHODS =====

  /**
   * Draw Y-axis grid lines and labels
   */
  private drawYAxisGrid(
    ctx: any, 
    chartX: number, 
    chartY: number, 
    chartWidth: number, 
    chartHeight: number, 
    minValue: number, 
    maxValue: number
  ): void {
    const gridLines = 5;
    const valueRange = maxValue - minValue;
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.font = '8px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#000000';
    
    for (let i = 0; i <= gridLines; i++) {
      const y = chartY + (i / gridLines) * chartHeight;
      const value = maxValue - (i / gridLines) * valueRange;
      
      // Draw grid line
      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartWidth, y);
      ctx.stroke();
      
      // Draw label
      ctx.fillText(value.toFixed(1), chartX - 5, y + 3);
    }
  }

  /**
   * Draw X-axis grid lines
   */
  private drawXAxisGrid(
    ctx: any,
    chartX: number,
    chartY: number,
    chartWidth: number,
    chartHeight: number,
    dataPointCount: number
  ): void {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= dataPointCount; i++) {
      const x = chartX + (i / dataPointCount) * chartWidth;
      
      // Draw grid line
      ctx.beginPath();
      ctx.moveTo(x, chartY);
      ctx.lineTo(x, chartY + chartHeight);
      ctx.stroke();
    }
  }

  // ===== CHART OPTIONS CONFIGURATION METHODS =====

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

  // ===== UTILITY METHODS =====

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

  /**
   * Extract final values for BB/100 chart
   */
  private extractBB100FinalValues(data: BB100ChartData): Record<string, number> {
    return {
      'Profit without rake BB/100': this.getLastValue(data.allHandsWithRakeBB100),
      'Actual profit BB/100': this.getLastValue(data.allHandsActualBB100),
      'Showdown BB/100': this.getLastValue(data.showdownOnlyBB100),
      'No Showdown BB/100': this.getLastValue(data.noShowdownOnlyBB100)
    };
  }
} 