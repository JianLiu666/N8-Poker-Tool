# N8 Poker Tool

Natural8 PokerCraft hand log parser and analyzer

## Features

- **Parse** - Parse Natural8 PokerCraft log files and save to SQLite database
- **Chart** - Generate profit trend charts with rake impact analysis

## Quick Start

### Prerequisites

Create these directories in your project root:
```
hand_logs/    # Place your .txt log files here
data/         # Database storage (auto-created)
charts/       # Chart output (auto-created)
```

### Installation

```bash
npm install
npm run build
```

### Usage

1. **Parse your hand logs**
   ```bash
   npm start parse -i ./hand_logs
   ```

2. **Generate profit charts**
   ```bash
   npm start chart
   ```

## Commands

### Parse Command
```bash
npm start parse -i <input_dir> [-d <database_path>]
```
- `-i, --input` - Directory containing .txt log files (required)
- `-d, --database` - Custom database path (optional, default: `./data/poker.db`)

### Chart Command
```bash
npm start chart [-o <output_dir>] [-d <database_path>] [--start <date>] [--end <date>]
```
- `-o, --output` - Chart output directory (optional, default: `./charts`)
- `-d, --database` - Database path (optional, default: `./data/poker.db`)
- `--start` - Start date (YYYY-MM-DD format, optional)
- `--end` - End date (YYYY-MM-DD format, optional)

## Chart Analysis

The generated chart shows four trend lines:
- **Profit without rake** - Performance without rake deduction
- **Actual profit** - Real money flow after rake
- **Showdown profit** - Profit from hands that went to showdown
- **No showdown profit** - Profit from hands that didn't reach showdown

## Development

```bash
npm run dev        # Development mode with auto-reload
npm test          # Run tests
npm run clean     # Clean compiled files
```

## File Requirements

- **Input**: Natural8 PokerCraft `.txt` log files
- **Output**: Chart images in `.jpg` format (1200x800px)

## Notes

- Automatically skips duplicate hands
- Supports 6-handed table position calculation
- Rake calculated only for winning hands 