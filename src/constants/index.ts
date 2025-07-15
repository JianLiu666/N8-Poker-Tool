/**
 * Application-wide constants for the N8 Poker Tool
 * Organized by feature area for better maintainability
 */

// ================== File & Path Constants ==================

export const FILE_PATTERNS = {
  LOG_FILE_EXTENSION: '.txt',
  CHART_FILE_EXTENSION: '.jpg'
} as const;

export const DATABASE = {
  DEFAULT_PATH: './data/poker.db',
  TABLE_NAME: 'poker_hands'
} as const;

// ================== Chart Configuration ==================

export const CHARTS = {
  // Output settings
  DEFAULT_OUTPUT_DIR: './charts',
  DEFAULT_FILE_EXTENSION: '.jpg',
  BACKGROUND_COLOR: '#FFFFFF',
  
  // Dimensions and quality
  DEFAULT_WIDTH: 1200,
  DEFAULT_HEIGHT: 800,
  DEFAULT_QUALITY: 0.95,
  
  // Data processing settings
  DEFAULT_SAMPLING_INTERVAL: 1,
  DEFAULT_BB100_INTERVAL: 100
} as const;

// Chart colors with semantic naming
export const CHART_COLORS = {
  // Line chart colors
  PROFIT_WITHOUT_RAKE: 'rgba(134, 239, 172, 0.6)',
  ACTUAL_PROFIT: 'rgb(34, 197, 94)',
  SHOWDOWN_PROFIT: 'rgb(59, 130, 246)',
  NO_SHOWDOWN_PROFIT: 'rgb(239, 68, 68)',
  
  // Bar chart colors
  BAR_WINS: 'rgba(34, 197, 94, 0.8)',
  BAR_LOSSES: 'rgba(239, 68, 68, 0.8)',
  BAR_WINS_BORDER: 'rgb(34, 197, 94)',
  BAR_LOSSES_BORDER: 'rgb(239, 68, 68)',
  
  // Action Analysis colors
  ACTION_RAISE: 'rgba(153, 27, 27, 0.8)',      // Dark red
  ACTION_BET: 'rgba(239, 68, 68, 0.8)',        // Light red
  ACTION_CALL: 'rgba(21, 128, 61, 0.8)',       // Dark green
  ACTION_CHECK: 'rgba(134, 239, 172, 0.8)',    // Light green
  ACTION_FOLD: 'rgba(147, 197, 253, 0.8)',     // Light blue
  ACTION_WIN_RATE: 'rgba(34, 197, 94, 0.8)',   // Green for win rate
  
  // General styling
  BACKGROUND_ALPHA: 0.1,
  BAR_BACKGROUND_ALPHA: 0.8,
  BORDER_WIDTH: 2
} as const;

// ================== Poker-specific Constants ==================

export const POKER = {
  MAX_PLAYERS: 6,
  POSITION_COUNT: 6,
  DECIMAL_PRECISION: 2
} as const;

// ================== Parsing Constants ==================

// Regex patterns for parsing poker hand logs
export const PATTERNS = {
  HAND_HEADER: /Poker Hand #([^:]+): Hold'em No Limit \(\$([0-9.]+)\/\$([0-9.]+)\) - (.+)/,
  TABLE_INFO: /Table '([^']+)'/,
  BUTTON_POSITION: /Seat #(\d+) is the button/,
  HERO_SEAT: /Seat (\d+): Hero \(\$([0-9.]+) in chips\)/,
  HOLE_CARDS: /Dealt to Hero \[([^\]]+)\]/,
  CARDS_IN_BRACKETS: /\[([^\]]+)\]/g,
  
  // Amount parsing patterns
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

// Hand section identifiers
export const HAND_SECTIONS = {
  FLOP: '*** FLOP ***',
  TURN: '*** TURN ***',
  RIVER: '*** RIVER ***',
  SUMMARY: '*** SUMMARY ***'
} as const;

// Action codes for poker actions
export const ACTION_CODES = {
  FOLD: 'F',
  CHECK: 'X',
  CALL: 'C',
  BET: 'B',
  RAISE: 'R'
} as const;

// ================== Logging Constants ==================

// Emojis for consistent console output
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