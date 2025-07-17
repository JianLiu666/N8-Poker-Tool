import { POKER } from '../constants';

/**
 * Utility functions for the N8 Poker Tool
 * Provides common helper functions for parsing, formatting, and validation
 */

/**
 * Rounds a number to specified decimal places to avoid floating point precision issues
 */
export const roundToDecimals = (num: number, decimals: number = POKER.DECIMAL_PRECISION): number => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Safely parses a float from a string with optional default value
 */
export const safeParseFloat = (value: string | undefined | null, defaultValue: number = 0): number => {
  if (!value || value.trim() === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Safely parses an integer from a string with optional default value
 */
export const safeParseInt = (value: string | undefined | null, defaultValue: number = 0): number => {
  if (!value || value.trim() === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Checks if a line is empty or contains only whitespace
 */
export const isEmptyLine = (line: string): boolean => {
  return line.trim() === '';
};

/**
 * Extracts text content between brackets from a string
 */
export const extractBracketContent = (text: string): string[] => {
  const matches = text.match(/\[([^\]]+)\]/g);
  return matches ? matches.map(match => match.replace(/[\[\]]/g, '')) : [];
};

/**
 * Splits cards string by spaces and filters out empty strings
 */
export const parseCards = (cardsString: string): string[] => {
  return cardsString.split(' ').filter(card => card.trim() !== '');
};

/**
 * Determines if a hand result indicates a showdown
 */
export const isShowdownResult = (handResult: string): boolean => {
  return handResult === 'showdown_win' || handResult === 'showdown_loss';
};

/**
 * Calculates the relative position of a seat from the button position
 */
export const calculateRelativePosition = (seatNumber: number, buttonSeat: number, totalSeats: number = POKER.POSITION_COUNT): number => {
  return (seatNumber - buttonSeat + totalSeats) % totalSeats;
};

/**
 * Formats a timestamp for consistent display
 */
export const formatTimestamp = (): string => {
  return new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
};

/**
 * Formats a number as currency
 */
export const formatCurrency = (amount: number): string => {
  return `$${amount.toFixed(2)}`;
};

/**
 * Formats BB/100 value with proper decimal places
 */
export const formatBB100 = (value: number): string => {
  return `${value.toFixed(2)} BB/100`;
};

/**
 * Ensures a directory path exists, creating it if necessary
 */
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  const fs = await import('fs-extra');
  await fs.ensureDir(dirPath);
};

/**
 * Creates a standardized error message with context
 */
export const createError = (operation: string, originalError: Error | string): Error => {
  const message = typeof originalError === 'string' ? originalError : originalError.message;
  return new Error(`${operation}: ${message}`);
};

/**
 * Validates that a hand ID is not empty
 */
export const isValidHandId = (handId: string | undefined): boolean => {
  return Boolean(handId && handId.trim().length > 0);
};

/**
 * Validates date string format (YYYY-MM-DD)
 */
export const isValidDateFormat = (dateString: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return date.toISOString().split('T')[0] === dateString;
};

/**
 * Checks if an error is a SQLite UNIQUE constraint violation
 */
export const isUniqueConstraintError = (error: Error): boolean => {
  return error.message.includes('UNIQUE constraint failed');
};


// Re-export error handling utilities
export * from './error-handler'; 