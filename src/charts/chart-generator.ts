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
  CompositePositionChartData,
  PositionStreetProfitStats,
  StreetProfitBarData,
  CompleteFinalStageChartData,
  FinalStageChartData,
  FinalStagePositionStats
} from './chart-types';
import { CHARTS, CHART_COLORS } from '../constants';
import { formatTimestamp, ensureDirectoryExists } from '../utils';

// Register Chart.js components
Chart.register(...registerables, ChartDataLabels);

type ChartType = 'profit' | 'bb100' | 'composite-position' | 'final-stage-position';

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
   * Generate composite position profit chart with multiple position analysis
   */
  async generateCompositePositionChart(data: CompositePositionChartData): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('composite-position');
    const finalValues = this.extractCompositePositionFinalValues(data);
    
    // Create a truly composite chart by rendering multiple charts vertically
    const filePath = await this.renderCompositeChart(data, config);
    
    return {
      filePath,
      totalHands: this.calculateTotalHandsFromComposite(data),
      finalValues
    };
  }

  /**
   * Generate final stage position profit/loss chart with 5 separate bar charts
   */
  async generateFinalStagePositionChart(data: CompleteFinalStageChartData): Promise<ChartGenerationResult> {
    const config = this.createChartConfig('final-stage-position');
    const finalValues = this.extractFinalStageFinalValues(data);
    
    // Create 5 separate charts for each stage
    const filePath = await this.renderFinalStageChart(data, config);
    
    return {
      filePath,
      totalHands: this.calculateTotalHandsFromFinalStage(data),
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
      'composite-position': {
        title: 'Poker Composite Position Profit Analysis',
        xAxisLabel: 'Position',
        yAxisLabel: 'Cumulative Profit',
        fileName: `poker-composite-position-chart-${timestamp}`
      },
      'final-stage-position': {
        title: 'Poker Final Stage Position Analysis',
        xAxisLabel: 'Position',
        yAxisLabel: 'Profit (BB)',
        fileName: `poker-final-stage-position-chart-${timestamp}`
      }
    };

    const baseConfig = configs[type];
    return {
      width: CHARTS.DEFAULT_WIDTH,
      height: (type === 'composite-position' || type === 'final-stage-position') ? CHARTS.DEFAULT_HEIGHT * 2 : CHARTS.DEFAULT_HEIGHT,
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

  /**
   * Calculate final values for composite position chart
   */
  private extractCompositePositionFinalValues(data: CompositePositionChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    // Add overall statistics
    finalValues['Overall'] = data.overall.dataPoints.reduce((sum, point) => sum + point.totalProfit, 0);
    
    // Add position-specific statistics
    data.byPosition.forEach(pos => {
      const totalProfit = pos.dataPoints.reduce((sum, point) => sum + point.totalProfit, 0);
      const totalHands = pos.dataPoints.reduce((sum, point) => sum + point.handCount, 0);
      finalValues[`${pos.position} (${totalHands} hands)`] = totalProfit;
    });
    
    return finalValues;
  }

  // ===== COMPOSITE CHART RENDERING METHODS =====

  /**
   * Calculate total hands from composite data
   */
  private calculateTotalHandsFromComposite(data: CompositePositionChartData): number {
    return data.overall.dataPoints.reduce((sum, point) => sum + point.handCount, 0);
  }

  /**
   * Calculate total hands from final stage data
   */
  private calculateTotalHandsFromFinalStage(data: CompleteFinalStageChartData): number {
    let totalHands = 0;
    Object.values(data).forEach((stageData: FinalStageChartData) => {
      stageData.positions.forEach((pos: FinalStagePositionStats) => {
        totalHands += pos.profitCount + pos.lossCount;
      });
    });
    return totalHands;
  }

  /**
   * Extract final values for final stage chart
   */
  private extractFinalStageFinalValues(data: CompleteFinalStageChartData): Record<string, number> {
    const finalValues: Record<string, number> = {};
    
    Object.entries(data).forEach(([stage, stageData]: [string, FinalStageChartData]) => {
      const stageProfit = stageData.positions.reduce((sum: number, pos: FinalStagePositionStats) => sum + pos.profit + pos.loss, 0);
      const stageHands = stageData.positions.reduce((sum: number, pos: FinalStagePositionStats) => sum + pos.profitCount + pos.lossCount, 0);
      finalValues[`${stage.charAt(0).toUpperCase() + stage.slice(1)} (${stageHands} hands)`] = stageProfit;
    });
    
    return finalValues;
  }

  /**
   * Render composite chart with all positions in a single image
   */
  private async renderCompositeChart(
    data: CompositePositionChartData, 
    config: ChartConfig
  ): Promise<string> {
    await ensureDirectoryExists(this.outputDir);

    // Create a large canvas that will hold all 7 charts
    const totalHeight = config.height;
    const separatorMargin = 8; // Margin between charts and separators
    const chartHeight = Math.floor((totalHeight - (6 * separatorMargin)) / 7); // 6 separators between 7 charts
    const canvas = createCanvas(config.width, totalHeight);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = CHARTS.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, config.width, totalHeight);

    // Calculate color gradients for all categories based on overall statistics
    const gradientColors = this.calculateGradientColors(data);

    let currentY = 0;

    // Chart titles and data
    const chartsToRender = [
      { title: 'Overall Statistics', data: data.overall, isOverall: true },
      ...data.byPosition.map(pos => ({ 
        title: `${pos.position} Position`, 
        data: { dataPoints: pos.dataPoints },
        position: pos.position,
        isOverall: false
      }))
    ];

    // Render each chart
    for (let i = 0; i < chartsToRender.length; i++) {
      const chartInfo = chartsToRender[i];
      
      await this.renderSingleChartSection(
        ctx, 
        chartInfo.data, 
        chartInfo.title, 
        0, 
        currentY, 
        config.width, 
        chartHeight,
        chartInfo.isOverall ? null : gradientColors[(chartInfo as any).position || '']
      );
      
      currentY += chartHeight;
      
      // Add separator line between charts (except after the last chart)
      if (i < chartsToRender.length - 1) {
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
   * Render final stage chart with 5 separate bar charts for each stage
   */
  private async renderFinalStageChart(
    data: CompleteFinalStageChartData, 
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
      const stageData = data[stage as keyof CompleteFinalStageChartData];
      
      await this.renderSingleFinalStageSection(
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
   * Calculate gradient colors for each position based on overall statistics
   */
  private calculateGradientColors(data: CompositePositionChartData): Record<string, Record<string, { fillColor: string, borderColor: string }>> {
    const gradientColors: Record<string, Record<string, { fillColor: string, borderColor: string }>> = {};
    
    // Get overall statistics as baseline
    const overallValues: Record<string, number> = {};
    data.overall.dataPoints?.forEach(point => {
      overallValues[point.category] = point.totalProfit;
    });
    
    // Collect all position values for each category to find min/max
    const categoryValues: Record<string, number[]> = {};
    data.byPosition.forEach(pos => {
      pos.dataPoints.forEach(point => {
        if (!categoryValues[point.category]) {
          categoryValues[point.category] = [];
        }
        categoryValues[point.category].push(point.totalProfit);
      });
    });
    
    // Calculate colors for each position
    data.byPosition.forEach(pos => {
      gradientColors[pos.position] = {};
      
      pos.dataPoints.forEach(point => {
        const category = point.category;
        const value = point.totalProfit;
        const overallValue = overallValues[category] || 0;
        const categoryRange = categoryValues[category] || [value];
        const minValue = Math.min(...categoryRange);
        const maxValue = Math.max(...categoryRange);
        
        let fillColor: string;
        let borderColor: string;
        
        if (overallValue >= 0) {
          // For positive categories (wins), calculate gradient within wins
          if (value >= 0) {
            // Positive value: non-linear gradient emphasizing extremes
            const ratio = maxValue > 0 ? value / maxValue : 0;
            // Use exponential curve to make middle values lighter and extremes more prominent
            const curvedRatio = Math.pow(ratio, 2.5);
                         const fillIntensity = 0.15 + (curvedRatio * 0.65); // 0.15 to 0.8
             fillColor = `rgba(34, 197, 94, ${fillIntensity})`;
             borderColor = fillColor; // Same as fill color
          } else {
            // Negative value in positive category: use light red
                         fillColor = 'rgba(239, 68, 68, 0.15)';
             borderColor = fillColor; // Same as fill color
          }
        } else {
          // For negative categories (losses), calculate gradient within losses
          if (value <= 0) {
            // Negative value: non-linear gradient emphasizing extremes
            const ratio = minValue < 0 ? Math.abs(value) / Math.abs(minValue) : 0;
            // Use exponential curve to make middle values lighter and extremes more prominent
            const curvedRatio = Math.pow(ratio, 2.5);
                         const fillIntensity = 0.15 + (curvedRatio * 0.65); // 0.15 to 0.8
             fillColor = `rgba(239, 68, 68, ${fillIntensity})`;
             borderColor = fillColor; // Same as fill color
          } else {
            // Positive value in negative category: use light green
                         fillColor = 'rgba(34, 197, 94, 0.15)';
             borderColor = fillColor; // Same as fill color
          }
        }
        
        gradientColors[pos.position][category] = { fillColor, borderColor };
      });
    });
    
    return gradientColors;
  }

  /**
   * Render a single chart section within the composite chart with complete chart elements
   */
  private async renderSingleChartSection(
    ctx: any,
    data: StreetProfitBarData,
    title: string,
    x: number,
    y: number,
    width: number,
    height: number,
    gradientColors?: Record<string, { fillColor: string, borderColor: string }> | null
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
    const titleHeight = 30;
    const marginTop = 40;
    const marginBottom = 60; // Reduced bottom margin since no X-axis title
    const marginLeft = 60;
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
    
    if (data.dataPoints && data.dataPoints.length > 0) {
      // Find min and max values for scaling
      const values = data.dataPoints.map(point => point.totalProfit);
      const minValue = Math.min(0, ...values);
      const maxValue = Math.max(0, ...values);
      const valueRange = maxValue - minValue || 1;
      
      // Draw Y-axis grid lines and labels
      this.drawYAxisGrid(ctx, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight, minValue, maxValue);
      
      // Draw X-axis grid lines
      this.drawXAxisGrid(ctx, chartAreaX, chartAreaY, chartAreaWidth, chartAreaHeight, data.dataPoints.length);
      
      // Draw zero baseline (horizontal line at y=0)
      const zeroY = chartAreaY + chartAreaHeight * (1 - (-minValue / valueRange));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(chartAreaX, zeroY);
      ctx.lineTo(chartAreaX + chartAreaWidth, zeroY);
      ctx.stroke();
      
      // Calculate bar dimensions
      const barWidth = chartAreaWidth / data.dataPoints.length * 0.8;
      const barSpacing = chartAreaWidth / data.dataPoints.length * 0.2;
      
      // Draw bars and labels
      data.dataPoints.forEach((point, index) => {
        const barX = chartAreaX + index * (barWidth + barSpacing) + barSpacing / 2;
        const barHeight = Math.abs(point.totalProfit) / valueRange * chartAreaHeight * 0.8;
        
        let barY: number;
        
        if (point.totalProfit >= 0) {
          barY = zeroY - barHeight;
        } else {
          barY = zeroY;
        }
        
        // Determine bar colors
        let fillColor: string;
        let borderColor: string;
        
        if (gradientColors && gradientColors[point.category]) {
          // Use gradient colors for position charts
          fillColor = gradientColors[point.category].fillColor;
          borderColor = gradientColors[point.category].borderColor;
        } else {
          // Use default colors for overall statistics
          fillColor = point.totalProfit >= 0 ? CHART_COLORS.BAR_WINS : CHART_COLORS.BAR_LOSSES;
          borderColor = point.totalProfit >= 0 ? CHART_COLORS.BAR_WINS_BORDER : CHART_COLORS.BAR_LOSSES_BORDER;
        }
        
        // Draw bar
        ctx.fillStyle = fillColor;
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Draw data label
        ctx.fillStyle = '#000000';
        ctx.font = '9px Arial';
        ctx.textAlign = 'center';
        const formattedValue = Math.abs(point.totalProfit) < 0.01 ? 
          point.totalProfit.toFixed(3) : 
          point.totalProfit.toFixed(2);
        const label = point.totalProfit >= 0 ? `+${formattedValue}` : formattedValue;
        
        // Position label above or below bar depending on sign
        const labelY = point.totalProfit >= 0 ? barY - 5 : barY + barHeight + 12;
        ctx.fillText(label, barX + barWidth / 2, labelY);
        
        // Draw category label (rotated)
        ctx.save();
        ctx.translate(barX + barWidth / 2, chartAreaY + chartAreaHeight + 20);
        ctx.rotate(-Math.PI / 4);
        ctx.font = '8px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(point.category, 0, 0);
        ctx.restore();
      });
      
      // Draw Y-axis label
      ctx.save();
      ctx.translate(15, chartAreaY + chartAreaHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Cumulative Profit', 0, 0);
      ctx.restore();
      
      // X-axis title removed as requested
    }
    
    // Restore context state
    ctx.restore();
  }

  /**
   * Render a single final stage chart section with profit/loss bars per position
   */
  private async renderSingleFinalStageSection(
    ctx: any,
    data: FinalStageChartData,
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
      
      // Calculate bar dimensions - 2 bars per position
      const positionCount = data.positions.length;
      const groupWidth = chartAreaWidth / positionCount;
      const barWidth = groupWidth * 0.35; // Each bar takes 35% of group width
      const barSpacing = groupWidth * 0.15; // 15% spacing between bars in a group
      
      // Calculate gradient intensity based on value magnitude
      const maxProfit = Math.max(...data.positions.map(p => p.profit));
      const maxLoss = Math.min(...data.positions.map(p => p.loss));
      
      // Draw bars and labels for each position
      data.positions.forEach((position, index) => {
        const groupX = chartAreaX + index * groupWidth;
        const centerX = groupX + groupWidth / 2;
        
        // Draw profit bar (green)
        if (position.profit > 0) {
          const profitBarHeight = (position.profit / valueRange) * chartAreaHeight * 0.8;
          const profitBarY = zeroY - profitBarHeight;
          
          // Calculate gradient intensity for profit
          const profitRatio = maxProfit > 0 ? position.profit / maxProfit : 0;
          const profitIntensity = 0.3 + (profitRatio * 0.5); // 0.3 to 0.8
          
          ctx.fillStyle = `rgba(34, 197, 94, ${profitIntensity})`;
          ctx.fillRect(centerX - barWidth - barSpacing / 2, profitBarY, barWidth, profitBarHeight);
          
          // Draw profit value label
          ctx.fillStyle = '#000000';
          ctx.font = '9px Arial';
          ctx.textAlign = 'center';
          const profitLabel = `+${position.profit.toFixed(2)}`;
          ctx.fillText(profitLabel, centerX - barWidth / 2 - barSpacing / 2, profitBarY - 5);
        }
        
        // Draw loss bar (red)
        if (position.loss < 0) {
          const lossBarHeight = Math.abs(position.loss) / valueRange * chartAreaHeight * 0.8;
          const lossBarY = zeroY;
          
          // Calculate gradient intensity for loss
          const lossRatio = maxLoss < 0 ? Math.abs(position.loss) / Math.abs(maxLoss) : 0;
          const lossIntensity = 0.3 + (lossRatio * 0.5); // 0.3 to 0.8
          
          ctx.fillStyle = `rgba(239, 68, 68, ${lossIntensity})`;
          ctx.fillRect(centerX + barSpacing / 2, lossBarY, barWidth, lossBarHeight);
          
          // Draw loss value label
          ctx.fillStyle = '#000000';
          ctx.font = '9px Arial';
          ctx.textAlign = 'center';
          const lossLabel = position.loss.toFixed(2);
          ctx.fillText(lossLabel, centerX + barWidth / 2 + barSpacing / 2, lossBarY + lossBarHeight + 12);
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