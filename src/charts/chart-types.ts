export interface ChartCommandOptions {
  dbPath?: string;
  outputDir?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  bb100SmoothInterval?: number; // BB/100 圖表的平滑間隔，預設 100 手
}

export interface ChartDataPoint {
  handNumber: number;
  value: number;
  timestamp: string;
}

export interface ProfitChartData {
  allHandsWithRake: ChartDataPoint[];  // hero_profit + hero_rake (如果沒有抽水)
  allHandsActual: ChartDataPoint[];    // hero_profit (真正金流)
  showdownOnly: ChartDataPoint[];
  noShowdownOnly: ChartDataPoint[];
}

export interface BB100ChartData {
  allHandsWithRakeBB100: ChartDataPoint[];  // profit without rake 的 BB/100
  allHandsActualBB100: ChartDataPoint[];    // actual profit 的 BB/100
  showdownOnlyBB100: ChartDataPoint[];      // showdown BB/100
  noShowdownOnlyBB100: ChartDataPoint[];    // no showdown BB/100
}

export interface ChartGenerationResult {
  filePath: string;
  totalHands: number;
  finalValues: {
    [key: string]: number;
  };
}

export enum ChartType {
  PROFIT_TREND = 'profit-trend',
  BB100_TREND = 'bb100-trend'
}

export interface ChartConfig {
  width: number;
  height: number;
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  fileName: string;
} 