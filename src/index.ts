#!/usr/bin/env node

import { Command } from 'commander';
import { ParseCommand } from './commands/parse-command';
import { ChartCommand } from './commands/chart-command';
import { ParseCommandOptions, ChartCommandOptions } from './types';
import { ErrorHandler } from './utils';
import { LOG_EMOJIS } from './constants';

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('n8-poker-tool')
    .description('Natural8 PokerCraft log parser and analyzer')
    .version('1.0.0');

  return program;
}

/**
 * Add parse command to the program
 */
function addParseCommand(program: Command): void {
  program
    .command('parse')
    .description('Parse Natural8 PokerCraft logs and save to SQLite database')
    .requiredOption('-i, --input <directory>', 'Input directory containing log files')
    .option('-d, --db <path>', 'SQLite database path (default: ./data/poker.db)')
    .action(async (options) => {
      await executeCommand('parse', async () => {
        const parseOptions: ParseCommandOptions = {
          inputDir: options.input,
          dbPath: options.db
        };
        
        const parseCommand = new ParseCommand(parseOptions);
        await parseCommand.execute();
      });
    });
}

/**
 * Add chart command to the program
 */
function addChartCommand(program: Command): void {
  program
    .command('chart')
    .description('Generate trend charts from poker data')
    .option('-d, --db <path>', 'SQLite database path (default: ./data/poker.db)')
    .option('-o, --output <directory>', 'Output directory for charts (default: ./charts)')
    .option('--start <date>', 'Start date for chart data (YYYY-MM-DD)')
    .option('--end <date>', 'End date for chart data (YYYY-MM-DD)')
    .option('-i, --interval <number>', 'Chart sampling interval in hands (default: 1)', '1')

    .action(async (options) => {
      await executeCommand('chart', async () => {
        const chartOptions: ChartCommandOptions = {
          dbPath: options.db,
          outputDir: options.output,
          dateRange: options.start && options.end ? {
            start: options.start,
            end: options.end
          } : undefined,
          interval: parseInt(options.interval, 10),

        };
        
        const chartCommand = new ChartCommand(chartOptions);
        await chartCommand.execute();
      });
    });
}

/**
 * Execute a command with proper error handling
 */
async function executeCommand(commandName: string, operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    ErrorHandler.handle(error as Error, commandName);
    console.error(`${LOG_EMOJIS.ERROR} Command '${commandName}' failed. See error details above.`);
    process.exit(1);
  }
}

/**
 * Main application entry point
 */
function main(): void {
  const program = createProgram();
  
  addParseCommand(program);
  addChartCommand(program);
  
  program.parse();
}

// Execute the main function
main(); 