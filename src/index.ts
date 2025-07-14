#!/usr/bin/env node

import { Command } from 'commander';
import { ParseCommand } from './commands/parse-command';
import { ChartCommand } from './commands/chart-command';

const program = new Command();

program
  .name('n8-poker-tool')
  .description('Natural8 PokerCraft log parser and analyzer')
  .version('1.0.0');

program
  .command('parse')
  .description('Parse Natural8 PokerCraft logs and save to SQLite database')
  .requiredOption('-i, --input <directory>', 'Input directory containing log files')
  .option('-d, --db <path>', 'SQLite database path (default: ./data/poker.db)')
  .action(async (options) => {
    try {
      const parseCommand = new ParseCommand({
        inputDir: options.input,
        dbPath: options.db
      });
      await parseCommand.execute();
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program
  .command('chart')
  .description('Generate trend charts from poker data')
  .option('-d, --db <path>', 'SQLite database path (default: ./data/poker.db)')
  .option('-o, --output <directory>', 'Output directory for charts (default: ./charts)')
  .option('--start <date>', 'Start date for chart data (YYYY-MM-DD)')
  .option('--end <date>', 'End date for chart data (YYYY-MM-DD)')
  .option('-i, --interval <number>', 'Chart sampling interval in hands (default: 1)', '1')
  .action(async (options) => {
    try {
      const chartCommand = new ChartCommand({
        dbPath: options.db,
        outputDir: options.output,
        dateRange: options.start && options.end ? {
          start: options.start,
          end: options.end
        } : undefined,
        interval: parseInt(options.interval)
      });
      await chartCommand.execute();
    } catch (error) {
      console.error('Command failed:', error);
      process.exit(1);
    }
  });

program.parse(); 