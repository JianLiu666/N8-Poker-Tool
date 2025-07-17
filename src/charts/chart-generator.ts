import { Chart, ChartConfiguration, registerables } from 'chart.js';
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
  StreetProfitPositionStats,
  CompleteActionAnalysisChartData,
  StreetActionAnalysisData,
  ActionAnalysisPositionStats,
  CompletePositionProfitChartData,
  PositionProfitChartData,
  CompletePositionBB100ChartData,
  PositionBB100ChartData,
  CombinedPositionChartData
} from '../types';
import { CHARTS, CHART_COLORS, CHART_LAYOUT, POKER } from '../constants';
import { formatTimestamp, ensureDirectoryExists } from '../utils';

// Register Chart.js components
Chart.register(...registerables);

type ChartType = 'profit-analysis' | 'street-analysis' | 'position-profit-analysis' | 'position-bb100-analysis' | 'combined-position-analysis';

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
   * Generate position-specific profit trend analysis chart with 7 vertical subcharts
   */
  async generatePositionProfitAnalysisChart(
    positionData: CompletePositionProfitChartData
  ): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('position-profit-analysis');
    const finalValues = this.extractPositionProfitFinalValues(positionData);
    
    // Create position profit analysis chart
    const filePath = await this.renderPositionProfitAnalysisChart(positionData, config);
    
    // Calculate total hands from overall data
    const totalHands = positionData.overall.actualProfit.length;
    
    return {
      filePath,
      totalHands,
      finalValues
    };
  }

  /**
   * Generate position-specific BB/100 trend analysis chart with 7 vertical subcharts
   */
  async generatePositionBB100AnalysisChart(
    positionData: CompletePositionBB100ChartData
  ): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('position-bb100-analysis');
    const finalValues = this.extractPositionBB100FinalValues(positionData);
    
    // Create position BB/100 analysis chart
    const filePath = await this.renderPositionBB100AnalysisChart(positionData, config);
    
    // Calculate total hands from overall data
    const totalHands = positionData.overall.actualBB100.length;
    
    return {
      filePath,
      totalHands,
      finalValues
    };
  }

  /**
   * Generate combined position analysis chart with profit (left) and BB/100 (right)
   */
  async generateCombinedPositionAnalysisChart(
    combinedData: CombinedPositionChartData
  ): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('combined-position-analysis');
    const finalValues = this.extractCombinedPositionFinalValues(combinedData);
    
    // Create combined position analysis chart
    const filePath = await this.renderCombinedPositionAnalysisChart(combinedData, config);
    
    // Calculate total hands from profit data
    const totalHands = combinedData.profitData.overall.actualProfit.length;
    
    return {
      filePath,
      totalHands,
      finalValues
    };
  }

  /**
   * Generate street analysis chart with Action Analysis on left and Street Profit Analysis on right
   */
  async generateStreetAnalysisChart(
    actionData: CompleteActionAnalysisChartData,
    profitData: CompleteStreetProfitChartData
  ): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('street-analysis');
    const actionFinalValues = this.extractActionAnalysisFinalValues(actionData);
    const profitFinalValues = this.extractStreetProfitFinalValues(profitData);
    
    // Combine final values
    const finalValues = { ...actionFinalValues, ...profitFinalValues };
    
    // Create street analysis chart
    const filePath = await this.renderStreetAnalysisChart(actionData, profitData, config);
    
    return {
      filePath,
      totalHands: this.calculateTotalHandsFromActionAnalysis(actionData),
      finalValues
    };
  }

  /**
   * Generate profit analysis chart with profit and BB/100 trends
   */
  async generateProfitAnalysisChart(
    profitData: ProfitChartData,
    bb100Data: BB100ChartData
  ): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('profit-analysis');
    const profitFinalValues = this.extractProfitFinalValues(profitData);
    const bb100FinalValues = this.extractBB100FinalValues(bb100Data);
    
    // Combine final values
    const finalValues = { ...profitFinalValues, ...bb100FinalValues };
    
    // Create profit analysis chart
    const filePath = await this.renderProfitAnalysisChart(profitData, bb100Data, config);
    
    return {
      filePath,
      totalHands: profitData.allHandsWithRake.length,
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
      'profit-analysis': {
        title: 'Poker Analysis - Profit & BB/100',
        xAxisLabel: 'Hands',
        yAxisLabel: 'Analysis',
        fileName: `poker-profit-analysis-chart-${timestamp}`
      },
      'street-analysis': {
        title: 'Poker Analysis - Action & Profit',
        xAxisLabel: 'Position',
        yAxisLabel: 'Analysis',
        fileName: `poker-street-analysis-chart-${timestamp}`
      },
      'position-profit-analysis': {
        title: 'Position-Specific Profit Trend Analysis',
        xAxisLabel: 'Hands',
        yAxisLabel: 'Cumulative Profit',
        fileName: `poker-position-profit-analysis-chart-${timestamp}`
      },
      'position-bb100-analysis': {
        title: 'Position-Specific BB/100 Trend Analysis',
        xAxisLabel: 'Hands',
        yAxisLabel: 'BB/100',
        fileName: `poker-position-bb100-analysis-chart-${timestamp}`
      },
      'combined-position-analysis': {
        title: 'Position-Specific Profit & BB/100 Analysis',
        xAxisLabel: 'Hands',
        yAxisLabel: 'Analysis',
        fileName: `poker-combined-position-analysis-chart-${timestamp}`
      }
    };

    const baseConfig = configs[type];
    return {
      width: CHARTS.STREET_ANALYSIS_WIDTH,
      height: CHARTS.STREET_ANALYSIS_HEIGHT,
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
   * Build position profit chart configuration for a single position
   */
  private buildPositionProfitChartConfiguration(data: PositionProfitChartData, config: ChartConfig, yAxisRange?: YAxisRange): ChartConfiguration {
    const datasets = [
      this.createDataset(
        'Actual profit',
        data.actualProfit,
        CHART_COLORS.ACTUAL_PROFIT,
        `rgba(34, 197, 94, ${CHART_COLORS.BACKGROUND_ALPHA})`
      ),
      this.createDataset(
        'Showdown Profit',
        data.showdownProfit,
        CHART_COLORS.SHOWDOWN_PROFIT,
        `rgba(59, 130, 246, ${CHART_COLORS.BACKGROUND_ALPHA})`
      ),
      this.createDataset(
        'No Showdown Profit',
        data.noShowdownProfit,
        CHART_COLORS.NO_SHOWDOWN_PROFIT,
        `rgba(239, 68, 68, ${CHART_COLORS.BACKGROUND_ALPHA})`
      )
    ];

    // Add profit without rake line only for Overall position
    if (data.position === 'Overall') {
      datasets.unshift(
        this.createDataset(
          'Profit without rake',
          data.profitWithoutRake,
          CHART_COLORS.PROFIT_WITHOUT_RAKE,
          'rgba(134, 239, 172, 0.05)'
        )
      );
    }

    return {
      type: 'line',
      data: { datasets },
      options: this.createChartOptions(config, yAxisRange)
    };
  }

  /**
   * Build position BB/100 chart configuration for a single position
   */
  private buildPositionBB100ChartConfiguration(data: PositionBB100ChartData, config: ChartConfig, yAxisRange?: YAxisRange): ChartConfiguration {
    const datasets = [
      this.createDataset(
        'Actual profit BB/100',
        data.actualBB100,
        CHART_COLORS.ACTUAL_PROFIT,
        `rgba(34, 197, 94, ${CHART_COLORS.BACKGROUND_ALPHA})`
      ),
      this.createDataset(
        'Showdown BB/100',
        data.showdownBB100,
        CHART_COLORS.SHOWDOWN_PROFIT,
        `rgba(59, 130, 246, ${CHART_COLORS.BACKGROUND_ALPHA})`
      ),
      this.createDataset(
        'No Showdown BB/100',
        data.noShowdownBB100,
        CHART_COLORS.NO_SHOWDOWN_PROFIT,
        `rgba(239, 68, 68, ${CHART_COLORS.BACKGROUND_ALPHA})`
      )
    ];

    // Add profit without rake BB/100 line only for Overall position
    if (data.position === 'Overall') {
      datasets.unshift(
        this.createDataset(
          'Profit without rake BB/100',
          data.profitWithoutRakeBB100,
          CHART_COLORS.PROFIT_WITHOUT_RAKE,
          'rgba(134, 239, 172, 0.05)'
        )
      );
    }

    return {
      type: 'line',
      data: { datasets },
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







  // ===== COMPOSITE CHART RENDERING METHODS =====




  /**
   * Extract final values for position profit chart
   */
  private extractPositionProfitFinalValues(data: CompletePositionProfitChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    Object.entries(data).forEach(([positionKey, positionData]: [string, PositionProfitChartData]) => {
      const position = positionData.position;
      const handCount = positionData.actualProfit.length;
      
      if (handCount > 0) {
        finalValues[`${position} Actual (${handCount} hands)`] = this.getLastValue(positionData.actualProfit);
        finalValues[`${position} Showdown`] = this.getLastValue(positionData.showdownProfit);
        finalValues[`${position} No Showdown`] = this.getLastValue(positionData.noShowdownProfit);
      }
    });
    
    return finalValues;
  }

  /**
   * Extract final values for position BB/100 chart
   */
  private extractPositionBB100FinalValues(data: CompletePositionBB100ChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    Object.entries(data).forEach(([positionKey, positionData]: [string, PositionBB100ChartData]) => {
      const position = positionData.position;
      const handCount = positionData.actualBB100.length;
      
      if (handCount > 0) {
        finalValues[`${position} Actual BB/100 (${handCount} hands)`] = this.getLastValue(positionData.actualBB100);
        finalValues[`${position} Showdown BB/100`] = this.getLastValue(positionData.showdownBB100);
        finalValues[`${position} No Showdown BB/100`] = this.getLastValue(positionData.noShowdownBB100);
      }
    });
    
    return finalValues;
  }

  /**
   * Extract final values for combined position chart
   */
  private extractCombinedPositionFinalValues(data: CombinedPositionChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    // Extract profit data final values
    Object.entries(data.profitData).forEach(([positionKey, positionData]: [string, PositionProfitChartData]) => {
      const position = positionData.position;
      const handCount = positionData.actualProfit.length;
      
      if (handCount > 0) {
        finalValues[`${position} Actual Profit (${handCount} hands)`] = this.getLastValue(positionData.actualProfit);
        finalValues[`${position} Showdown Profit`] = this.getLastValue(positionData.showdownProfit);
        finalValues[`${position} No Showdown Profit`] = this.getLastValue(positionData.noShowdownProfit);
        
        if (position === 'Overall') {
          finalValues[`${position} Profit without rake`] = this.getLastValue(positionData.profitWithoutRake);
        }
      }
    });
    
    // Extract BB/100 data final values  
    Object.entries(data.bb100Data).forEach(([positionKey, positionData]: [string, PositionBB100ChartData]) => {
      const position = positionData.position;
      const handCount = positionData.actualBB100.length;
      
      if (handCount > 0) {
        finalValues[`${position} Actual BB/100`] = this.getLastValue(positionData.actualBB100);
        finalValues[`${position} Showdown BB/100`] = this.getLastValue(positionData.showdownBB100);
        finalValues[`${position} No Showdown BB/100`] = this.getLastValue(positionData.noShowdownBB100);
        
        if (position === 'Overall') {
          finalValues[`${position} Profit without rake BB/100`] = this.getLastValue(positionData.profitWithoutRakeBB100);
        }
      }
    });
    
    return finalValues;
  }

  /**
   * Extract final values for street profit chart
   */
  private extractStreetProfitFinalValues(data: CompleteStreetProfitChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    Object.entries(data).forEach(([stage, stageData]: [string, StreetProfitAnalysisData]) => {
      const stageProfit = stageData.positions.reduce((sum: number, pos: StreetProfitPositionStats) => sum + pos.profit + pos.loss, 0);
      const stageHands = stageData.positions.reduce((sum: number, pos: StreetProfitPositionStats) => sum + pos.profitCount + pos.lossCount, 0);
      finalValues[`${this.capitalizeFirstLetter(stage)} (${stageHands} hands)`] = stageProfit;
    });
    
    return finalValues;
  }








  /**
   * Draw section separator line
   */
  private drawSectionSeparator(ctx: any, currentY: number, width: number): number {
    currentY += CHART_LAYOUT.SEPARATOR_MARGIN / 2;
    
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(width, currentY);
    ctx.stroke();
    
    return currentY + CHART_LAYOUT.SEPARATOR_MARGIN / 2;
  }

  /**
   * Render a street profit chart section with profit/loss bars per position
   */
  private async renderStreetProfitSection(
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
    const chartAreaX = CHART_LAYOUT.MARGIN_LEFT;
    const chartAreaY = CHART_LAYOUT.MARGIN_TOP;
    const chartAreaWidth = width - CHART_LAYOUT.MARGIN_LEFT - CHART_LAYOUT.MARGIN_RIGHT;
    const chartAreaHeight = height - CHART_LAYOUT.MARGIN_TOP - CHART_LAYOUT.MARGIN_BOTTOM;
    
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
      const barWidth = groupWidth * CHART_LAYOUT.BAR_GROUP_WIDTH_RATIO;
      const barSpacing = groupWidth * CHART_LAYOUT.BAR_SPACING_RATIO;
      
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
          const profitIntensity = this.calculateGradientIntensity(position.profit, maxProfit, CHART_LAYOUT.PROFIT_GRADIENT_RANGE);
          
          ctx.fillStyle = this.createGradientColor(CHART_COLORS.PROFIT_GREEN, profitIntensity);
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
          const totalPnLIntensity = this.calculateGradientIntensity(position.totalPnL, maxAbsTotalPnL, CHART_LAYOUT.TOTAL_PNL_GRADIENT_RANGE);
          
          const color = isPositive 
            ? this.createGradientColor(CHART_COLORS.PROFIT_GREEN, totalPnLIntensity)
            : this.createGradientColor(CHART_COLORS.LOSS_RED, totalPnLIntensity);
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
          const lossIntensity = this.calculateGradientIntensity(position.loss, maxLoss, CHART_LAYOUT.PROFIT_GRADIENT_RANGE);
          
          ctx.fillStyle = this.createGradientColor(CHART_COLORS.LOSS_RED, lossIntensity);
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
        legend: this.createLegendConfig()
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
        color: (context: any) => {
          // Make the zero baseline darker but not too black for better visibility
          if (context.tick.value === 0) {
            return 'rgba(0, 0, 0, 0.2)';
          }
          return 'rgba(0, 0, 0, 0.1)';
        },
        lineWidth: (context: any) => {
          // Make the zero baseline thicker for better visibility
          if (context.tick.value === 0) {
            return 2;
          }
          return 1;
        }
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

  // ===== ACTION ANALYSIS HELPER METHODS =====


  /**
   * Render street analysis chart with Action Analysis on left and Street Profit Analysis on right
   */
  private async renderStreetAnalysisChart(
    actionData: CompleteActionAnalysisChartData,
    profitData: CompleteStreetProfitChartData,
    config: ChartConfig
  ): Promise<string> {
    await ensureDirectoryExists(this.outputDir);

    // Create high-resolution canvas
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, config.height);

    // Define dimensions for left and right halves
    const halfWidth = config.width / 2;
    const separatorWidth = 4;
    const leftWidth = halfWidth - separatorWidth / 2;
    const rightWidth = halfWidth - separatorWidth / 2;
    const rightStartX = halfWidth + separatorWidth / 2;

    // Draw main title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Poker Analysis - Street Action & Profit', config.width / 2, 40);

    // Draw section titles
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Street Action Analysis', leftWidth / 2, 80);
    ctx.fillText('Street Profit Analysis', rightStartX + rightWidth / 2, 80);

    // Draw separator line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = separatorWidth;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 100);
    ctx.lineTo(halfWidth, config.height - 20);
    ctx.stroke();

    // Calculate chart dimensions for each section
    const chartTopMargin = 100;
    const chartHeight = config.height - chartTopMargin - 20;
    const sectionHeight = Math.floor((chartHeight - (4 * 10)) / 5); // 4 separators between 5 charts

    // Render left side - Action Analysis
    await this.renderActionAnalysisColumnSections(
      ctx,
      actionData,
      0,
      chartTopMargin,
      leftWidth,
      chartHeight,
      sectionHeight
    );

    // Render right side - Street Profit Analysis
    await this.renderStreetProfitColumnSections(
      ctx,
      profitData,
      rightStartX,
      chartTopMargin,
      rightWidth,
      chartHeight,
      sectionHeight
    );

    const filePath = path.join(this.outputDir, config.fileName);
    await this.saveChart(canvas, filePath);
    return filePath;
  }

  /**
   * Render profit analysis chart with vertical layout (profit on top, BB/100 on bottom)
   */
  private async renderProfitAnalysisChart(
    profitData: ProfitChartData,
    bb100Data: BB100ChartData,
    config: ChartConfig
  ): Promise<string> {
    await ensureDirectoryExists(this.outputDir);

    // Create high-resolution canvas
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, config.height);

    // Define dimensions for top and bottom halves
    const halfHeight = config.height / 2;
    const separatorHeight = 4;
    const topHeight = halfHeight - separatorHeight / 2;
    const bottomHeight = halfHeight - separatorHeight / 2;
    const bottomStartY = halfHeight + separatorHeight / 2;

    // Draw main title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Poker Analysis - Profit & BB/100', config.width / 2, 40);

    // Draw section titles
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Profit Trend Analysis', config.width / 2, 80);
    ctx.fillText('BB/100 Trend Analysis', config.width / 2, bottomStartY + 40);

    // Draw separator line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = separatorHeight;
    ctx.beginPath();
    ctx.moveTo(0, halfHeight);
    ctx.lineTo(config.width, halfHeight);
    ctx.stroke();

    // Calculate chart dimensions for each section
    const chartTopMargin = 100;
    const chartWidth = config.width - 40; // 20px margin on each side
    const chartLeftMargin = 20;
    const topChartHeight = topHeight - chartTopMargin - 20;
    const bottomChartHeight = bottomHeight - 60 - 20; // 60px for title, 20px bottom margin

    // Render top section - Profit Chart
    await this.renderProfitSection(
      ctx,
      profitData,
      chartLeftMargin,
      chartTopMargin,
      chartWidth,
      topChartHeight
    );

    // Render bottom section - BB/100 Chart
    await this.renderBB100Section(
      ctx,
      bb100Data,
      chartLeftMargin,
      bottomStartY + 60,
      chartWidth,
      bottomChartHeight
    );

    const filePath = path.join(this.outputDir, config.fileName);
    await this.saveChart(canvas, filePath);
    return filePath;
  }

  /**
   * Render all action analysis sections in a column
   */
  private async renderActionAnalysisColumnSections(
    ctx: any,
    data: CompleteActionAnalysisChartData,
    x: number,
    y: number,
    width: number,
    totalHeight: number,
    sectionHeight: number
  ): Promise<void> {
    const separatorMargin = 10;
    let currentY = y;

    const stages = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const stageLabels = {
      'preflop': 'Preflop Action Analysis',
      'flop': 'Flop Action Analysis', 
      'turn': 'Turn Action Analysis',
      'river': 'River Action Analysis',
      'showdown': 'Showdown Win% Analysis'
    };

    for (const stage of stages) {
      const stageData = data[stage as keyof CompleteActionAnalysisChartData];
      if (stageData) {
        await this.renderActionAnalysisSection(
          ctx,
          stageData,
          stageLabels[stage as keyof typeof stageLabels],
          x,
          currentY,
          width,
          sectionHeight
        );
        currentY += sectionHeight + separatorMargin;
      }
    }
  }

  /**
   * Render all street profit analysis sections in a column
   */
  private async renderStreetProfitColumnSections(
    ctx: any,
    data: CompleteStreetProfitChartData,
    x: number,
    y: number,
    width: number,
    totalHeight: number,
    sectionHeight: number
  ): Promise<void> {
    const separatorMargin = 10;
    let currentY = y;

    const stages = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const stageLabels = {
      'preflop': 'Preflop Profit Analysis',
      'flop': 'Flop Profit Analysis', 
      'turn': 'Turn Profit Analysis',
      'river': 'River Profit Analysis',
      'showdown': 'Showdown Profit Analysis'
    };

    for (const stage of stages) {
      const stageData = data[stage as keyof CompleteStreetProfitChartData];
      if (stageData) {
        await this.renderStreetProfitSection(
          ctx,
          stageData,
          stageLabels[stage as keyof typeof stageLabels],
          x,
          currentY,
          width,
          sectionHeight
        );
        currentY += sectionHeight + separatorMargin;
      }
    }
  }

  /**
   * Create stage labels for action analysis (showdown is special case)
   */
  private createActionAnalysisStageLabels(): Record<string, string> {
    const labels: Record<string, string> = {};
    POKER.STAGES.forEach(stage => {
      if (stage === 'showdown') {
        labels[stage] = 'Showdown Win% Analysis';
      } else {
        labels[stage] = `${this.capitalizeFirstLetter(stage)} Action Analysis`;
      }
    });
    return labels;
  }

  /**
   * Render an action analysis chart section with percentage bars per position
   */
  private async renderActionAnalysisSection(
    ctx: any,
    data: StreetActionAnalysisData,
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
    const chartAreaX = CHART_LAYOUT.MARGIN_LEFT;
    const chartAreaY = CHART_LAYOUT.MARGIN_TOP;
    const chartAreaWidth = width - CHART_LAYOUT.MARGIN_LEFT - CHART_LAYOUT.MARGIN_RIGHT_WITH_LEGEND;
    const chartAreaHeight = height - CHART_LAYOUT.MARGIN_TOP - CHART_LAYOUT.MARGIN_BOTTOM;
    
    // Draw title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 20);
    
    if (data.positions && data.positions.length > 0) {
      // For showdown stage, use single bars for win rate
      if (data.stage === 'showdown') {
        this.drawShowdownWinRateBars(ctx, data, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight, width);
      } else {
        // For other stages, draw stacked action bars
        this.drawActionProportionBars(ctx, data, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight, width);
      }
      
      // Draw legend
      this.drawActionLegend(ctx, width - CHART_LAYOUT.MARGIN_RIGHT_WITH_LEGEND + 10, chartAreaY, data.stage === 'showdown');
    }
    
    // Restore the context state
    ctx.restore();
  }

  /**
   * Draw action proportion bars for preflop, flop, turn, river
   */
  private drawActionProportionBars(
    ctx: any,
    data: StreetActionAnalysisData,
    chartAreaX: number,
    chartAreaY: number,
    chartAreaWidth: number,
    chartAreaHeight: number,
    totalWidth: number
  ): void {
    const positionCount = data.positions.length;
    const groupWidth = chartAreaWidth / positionCount;
    const barWidth = groupWidth * CHART_LAYOUT.BAR_WIDTH_RATIO;
    
    // Draw Y-axis grid and labels
    this.drawPercentageYAxis(ctx, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight);
    
    data.positions.forEach((position: ActionAnalysisPositionStats, index: number) => {
      const barX = chartAreaX + index * groupWidth + (groupWidth - barWidth) / 2;
      
      // Draw stacked bar for actions (in order: Fold, Check, Call, Bet, Raise)
      let currentY = chartAreaY + chartAreaHeight;
      
      // Fold (bottom)
      if (position.foldPct > 0) {
        const foldHeight = (position.foldPct / 100) * chartAreaHeight;
        currentY -= foldHeight;
        ctx.fillStyle = CHART_COLORS.ACTION_FOLD;
        ctx.fillRect(barX, currentY, barWidth, foldHeight);
        
        // Add percentage label if significant
        if (position.foldPct >= 5) {
          ctx.fillStyle = '#000000';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${position.foldPct.toFixed(1)}%`, barX + barWidth / 2, currentY + foldHeight / 2 + 3);
        }
      }
      
      // Check
      if (position.checkPct > 0) {
        const checkHeight = (position.checkPct / 100) * chartAreaHeight;
        currentY -= checkHeight;
        ctx.fillStyle = CHART_COLORS.ACTION_CHECK;
        ctx.fillRect(barX, currentY, barWidth, checkHeight);
        
        if (position.checkPct >= 5) {
          ctx.fillStyle = '#000000';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${position.checkPct.toFixed(1)}%`, barX + barWidth / 2, currentY + checkHeight / 2 + 3);
        }
      }
      
      // Call
      if (position.callPct > 0) {
        const callHeight = (position.callPct / 100) * chartAreaHeight;
        currentY -= callHeight;
        ctx.fillStyle = CHART_COLORS.ACTION_CALL;
        ctx.fillRect(barX, currentY, barWidth, callHeight);
        
        if (position.callPct >= 5) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${position.callPct.toFixed(1)}%`, barX + barWidth / 2, currentY + callHeight / 2 + 3);
        }
      }
      
      // Bet
      if (position.betPct > 0) {
        const betHeight = (position.betPct / 100) * chartAreaHeight;
        currentY -= betHeight;
        ctx.fillStyle = CHART_COLORS.ACTION_BET;
        ctx.fillRect(barX, currentY, barWidth, betHeight);
        
        if (position.betPct >= 5) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${position.betPct.toFixed(1)}%`, barX + barWidth / 2, currentY + betHeight / 2 + 3);
        }
      }
      
      // Raise (top)
      if (position.raisePct > 0) {
        const raiseHeight = (position.raisePct / 100) * chartAreaHeight;
        currentY -= raiseHeight;
        ctx.fillStyle = CHART_COLORS.ACTION_RAISE;
        ctx.fillRect(barX, currentY, barWidth, raiseHeight);
        
        if (position.raisePct >= 5) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`${position.raisePct.toFixed(1)}%`, barX + barWidth / 2, currentY + raiseHeight / 2 + 3);
        }
      }
      
      // Draw position label
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(position.position, barX + barWidth / 2, chartAreaY + chartAreaHeight + 20);
      
      // Draw hand count
      ctx.font = '10px Arial';
      ctx.fillText(`(${position.totalHands})`, barX + barWidth / 2, chartAreaY + chartAreaHeight + 35);
    });
  }

  /**
   * Draw showdown win rate bars
   */
  private drawShowdownWinRateBars(
    ctx: any,
    data: StreetActionAnalysisData,
    chartAreaX: number,
    chartAreaY: number,
    chartAreaWidth: number,
    chartAreaHeight: number,
    totalWidth: number
  ): void {
    const positionCount = data.positions.length;
    const groupWidth = chartAreaWidth / positionCount;
    const barWidth = groupWidth * 0.7;
    
    // Draw Y-axis grid and labels
    this.drawPercentageYAxis(ctx, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight);
    
    data.positions.forEach((position: ActionAnalysisPositionStats, index: number) => {
      const barX = chartAreaX + index * groupWidth + (groupWidth - barWidth) / 2;
      const winRate = position.raisePct; // Win rate is stored in raisePct for showdown
      const barHeight = (winRate / 100) * chartAreaHeight;
      const barY = chartAreaY + chartAreaHeight - barHeight;
      
      // Draw win rate bar
      ctx.fillStyle = CHART_COLORS.ACTION_WIN_RATE;
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // Draw percentage label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${winRate.toFixed(1)}%`, barX + barWidth / 2, barY + barHeight / 2 + 3);
      
      // Draw position label
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(position.position, barX + barWidth / 2, chartAreaY + chartAreaHeight + 20);
      
      // Draw hand count
      ctx.font = '10px Arial';
      ctx.fillText(`(${position.totalHands})`, barX + barWidth / 2, chartAreaY + chartAreaHeight + 35);
    });
  }

  /**
   * Draw percentage Y-axis with grid lines
   */
  private drawPercentageYAxis(
    ctx: any,
    chartAreaX: number,
    chartAreaY: number,
    chartAreaWidth: number,
    chartAreaHeight: number
  ): void {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#000000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    
    // Draw percentage lines from 0% to 100%
    for (let pct = 0; pct <= 100; pct += 20) {
      const y = chartAreaY + chartAreaHeight * (1 - pct / 100);
      
      // Draw grid line
      ctx.beginPath();
      ctx.moveTo(chartAreaX, y);
      ctx.lineTo(chartAreaX + chartAreaWidth, y);
      ctx.stroke();
      
      // Draw label
      ctx.fillText(`${pct}%`, chartAreaX - 5, y + 3);
    }
    
    // Draw Y-axis line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartAreaX, chartAreaY);
    ctx.lineTo(chartAreaX, chartAreaY + chartAreaHeight);
    ctx.stroke();
  }

  /**
   * Draw action legend
   */
  private drawActionLegend(ctx: any, x: number, y: number, isShowdown: boolean): void {
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    
    if (isShowdown) {
      // Legend for showdown win rate
      ctx.fillStyle = CHART_COLORS.ACTION_WIN_RATE;
      ctx.fillRect(x, y, 12, 12);
      ctx.fillStyle = '#000000';
      ctx.fillText('Win Rate', x + 18, y + 9);
    } else {
      // Legend for actions
      const actions = [
        { color: CHART_COLORS.ACTION_RAISE, label: 'Raise' },
        { color: CHART_COLORS.ACTION_BET, label: 'Bet' },
        { color: CHART_COLORS.ACTION_CALL, label: 'Call' },
        { color: CHART_COLORS.ACTION_CHECK, label: 'Check' },
        { color: CHART_COLORS.ACTION_FOLD, label: 'Fold' }
      ];
      
      actions.forEach((action, index) => {
        const legendY = y + index * 18;
        ctx.fillStyle = action.color;
        ctx.fillRect(x, legendY, 12, 12);
        ctx.fillStyle = '#000000';
        ctx.fillText(action.label, x + 18, legendY + 9);
      });
    }
  }

  /**
   * Extract final values for action analysis chart
   */
  private extractActionAnalysisFinalValues(data: CompleteActionAnalysisChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    Object.entries(data).forEach(([stage, stageData]: [string, StreetActionAnalysisData]) => {
      const stageTotalHands = stageData.positions.reduce((sum: number, pos: ActionAnalysisPositionStats) => sum + pos.totalHands, 0);
      finalValues[`${this.capitalizeFirstLetter(stage)} (${stageTotalHands} hands)`] = stageTotalHands;
    });
    
    return finalValues;
  }

  /**
   * Calculate total hands from action analysis data
   */
  private calculateTotalHandsFromActionAnalysis(data: CompleteActionAnalysisChartData): number {
    // Use preflop overall hands as the total since all hands start at preflop
    const preflopData = data.preflop;
    const overallPosition = preflopData.positions.find(pos => pos.position === 'Overall');
    return overallPosition ? overallPosition.totalHands : 0;
  }

  // ===== UTILITY METHODS =====

  /**
   * Capitalize the first letter of a string
   */
  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Create stage labels for different analysis types
   */
  private createStageLabels(analysisType: string): Record<string, string> {
    const labels: Record<string, string> = {};
    POKER.STAGES.forEach(stage => {
      labels[stage] = `${this.capitalizeFirstLetter(stage)} ${analysisType}`;
    });
    return labels;
  }

  /**
   * Calculate chart height for multi-stage layouts
   */
  private calculateStageChartHeight(totalHeight: number): number {
    const separatorSpace = (POKER.STAGE_COUNT - 1) * CHART_LAYOUT.SEPARATOR_MARGIN;
    return Math.floor((totalHeight - separatorSpace) / POKER.STAGE_COUNT);
  }

  /**
   * Create gradient color with specified intensity
   */
  private createGradientColor(color: {r: number, g: number, b: number}, intensity: number): string {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity})`;
  }

  /**
   * Calculate gradient intensity based on value ratio
   */
  private calculateGradientIntensity(value: number, maxValue: number, range: number): number {
    if (maxValue === 0) return CHART_LAYOUT.MIN_GRADIENT_INTENSITY;
    const ratio = Math.abs(value) / Math.abs(maxValue);
    return CHART_LAYOUT.MIN_GRADIENT_INTENSITY + (ratio * range);
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
      ...data.allHandsWithRakeBB100.map((point: ChartDataPoint) => point.value),
      ...data.allHandsActualBB100.map((point: ChartDataPoint) => point.value),
      ...data.showdownOnlyBB100.map((point: ChartDataPoint) => point.value),
      ...data.noShowdownOnlyBB100.map((point: ChartDataPoint) => point.value)
    ];
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

  /**
   * Get the last value from a data series
   */
  private getLastValue(dataPoints: ChartDataPoint[]): number {
    return dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : 0;
  }



  /**
   * Render profit chart section as a line chart
   */
  private async renderProfitSection(
    ctx: any,
    data: ProfitChartData,
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
    
    // Create a temporary canvas for the profit chart
    const tempCanvas = createCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw white background
    tempCtx.fillStyle = CHARTS.BACKGROUND_COLOR;
    tempCtx.fillRect(0, 0, width, height);
    
    // Create chart configuration for profit
    const profitConfig = this.buildProfitChartConfiguration(data, {
      width,
      height,
      title: '', // No title for section
      xAxisLabel: 'Hands',
      yAxisLabel: 'Cumulative Profit',
      fileName: 'temp'
    });
    
    // Create and render the Chart.js chart
    const chart = new Chart(tempCtx as any, profitConfig);
    
    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Draw the chart onto the main canvas
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Clean up
    chart.destroy();
    
    // Restore the context state
    ctx.restore();
  }

  /**
   * Render BB/100 chart section as a line chart
   */
  private async renderBB100Section(
    ctx: any,
    data: BB100ChartData,
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
    
    // Create a temporary canvas for the BB/100 chart
    const tempCanvas = createCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw white background
    tempCtx.fillStyle = CHARTS.BACKGROUND_COLOR;
    tempCtx.fillRect(0, 0, width, height);
    
    // Calculate optimal Y-axis range for BB/100 data
    const yAxisRange = this.calculateOptimalYAxisRange(data);
    
    // Create chart configuration for BB/100
    const bb100Config = this.buildBB100ChartConfiguration(data, {
      width,
      height,
      title: '', // No title for section
      xAxisLabel: 'Hands',
      yAxisLabel: 'BB/100',
      fileName: 'temp'
    }, yAxisRange);
    
    // Create and render the Chart.js chart
    const chart = new Chart(tempCtx as any, bb100Config);
    
    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Draw the chart onto the main canvas
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Clean up
    chart.destroy();
    
    // Restore the context state
    ctx.restore();
  }

  /**
   * Render position profit analysis chart with 7 vertical subcharts
   */
  private async renderPositionProfitAnalysisChart(
    positionData: CompletePositionProfitChartData,
    config: ChartConfig
  ): Promise<string> {
    await ensureDirectoryExists(this.outputDir);

    // Create high-resolution canvas - taller for 7 vertical charts
    const chartHeight = config.height * 1.5; // Make it taller for 7 subcharts
    const canvas = createCanvas(config.width, chartHeight);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, chartHeight);

    // Define positions and their display order
    const positions = [
      { key: 'overall', label: 'Overall' },
      { key: 'utg', label: 'UTG' },
      { key: 'hj', label: 'HJ' },
      { key: 'co', label: 'CO' },
      { key: 'btn', label: 'BTN' },
      { key: 'sb', label: 'SB' },
      { key: 'bb', label: 'BB' }
    ];

    // Draw main title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Position-Specific Profit Trend Analysis', config.width / 2, 50);

    // Calculate chart dimensions for each section
    const chartTopMargin = 80;
    const availableHeight = chartHeight - chartTopMargin - 40; // 40px bottom margin
    const sectionHeight = Math.floor(availableHeight / 7); // 7 positions
    const chartWidth = config.width - 40; // 20px margin on each side
    const chartLeftMargin = 20;

    // Render each position chart
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const positionChartData = positionData[position.key as keyof CompletePositionProfitChartData];
      const y = chartTopMargin + i * sectionHeight;

      if (positionChartData && positionChartData.actualProfit.length > 0) {
        await this.renderPositionProfitSection(
          ctx,
          positionChartData,
          position.label,
          chartLeftMargin,
          y,
          chartWidth,
          sectionHeight
        );
      } else {
        // Draw "No data" message for positions with no hands
        this.drawNoDataMessage(ctx, position.label, chartLeftMargin, y, chartWidth, sectionHeight);
      }

      // Draw separator line (except after the last chart)
      if (i < positions.length - 1) {
        this.drawSectionSeparator(ctx, y + sectionHeight - 5, config.width);
      }
    }

    const filePath = path.join(this.outputDir, config.fileName);
    await this.saveChart(canvas, filePath);
    return filePath;
  }

  /**
   * Render a single position profit chart section
   */
  private async renderPositionProfitSection(
    ctx: any,
    data: PositionProfitChartData,
    positionLabel: string,
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
    
    // Create a temporary canvas for the position chart
    const tempCanvas = createCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw white background
    tempCtx.fillStyle = CHARTS.BACKGROUND_COLOR;
    tempCtx.fillRect(0, 0, width, height);
    
    // Create chart configuration for position profit
    const positionConfig = this.buildPositionProfitChartConfiguration(data, {
      width,
      height,
      title: `${positionLabel} (${data.actualProfit.length} hands)`,
      xAxisLabel: 'Hands',
      yAxisLabel: 'Cumulative Profit',
      fileName: 'temp'
    });
    
    // Create and render the Chart.js chart
    const chart = new Chart(tempCtx as any, positionConfig);
    
    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Draw the chart onto the main canvas
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Clean up
    chart.destroy();
    
    // Restore the context state
    ctx.restore();
  }

  /**
   * Draw "No data" message for positions with no hands
   */
  private drawNoDataMessage(
    ctx: any,
    positionLabel: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    ctx.save();
    
    // Draw background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(x, y, width, height);
    
    // Draw border
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Draw title and message
    ctx.fillStyle = '#6c757d';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${positionLabel}`, x + width / 2, y + height / 2 - 10);
    
    ctx.font = '14px Arial';
    ctx.fillText('No hands played in this position', x + width / 2, y + height / 2 + 15);
    
    ctx.restore();
  }

  /**
   * Render position BB/100 analysis chart with 7 vertical subcharts
   */
  private async renderPositionBB100AnalysisChart(
    positionData: CompletePositionBB100ChartData,
    config: ChartConfig
  ): Promise<string> {
    await ensureDirectoryExists(this.outputDir);

    // Create high-resolution canvas - taller for 7 vertical charts
    const chartHeight = config.height * 1.5; // Make it taller for 7 subcharts
    const canvas = createCanvas(config.width, chartHeight);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, chartHeight);

    // Define positions and their display order
    const positions = [
      { key: 'overall', label: 'Overall' },
      { key: 'utg', label: 'UTG' },
      { key: 'hj', label: 'HJ' },
      { key: 'co', label: 'CO' },
      { key: 'btn', label: 'BTN' },
      { key: 'sb', label: 'SB' },
      { key: 'bb', label: 'BB' }
    ];

    // Draw main title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Position-Specific BB/100 Trend Analysis', config.width / 2, 50);

    // Calculate chart dimensions for each section
    const chartTopMargin = 80;
    const availableHeight = chartHeight - chartTopMargin - 40; // 40px bottom margin
    const sectionHeight = Math.floor(availableHeight / 7); // 7 positions
    const chartWidth = config.width - 40; // 20px margin on each side
    const chartLeftMargin = 20;

    // Render each position chart
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const positionChartData = positionData[position.key as keyof CompletePositionBB100ChartData];
      const y = chartTopMargin + i * sectionHeight;

      if (positionChartData && positionChartData.actualBB100.length > 0) {
        await this.renderPositionBB100Section(
          ctx,
          positionChartData,
          position.label,
          chartLeftMargin,
          y,
          chartWidth,
          sectionHeight
        );
      } else {
        // Draw "No data" message for positions with no hands
        this.drawNoDataMessage(ctx, position.label, chartLeftMargin, y, chartWidth, sectionHeight);
      }

      // Draw separator line (except after the last chart)
      if (i < positions.length - 1) {
        this.drawSectionSeparator(ctx, y + sectionHeight - 5, config.width);
      }
    }

    const filePath = path.join(this.outputDir, config.fileName);
    await this.saveChart(canvas, filePath);
    return filePath;
  }

  /**
   * Render a single position BB/100 chart section
   */
  private async renderPositionBB100Section(
    ctx: any,
    data: PositionBB100ChartData,
    positionLabel: string,
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
    
    // Create a temporary canvas for the position chart
    const tempCanvas = createCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    
    // Draw white background
    tempCtx.fillStyle = CHARTS.BACKGROUND_COLOR;
    tempCtx.fillRect(0, 0, width, height);
    
    // Calculate optimal Y-axis range for BB/100 data
    const yAxisRange = this.calculateOptimalBB100YAxisRange(data);
    
    // Create chart configuration for position BB/100
    const positionConfig = this.buildPositionBB100ChartConfiguration(data, {
      width,
      height,
      title: `${positionLabel} (${data.actualBB100.length} hands)`,
      xAxisLabel: 'Hands',
      yAxisLabel: 'BB/100',
      fileName: 'temp'
    }, yAxisRange);
    
    // Create and render the Chart.js chart
    const chart = new Chart(tempCtx as any, positionConfig);
    
    // Wait for chart to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Draw the chart onto the main canvas
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Clean up
    chart.destroy();
    
    // Restore the context state
    ctx.restore();
  }

  /**
   * Calculate optimal Y-axis range for position BB/100 data
   */
  private calculateOptimalBB100YAxisRange(data: PositionBB100ChartData): YAxisRange {
    const allValues = [
      ...data.actualBB100.map(point => point.value),
      ...data.showdownBB100.map(point => point.value),
      ...data.noShowdownBB100.map(point => point.value)
    ];

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
   * Render combined position analysis chart with profit (left) and BB/100 (right)
   */
  private async renderCombinedPositionAnalysisChart(
    combinedData: CombinedPositionChartData,
    config: ChartConfig
  ): Promise<string> {
    await ensureDirectoryExists(this.outputDir);

    // Create high-resolution canvas - taller for 7 vertical charts
    const chartHeight = config.height * 1.5; // Make it taller for 7 subcharts
    const canvas = createCanvas(config.width, chartHeight);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, chartHeight);

    // Define positions and their display order
    const positions = [
      { key: 'overall', label: 'Overall' },
      { key: 'utg', label: 'UTG' },
      { key: 'hj', label: 'HJ' },
      { key: 'co', label: 'CO' },
      { key: 'btn', label: 'BTN' },
      { key: 'sb', label: 'SB' },
      { key: 'bb', label: 'BB' }
    ];

    // Define dimensions for left and right halves
    const halfWidth = config.width / 2;
    const separatorWidth = 4;
    const leftWidth = halfWidth - separatorWidth / 2;
    const rightWidth = halfWidth - separatorWidth / 2;
    const rightStartX = halfWidth + separatorWidth / 2;

    // Draw main title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Position-Specific Profit & BB/100 Analysis', config.width / 2, 50);

    // Draw section titles
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Profit Trend Analysis', leftWidth / 2, 80);
    ctx.fillText('BB/100 Trend Analysis', rightStartX + rightWidth / 2, 80);

    // Draw separator line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = separatorWidth;
    ctx.beginPath();
    ctx.moveTo(halfWidth, 100);
    ctx.lineTo(halfWidth, chartHeight - 20);
    ctx.stroke();

    // Calculate chart dimensions for each section
    const chartTopMargin = 100;
    const availableHeight = chartHeight - chartTopMargin - 40; // 40px bottom margin
    const sectionHeight = Math.floor(availableHeight / 7); // 7 positions
    const chartLeftMargin = 20;

    // Render each position chart
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const profitData = combinedData.profitData[position.key as keyof CompletePositionProfitChartData];
      const bb100Data = combinedData.bb100Data[position.key as keyof CompletePositionBB100ChartData];
      const y = chartTopMargin + i * sectionHeight;

      // Render profit chart (left side)
      if (profitData && profitData.actualProfit.length > 0) {
        await this.renderPositionProfitSection(
          ctx,
          profitData,
          position.label,
          chartLeftMargin,
          y,
          leftWidth - chartLeftMargin,
          sectionHeight
        );
      } else {
        // Draw "No data" message for positions with no hands
        this.drawNoDataMessage(ctx, position.label, chartLeftMargin, y, leftWidth - chartLeftMargin, sectionHeight);
      }

      // Render BB/100 chart (right side)
      if (bb100Data && bb100Data.actualBB100.length > 0) {
        await this.renderPositionBB100Section(
          ctx,
          bb100Data,
          position.label,
          rightStartX,
          y,
          rightWidth,
          sectionHeight
        );
      } else {
        // Draw "No data" message for positions with no hands
        this.drawNoDataMessage(ctx, position.label, rightStartX, y, rightWidth, sectionHeight);
      }

      // Draw separator line (except after the last chart)
      if (i < positions.length - 1) {
        this.drawSectionSeparator(ctx, y + sectionHeight - 5, config.width);
      }
    }

    const filePath = path.join(this.outputDir, config.fileName);
    await this.saveChart(canvas, filePath);
    return filePath;
  }

} 