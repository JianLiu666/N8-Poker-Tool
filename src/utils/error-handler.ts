import { LOG_EMOJIS } from '../constants';

/**
 * Custom error types for the poker tool
 */
export class PokerToolError extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PokerToolError';
  }
}

export class DatabaseError extends PokerToolError {
  constructor(message: string, operation: string, originalError?: Error) {
    super(message, operation, originalError);
    this.name = 'DatabaseError';
  }
}

export class ParseError extends PokerToolError {
  constructor(message: string, operation: string, originalError?: Error) {
    super(message, operation, originalError);
    this.name = 'ParseError';
  }
}

export class ChartError extends PokerToolError {
  constructor(message: string, operation: string, originalError?: Error) {
    super(message, operation, originalError);
    this.name = 'ChartError';
  }
}

export class ValidationError extends PokerToolError {
  constructor(message: string, operation: string, originalError?: Error) {
    super(message, operation, originalError);
    this.name = 'ValidationError';
  }
}

/**
 * Error handler utility class
 */
export class ErrorHandler {
  
  /**
   * Handle and log an error with appropriate formatting
   */
  static handle(error: Error, context?: string): void {
    const errorMessage = this.formatErrorMessage(error, context);
    console.error(errorMessage);
  }

  /**
   * Create a database error with proper context
   */
  static createDatabaseError(operation: string, originalError: Error | string): DatabaseError {
    const message = typeof originalError === 'string' ? originalError : originalError.message;
    const error = typeof originalError === 'string' ? undefined : originalError;
    return new DatabaseError(`Database operation failed: ${message}`, operation, error);
  }

  /**
   * Create a parse error with proper context
   */
  static createParseError(operation: string, originalError: Error | string): ParseError {
    const message = typeof originalError === 'string' ? originalError : originalError.message;
    const error = typeof originalError === 'string' ? undefined : originalError;
    return new ParseError(`Parse operation failed: ${message}`, operation, error);
  }

  /**
   * Create a chart error with proper context
   */
  static createChartError(operation: string, originalError: Error | string): ChartError {
    const message = typeof originalError === 'string' ? originalError : originalError.message;
    const error = typeof originalError === 'string' ? undefined : originalError;
    return new ChartError(`Chart operation failed: ${message}`, operation, error);
  }

  /**
   * Create a validation error with proper context
   */
  static createValidationError(operation: string, originalError: Error | string): ValidationError {
    const message = typeof originalError === 'string' ? originalError : originalError.message;
    const error = typeof originalError === 'string' ? undefined : originalError;
    return new ValidationError(`Validation failed: ${message}`, operation, error);
  }

  /**
   * Check if an error is a SQLite UNIQUE constraint violation
   */
  static isUniqueConstraintError(error: Error): boolean {
    return error.message.includes('UNIQUE constraint failed');
  }

  /**
   * Check if an error is a file system error
   */
  static isFileSystemError(error: Error): boolean {
    return error.message.includes('ENOENT') || 
           error.message.includes('EACCES') || 
           error.message.includes('EISDIR');
  }

  /**
   * Format error message with appropriate emoji and context
   */
  private static formatErrorMessage(error: Error, context?: string): string {
    const contextPrefix = context ? `[${context}] ` : '';
    
    if (error instanceof PokerToolError) {
      return `${LOG_EMOJIS.ERROR} ${contextPrefix}${error.operation}: ${error.message}`;
    }
    
    return `${LOG_EMOJIS.ERROR} ${contextPrefix}${error.name}: ${error.message}`;
  }

  /**
   * Safe async operation wrapper with error handling
   */
  static async safeAsync<T>(
    operation: () => Promise<T>,
    errorContext: string,
    errorType: 'database' | 'parse' | 'chart' | 'validation' = 'database'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      switch (errorType) {
        case 'database':
          throw this.createDatabaseError(errorContext, error as Error);
        case 'parse':
          throw this.createParseError(errorContext, error as Error);
        case 'chart':
          throw this.createChartError(errorContext, error as Error);
        case 'validation':
          throw this.createValidationError(errorContext, error as Error);
        default:
          throw error;
      }
    }
  }

  /**
   * Safe sync operation wrapper with error handling
   */
  static safe<T>(
    operation: () => T,
    errorContext: string,
    errorType: 'database' | 'parse' | 'chart' | 'validation' = 'database'
  ): T {
    try {
      return operation();
    } catch (error) {
      switch (errorType) {
        case 'database':
          throw this.createDatabaseError(errorContext, error as Error);
        case 'parse':
          throw this.createParseError(errorContext, error as Error);
        case 'chart':
          throw this.createChartError(errorContext, error as Error);
        case 'validation':
          throw this.createValidationError(errorContext, error as Error);
        default:
          throw error;
      }
    }
  }
} 