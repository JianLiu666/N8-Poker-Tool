/**
 * Application-wide constants for the N8 Poker Tool
 */

// File patterns
export const FILE_PATTERNS = {
  LOG_FILE_EXTENSION: '.txt',
  CHART_FILE_EXTENSION: '.jpg'
} as const;

// Database configuration
export const DATABASE = {
  DEFAULT_PATH: './data/poker.db',
  TABLE_NAME: 'poker_hands'
} as const;

// Chart configuration
export const CHARTS = {
  DEFAULT_OUTPUT_DIR: './charts',
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 800,
  DEFAULT_QUALITY: 0.95,
  DEFAULT_SAMPLING_INTERVAL: 1,
  DEFAULT_BB100_INTERVAL: 100,
  DEFAULT_FILE_EXTENSION: '.jpg',
  BACKGROUND_COLOR: '#FFFFFF'
} as const;

// Poker-specific constants
export const POKER = {
  MAX_PLAYERS: 6,
  POSITION_COUNT: 6,
  DECIMAL_PRECISION: 2
} as const;

// Regex patterns for parsing
export const PATTERNS = {
  HAND_HEADER: /Poker Hand #([^:]+): Hold'em No Limit \(\$([0-9.]+)\/\$([0-9.]+)\) - (.+)/,
  TABLE_INFO: /Table '([^']+)'/,
  BUTTON_POSITION: /Seat #(\d+) is the button/,
  HERO_SEAT: /Seat (\d+): Hero \(\$([0-9.]+) in chips\)/,
  HOLE_CARDS: /Dealt to Hero \[([^\]]+)\]/,
  CARDS_IN_BRACKETS: /\[([^\]]+)\]/g,
  AMOUNT_PATTERNS: {
    POSTS_SMALL_BLIND: /posts small blind \$([0-9.]+)/,
    POSTS_BIG_BLIND: /posts big blind \$([0-9.]+)/,
    CALLS: /calls \$([0-9.]+)/,
    BETS: /bets \$([0-9.]+)/,
    RAISES: /raises \$[0-9.]+ to \$([0-9.]+)/,
    UNCALLED_BET: /Uncalled bet \(\$([0-9.]+)\) returned to Hero/,
    TOTAL_POT: /Total pot \$([0-9.]+)/,
    RAKE: /Rake \$([0-9.]+)/,
    JACKPOT: /Jackpot \$([0-9.]+)/,
    WON: /won \(\$([0-9.]+)\)/,
    COLLECTED: /collected \(\$([0-9.]+)\)/
  }
} as const;

// Section identifiers for hand parsing
export const HAND_SECTIONS = {
  FLOP: '*** FLOP ***',
  TURN: '*** TURN ***',
  RIVER: '*** RIVER ***',
  SUMMARY: '*** SUMMARY ***'
} as const;

// Action codes
export const ACTION_CODES = {
  FOLD: 'F',
  CHECK: 'X',
  CALL: 'C',
  BET: 'B',
  RAISE: 'R'
} as const;

// Chart colors
export const CHART_COLORS = {
  PROFIT_WITHOUT_RAKE: 'rgba(134, 239, 172, 0.6)',
  ACTUAL_PROFIT: 'rgb(34, 197, 94)',
  SHOWDOWN_PROFIT: 'rgb(59, 130, 246)',
  NO_SHOWDOWN_PROFIT: 'rgb(239, 68, 68)',
  BACKGROUND_ALPHA: 0.1,
  BORDER_WIDTH: 2
} as const;

// Logging emojis for consistent output
export const LOG_EMOJIS = {
  START: '🚀',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  FILE: '📄',
  CHART: '📊',
  DATABASE: '🗄️',
  SKIP: '⏭️',
  TARGET: '🎯',
  MONEY: '💰'
} as const; 