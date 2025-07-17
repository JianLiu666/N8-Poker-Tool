/**
 * Centralized type definitions for the N8 Poker Tool
 * Organized by feature area for better maintainability
 */

// ================== Configuration Interfaces ==================

export interface DatabaseConfig {
  dbPath: string;
}

export interface ParseCommandOptions {
  inputDir: string;
  dbPath?: string;
}

export interface ChartCommandOptions {
  dbPath?: string;
  outputDir?: string;
  dateRange?: DateRange;
  interval?: number;
}

export interface DateRange {
  start: string;
  end: string;
}

// ================== Database Entity Interfaces ==================

export interface PokerHand {
  id?: number;
  hand_id: string;
  hand_start_time: string;
  game_type: string;
  small_blind: number;
  big_blind: number;
  hero_position: string;
  hero_hole_cards: string;
  flop_cards: string;
  turn_card: string;
  river_card: string;
  hero_preflop_investment: number;
  hero_flop_investment: number;
  hero_turn_investment: number;
  hero_river_investment: number;
  hero_preflop_actions: string;
  hero_flop_actions: string;
  hero_turn_actions: string;
  hero_river_actions: string;
  pot_amount: number;
  jackpot_amount: number;
  hero_profit: number;
  hero_rake: number;
  hero_hand_result: string;
  final_stage: string;
  created_at?: string;
}

// ================== Parsing Interfaces ==================

export interface ParsedHand {
  handId: string;
  timestamp: string;
  tableName: string;
  gameType: string;
  smallBlind: number;
  bigBlind: number;
  heroPosition: string;
  heroHoleCards: string;
  flopCards: string;
  turnCard: string;
  riverCard: string;
  heroStartingChips: number;
  heroEndingChips: number;
  potAmount: number;
  jackpotAmount: number;
  heroProfit: number;
  heroRake: number;
  finalStage: string;
  handResult: string;
  heroActions: HeroActions;
  heroInvestments: HeroInvestments;
}

export interface HeroActions {
  preflop: string[];
  flop: string[];
  turn: string[];
  river: string[];
}

export interface HeroInvestments {
  preflop: number;
  flop: number;
  turn: number;
  river: number;
}

// ================== Chart-related Interfaces ==================

export interface ChartDataPoint {
  handNumber: number;
  value: number;
  timestamp: string;
}

export interface ProfitChartData {
  allHandsWithRake: ChartDataPoint[];
  allHandsActual: ChartDataPoint[];
  showdownOnly: ChartDataPoint[];
  noShowdownOnly: ChartDataPoint[];
}

export interface BB100ChartData {
  allHandsWithRakeBB100: ChartDataPoint[];
  allHandsActualBB100: ChartDataPoint[];
  showdownOnlyBB100: ChartDataPoint[];
  noShowdownOnlyBB100: ChartDataPoint[];
}

export interface ChartGenerationResult {
  filePath: string;
  totalHands: number;
  finalValues: Record<string, number>;
}

export interface ChartConfig {
  width: number;
  height: number;
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  fileName: string;
}

export interface YAxisRange {
  min: number;
  max: number;
}

export interface StatisticsData {
  profitWithoutRake: number;
  actualProfit: number;
  rakeImpact: number;
  showdownProfit: number;
  noShowdownProfit: number;
  bb100WithoutRake: number;
  bb100Actual: number;
  bb100Showdown: number;
  bb100NoShowdown: number;
}

export interface FinalStatistics {
  totalHands: number;
  statistics: StatisticsData;
}

// Position-specific profit trend analysis types
export interface PositionProfitChartData {
  position: string;
  actualProfit: ChartDataPoint[];
  profitWithoutRake: ChartDataPoint[];
  showdownProfit: ChartDataPoint[];
  noShowdownProfit: ChartDataPoint[];
}

export interface CompletePositionProfitChartData {
  overall: PositionProfitChartData;
  utg: PositionProfitChartData;
  hj: PositionProfitChartData;
  co: PositionProfitChartData;
  btn: PositionProfitChartData;
  sb: PositionProfitChartData;
  bb: PositionProfitChartData;
}

// Position-specific BB/100 trend analysis types
export interface PositionBB100ChartData {
  position: string;
  actualBB100: ChartDataPoint[];
  profitWithoutRakeBB100: ChartDataPoint[];
  showdownBB100: ChartDataPoint[];
  noShowdownBB100: ChartDataPoint[];
}

export interface CompletePositionBB100ChartData {
  overall: PositionBB100ChartData;
  utg: PositionBB100ChartData;
  hj: PositionBB100ChartData;
  co: PositionBB100ChartData;
  btn: PositionBB100ChartData;
  sb: PositionBB100ChartData;
  bb: PositionBB100ChartData;
}

// Combined position analysis chart data
export interface CombinedPositionChartData {
  profitData: CompletePositionProfitChartData;
  bb100Data: CompletePositionBB100ChartData;
}

// Street-based profit statistics for position analysis
export interface StreetProfitPositionStats {
  position: string;
  profit: number;  // Total profit when hero_profit > 0
  loss: number;    // Total loss when hero_profit <= 0
  totalPnL: number; // Total profit + loss (net result)
  profitCount: number;  // Number of profitable hands
  lossCount: number;    // Number of losing hands
}

export interface StreetProfitAnalysisData {
  stage: string;
  positions: StreetProfitPositionStats[];
}

export interface CompleteStreetProfitChartData {
  preflop: StreetProfitAnalysisData;
  flop: StreetProfitAnalysisData;
  turn: StreetProfitAnalysisData;
  river: StreetProfitAnalysisData;
  showdown: StreetProfitAnalysisData;
}

// Action Analysis types
export interface ActionAnalysisPositionStats {
  position: string;
  raisePct: number;    // Percentage of hands where last action was Raise
  betPct: number;      // Percentage of hands where last action was Bet
  callPct: number;     // Percentage of hands where last action was Call
  checkPct: number;    // Percentage of hands where last action was Check
  foldPct: number;     // Percentage of hands where last action was Fold
  totalHands: number;  // Total hands for this position
}

export interface StreetActionAnalysisData {
  stage: string;
  positions: ActionAnalysisPositionStats[];
}

export interface CompleteActionAnalysisChartData {
  preflop: StreetActionAnalysisData;
  flop: StreetActionAnalysisData;
  turn: StreetActionAnalysisData;
  river: StreetActionAnalysisData;
  showdown: StreetActionAnalysisData; // For showdown win% instead of actions
}

// ================== Parsing Result Interfaces ==================

export interface ParseHandResult {
  hand: ParsedHand;
  nextIndex: number;
}

export interface FileParseResult {
  handsParsed: number;
  profit: number;
}

// ================== Enums ==================

export enum GameType {
  RUSH_AND_CASH = 'Rush & Cash',
  CASH_GAME = 'Cash Game'
}

export enum HandResult {
  SHOWDOWN_WIN = 'showdown_win',
  SHOWDOWN_LOSS = 'showdown_loss',
  NO_SHOWDOWN_WIN = 'no_showdown_win',
  NO_SHOWDOWN_LOSS = 'no_showdown_loss'
}

export enum FinalStage {
  PREFLOP = 'preflop',
  FLOP = 'flop',
  TURN = 'turn',
  RIVER = 'river',
  SHOWDOWN = 'showdown'
}

export enum PokerPosition {
  UTG = 'UTG',        // Under The Gun
  HJ = 'HJ',          // Hijack
  CO = 'CO',          // Cutoff
  BTN = 'BTN',        // Button
  SB = 'SB',          // Small Blind
  BB = 'BB'           // Big Blind
}

// ================== Type Helpers ==================

export type DatabaseInsertHand = Omit<PokerHand, 'id' | 'created_at'>;
export type PartialParsedHand = Partial<ParsedHand>;
export type HandSectionType = keyof HeroActions; 