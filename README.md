# N8 Poker Tool

Natural8 PokerCraft hand log parser and analyzer

## Features

1. **Parse Command** - Parse Natural8 PokerCraft log files and save to SQLite database
2. **Chart Command** - Generate profit trend charts with rake impact analysis

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Directory Structure

Before using the tool, make sure you have the following directories:

- `hand_logs/` - Place your Natural8 PokerCraft .txt log files here
- `data/` - SQLite database will be automatically created here as `poker.db`
- `charts/` - Generated chart images (.jpg) will be saved here

## Usage

### 1. Parse Log Files

First, place your Natural8 PokerCraft log files (`.txt` format) in the `hand_logs/` directory, then run:

```bash
# Development mode
npm run dev parse -i ./hand_logs

# Production mode (after build)
npm start parse -i ./hand_logs

# Specify custom database path
npm start parse -i ./hand_logs -d ./custom/database.db
```

The parser will:
- Read all `.txt` files from the specified directory
- Extract hand information including positions, actions, investments, and profits
- Calculate rake impact and hand results (showdown vs no-showdown)
- Store data in SQLite database with duplicate detection

### 2. Generate Profit Charts

After parsing log files, generate trend analysis charts:

```bash
# Development mode - generate chart for all hands
npm run dev chart

# Production mode
npm start chart

# Specify date range
npm start chart --start 2024-01-01 --end 2024-12-31

# Custom output directory and database path
npm start chart -o ./custom-charts -d ./custom/database.db
```

The chart will show four trend lines:
- **Profit without rake** (light green, bottom layer) - Your performance if no rake was charged
- **No Showdown Profit** (red, third layer) - Cumulative profit from hands that didn't go to showdown
- **Showdown Profit** (blue, second layer) - Cumulative profit from hands that went to showdown  
- **Actual profit (after rake)** (dark green, top layer) - Your real money flow after rake deduction

## Database Schema

### poker_hands table
Contains detailed information for each hand:
- `hand_id` - Unique hand identifier
- `hand_start_time` - When the hand started
- `game_type` - Rush & Cash or Cash Game
- `small_blind`, `big_blind` - Blind amounts
- `hero_position` - Your position (UTG, HJ, CO, BTN, SB, BB)
- `hero_hole_cards` - Your hole cards
- `flop_cards`, `turn_card`, `river_card` - Community cards
- `hero_*_investment` - Your investment in each betting round
- `hero_*_actions` - Your actions in each round (X=check, B=bet, C=call, R=raise, F=fold)
- `pot_amount` - Total pot size
- `hero_profit` - Your net profit/loss (after rake)
- `hero_rake` - Rake charged (only when you win)
- `hero_hand_result` - showdown_win, showdown_loss, no_showdown_win, no_showdown_loss
- `final_stage` - Which stage the hand ended (preflop, flop, turn, river, showdown)

## Chart Analysis

The generated charts provide insights into:

1. **Rake Impact**: Compare "Profit without rake" vs "Actual profit" to see how much rake affects your results
2. **Showdown vs No-Showdown Performance**: Analyze your bluffing effectiveness and value betting
3. **Overall Trend**: Track your cumulative profit over time

Example output:
```
📊 Chart statistics:
   - Total hands: 6907
   - All four lines have 6907 data points
   - Profit without rake: -19.93
   - Actual profit (after rake): -57.41
   - Rake total impact: 37.48
   - Final showdown profit: 4.26
   - Final no-showdown profit: -61.67
```

## Development

```bash
# Development mode with auto-reload
npm run dev

# Run tests
npm test

# Clean compiled files
npm run clean
```

## File Formats

### Input: Natural8 PokerCraft Log Files
- Format: `.txt` files exported from PokerCraft
- Contains hand histories with detailed action sequences
- Must include hero's hole cards, actions, and results

### Output: Chart Images
- Format: `.jpg` files (white background, no transparency)
- Resolution: 1200x800 pixels
- Filename: `poker-profit-chart-YYYY-MM-DD.jpg`

## Important Notes

- The tool automatically detects and skips already parsed hands to avoid duplicates
- Rake is only calculated for winning hands (when `hero_profit > 0`)
- Position calculation assumes 6-handed tables
- All monetary values are stored with 2 decimal precision
- The chart shows cumulative profits, not individual hand results

## Troubleshooting

- **No .txt files found**: Make sure your log files are in the correct directory and have `.txt` extension
- **Database connection errors**: Ensure the `data/` directory exists and is writable
- **Chart generation fails**: Verify that hands have been parsed first using the parse command 