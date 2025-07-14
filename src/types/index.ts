/**
 * Centralized type definitions for the N8 Poker Tool
 */

// Configuration interfaces
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

// Database entity interfaces
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

// Parsing interfaces
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

// Chart-related interfaces
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

// Parsing result interfaces
export interface ParseHandResult {
  hand: ParsedHand;
  nextIndex: number;
}

export interface FileParseResult {
  handsParsed: number;
  profit: number;
}

// Enums
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

export enum ChartType {
  PROFIT_TREND = 'profit-trend',
  BB100_TREND = 'bb100-trend'
}

export enum HandSection {
  PREFLOP = 'preflop',
  FLOP = 'flop',
  TURN = 'turn',
  RIVER = 'river'
}

// Type helpers
export type DatabaseInsertHand = Omit<PokerHand, 'id' | 'created_at'>;
export type PartialParsedHand = Partial<ParsedHand>;
export type HandSectionType = keyof HeroActions; 