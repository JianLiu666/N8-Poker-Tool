# N8 Poker Tool

Natural8 PokerCraft hand log parser and analyzer

## Setup

```bash
npm install
npm run build
```

Create required directories:
```bash
mkdir -p hand_logs data charts
```

## Usage

### Parse logs
```bash
npm start parse -i ./hand_logs
```

### Generate charts
```bash
npm start chart
```

## Commands

### Parse
```bash
npm start parse -i <input_dir> [-d <database_path>]
```
- `-i, --input` - Directory containing .txt log files
- `-d, --database` - Custom database path (default: ./data/poker.db)

### Chart
```bash
npm start chart [-o <output_dir>] [-d <database_path>] [--start <date>] [--end <date>]
```
- `-o, --output` - Chart output directory (default: ./charts)
- `-d, --database` - Database path (default: ./data/poker.db)
- `--start` - Start date (YYYY-MM-DD format)
- `--end` - End date (YYYY-MM-DD format)

## Chart Output

Generates two high-resolution charts:

1. **Profit Analysis** - Profit trends and BB/100 analysis
2. **Street Analysis** - Action and profit analysis by position

## Development

```bash
npm run dev        # Development mode
npm test          # Run tests
npm run clean     # Clean build files
```

## File Requirements

- **Input**: Natural8 PokerCraft `.txt` log files
- **Output**: High-resolution `.jpg` charts (2400x1600px)