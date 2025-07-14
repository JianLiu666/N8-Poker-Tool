import path from 'path';
import fs from 'fs-extra';
import { SqliteManager } from '../database/sqlite-manager';
import { 
  ParseCommandOptions, 
  ParsedHand, 
  PartialParsedHand,
  ParseHandResult,
  FileParseResult,
  HandSectionType,
  DatabaseInsertHand,
  GameType, 
  HandResult, 
  FinalStage, 
  PokerPosition 
} from '../types';
import { 
  DATABASE, 
  FILE_PATTERNS, 
  PATTERNS, 
  HAND_SECTIONS, 
  ACTION_CODES, 
  LOG_EMOJIS 
} from '../constants';
import { 
  roundToDecimals, 
  safeParseFloat, 
  safeParseInt,
  isEmptyLine,
  extractBracketContent,
  parseCards,
  calculateRelativePosition,
  createError,
  isValidHandId,
  isUniqueConstraintError
} from '../utils';

export class ParseCommand {
  private sqliteManager: SqliteManager;
  private options: ParseCommandOptions;

  constructor(options: ParseCommandOptions) {
    this.options = options;
    const dbPath = options.dbPath || path.join(process.cwd(), 'data', 'poker.db');
    this.sqliteManager = new SqliteManager({ dbPath });
  }

  async execute(): Promise<void> {
    try {
      console.log(`${LOG_EMOJIS.START} Starting parse command...`);
      
      await this.initializeDatabase();
      const handLogFiles = await this.getHandLogFiles();
      console.log(`Found ${handLogFiles.length} hand log files to parse`);

      const { totalHandsParsed, totalProfit } = await this.parseAllFiles(handLogFiles);

      console.log(`${LOG_EMOJIS.TARGET} Total hands parsed: ${totalHandsParsed}`);
      console.log(`${LOG_EMOJIS.MONEY} Total profit: ${totalProfit.toFixed(2)}`);
      console.log(`${LOG_EMOJIS.SUCCESS} Parse command completed successfully!`);

    } catch (error) {
      console.error(`${LOG_EMOJIS.ERROR} Parse command failed:`, error);
      throw error;
    } finally {
      await this.sqliteManager.disconnect();
    }
  }

  /**
   * Initialize database connection and tables
   */
  private async initializeDatabase(): Promise<void> {
    await this.sqliteManager.connect();
    await this.sqliteManager.initializeTables();
    
    const isConnected = await this.sqliteManager.testConnection();
    if (!isConnected) {
      throw new Error('Database connection test failed');
    }
  }

  /**
   * Get all hand log files from input directory
   */
  private async getHandLogFiles(): Promise<string[]> {
    const inputDir = path.resolve(this.options.inputDir);
    
    if (!await fs.pathExists(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    const files = await fs.readdir(inputDir);
    const handLogFiles = files
      .filter(file => file.endsWith(FILE_PATTERNS.LOG_FILE_EXTENSION))
      .map(file => path.join(inputDir, file));

    if (handLogFiles.length === 0) {
      throw new Error(`No ${FILE_PATTERNS.LOG_FILE_EXTENSION} files found in ${inputDir}`);
    }

    return handLogFiles;
  }

  /**
   * Parse all hand log files
   */
  private async parseAllFiles(filePaths: string[]): Promise<{ totalHandsParsed: number; totalProfit: number }> {
    let totalHandsParsed = 0;
    let totalProfit = 0;

    for (const filePath of filePaths) {
      console.log(`${LOG_EMOJIS.FILE} Parsing file: ${path.basename(filePath)}`);
      const { handsParsed, profit } = await this.parseHandLogFile(filePath);
      totalHandsParsed += handsParsed;
      totalProfit += profit;
      console.log(`${LOG_EMOJIS.SUCCESS} Parsed ${handsParsed} hands from ${path.basename(filePath)}, profit: ${profit.toFixed(2)}`);
    }

    return { totalHandsParsed, totalProfit };
  }

  /**
   * Parse a single hand log file
   */
  private async parseHandLogFile(filePath: string): Promise<FileParseResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim());
    
    const hands: ParsedHand[] = [];
    let i = 0;
    let skippedHands = 0;
    
    while (i < lines.length) {
      if (lines[i].startsWith('Poker Hand #')) {
        const result = this.parseCompleteHand(lines, i);
        if (result) {
          const existingHand = await this.sqliteManager.getPokerHandById(result.hand.handId);
          if (existingHand) {
            console.log(`${LOG_EMOJIS.SKIP} Skipping already parsed hand: ${result.hand.handId}`);
            skippedHands++;
          } else {
            hands.push(result.hand);
          }
          i = result.nextIndex;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    // Save hands to database
    let totalProfit = 0;
    for (const hand of hands) {
      await this.saveHandToDatabase(hand);
      totalProfit += hand.heroProfit;
    }

    if (skippedHands > 0) {
      console.log(`${LOG_EMOJIS.SKIP} Skipped ${skippedHands} already parsed hands from ${path.basename(filePath)}`);
    }

    return { handsParsed: hands.length, profit: totalProfit };
  }

  /**
   * Parse a complete hand from the log lines
   */
  private parseCompleteHand(lines: string[], startIndex: number): ParseHandResult | null {
    let i = startIndex;
    
    const handHeader = this.parseHandHeader(lines[i]);
    if (!handHeader) return null;
    
    i++;
    
    // Initialize hand data with default values
    const hand: PartialParsedHand = {
      ...handHeader,
      heroActions: { preflop: [], flop: [], turn: [], river: [] },
      heroInvestments: { preflop: 0, flop: 0, turn: 0, river: 0 },
      flopCards: '',
      turnCard: '',
      riverCard: '',
      heroRake: 0,
      potAmount: 0,
      jackpotAmount: 0
    };

    let heroSeatNumber: number | null = null;
    let buttonSeatNumber: number | null = null;
    let currentSection: HandSectionType = 'preflop';

    // Parse hand content
    while (i < lines.length && !lines[i].startsWith('Poker Hand #')) {
      const line = lines[i];
      
      if (isEmptyLine(line)) {
        i++;
        continue;
      }

      // Parse table info and button position
      if (line.startsWith('Table \'')) {
        this.parseTableInfo(hand, line);
        buttonSeatNumber = this.parseButtonPosition(line);
      }
      // Parse seat information
      else if (line.startsWith('Seat ') && line.includes('Hero')) {
        heroSeatNumber = this.parseHeroSeat(hand, line);
      }
      // Parse hole cards
      else if (line.startsWith('Dealt to Hero [')) {
        this.parseHoleCards(hand, line);
      }
      // Parse street transitions and community cards
      else if (this.isStreetTransition(line)) {
        const result = this.parseStreetTransition(hand, line);
        if (result) currentSection = result;
      }
      // Parse hero actions
      else if (line.includes('Hero:')) {
        this.parseHeroAction(hand, line, currentSection);
      }
      // Parse uncalled bet returns
      else if (line.includes('Uncalled bet') && line.includes('returned to Hero')) {
        this.parseUncalledBet(hand, line, currentSection);
      }
      // Parse summary section
      else if (line.startsWith(HAND_SECTIONS.SUMMARY)) {
        i = this.parseSummarySection(lines, i, hand, heroSeatNumber);
        break;
      }

      i++;
    }

    const finalizedHand = this.finalizeHand(hand, heroSeatNumber, buttonSeatNumber);
    return { hand: finalizedHand, nextIndex: i };
  }

  /**
   * Parse hand header information
   */
  private parseHandHeader(line: string): PartialParsedHand | null {
    const match = line.match(PATTERNS.HAND_HEADER);
    if (!match) return null;

    const [, handId, smallBlind, bigBlind, timestamp] = match;
    
    return {
      handId,
      smallBlind: safeParseFloat(smallBlind),
      bigBlind: safeParseFloat(bigBlind),
      timestamp,
      gameType: GameType.RUSH_AND_CASH,
      heroProfit: 0
    };
  }

  /**
   * Parse table information
   */
  private parseTableInfo(hand: PartialParsedHand, line: string): void {
    const tableMatch = line.match(PATTERNS.TABLE_INFO);
    if (tableMatch) {
      hand.tableName = tableMatch[1];
    }
  }

  /**
   * Parse button position
   */
  private parseButtonPosition(line: string): number | null {
    const buttonMatch = line.match(PATTERNS.BUTTON_POSITION);
    return buttonMatch ? safeParseInt(buttonMatch[1]) : null;
  }

  /**
   * Parse hero seat information
   */
  private parseHeroSeat(hand: PartialParsedHand, line: string): number | null {
    const seatMatch = line.match(PATTERNS.HERO_SEAT);
    if (seatMatch) {
      const seatNumber = safeParseInt(seatMatch[1]);
      hand.heroStartingChips = safeParseFloat(seatMatch[2]);
      return seatNumber;
    }
    return null;
  }

  /**
   * Parse hole cards
   */
  private parseHoleCards(hand: PartialParsedHand, line: string): void {
    const cardsMatch = line.match(PATTERNS.HOLE_CARDS);
    if (cardsMatch) {
      hand.heroHoleCards = cardsMatch[1];
    }
  }

  /**
   * Check if line represents a street transition
   */
  private isStreetTransition(line: string): boolean {
    return line.startsWith(HAND_SECTIONS.FLOP) || 
           line.startsWith(HAND_SECTIONS.TURN) || 
           line.startsWith(HAND_SECTIONS.RIVER);
  }

  /**
   * Parse street transition and community cards
   */
  private parseStreetTransition(hand: PartialParsedHand, line: string): HandSectionType | null {
    if (line.startsWith(HAND_SECTIONS.FLOP)) {
      const flopCards = extractBracketContent(line);
      if (flopCards.length > 0) {
        hand.flopCards = flopCards[0];
      }
      return 'flop';
    }
    
    if (line.startsWith(HAND_SECTIONS.TURN)) {
      const turnCards = extractBracketContent(line);
      if (turnCards.length >= 2) {
        hand.turnCard = turnCards[1];
      } else if (turnCards.length === 1) {
        const cards = parseCards(turnCards[0]);
        hand.turnCard = cards[3] || '';
      }
      return 'turn';
    }
    
    if (line.startsWith(HAND_SECTIONS.RIVER)) {
      const riverCards = extractBracketContent(line);
      if (riverCards.length >= 2) {
        hand.riverCard = riverCards[1];
      } else if (riverCards.length === 1) {
        const cards = parseCards(riverCards[0]);
        hand.riverCard = cards[4] || '';
      }
      return 'river';
    }

    return null;
  }

  /**
   * Parse hero action and investment
   */
  private parseHeroAction(hand: PartialParsedHand, line: string, section: HandSectionType): void {
    if (!hand.heroActions || !hand.heroInvestments) return;

    // Handle blinds
    if (this.parseBlindAction(hand, line)) return;

    // Parse regular actions
    if (line.includes('folds')) {
      hand.heroActions[section].push(ACTION_CODES.FOLD);
    } else if (line.includes('checks')) {
      hand.heroActions[section].push(ACTION_CODES.CHECK);
    } else if (line.includes('calls')) {
      hand.heroActions[section].push(ACTION_CODES.CALL);
      this.updateInvestment(hand, line, section, PATTERNS.AMOUNT_PATTERNS.CALLS);
    } else if (line.includes('bets') && !line.includes('raises')) {
      hand.heroActions[section].push(ACTION_CODES.BET);
      this.updateInvestment(hand, line, section, PATTERNS.AMOUNT_PATTERNS.BETS);
    } else if (line.includes('raises')) {
      hand.heroActions[section].push(ACTION_CODES.RAISE);
      this.updateRaiseInvestment(hand, line, section);
    }
  }

  /**
   * Parse blind posting actions
   */
  private parseBlindAction(hand: PartialParsedHand, line: string): boolean {
    if (line.includes('posts small blind')) {
      const blindMatch = line.match(PATTERNS.AMOUNT_PATTERNS.POSTS_SMALL_BLIND);
      if (blindMatch) {
        hand.heroInvestments!.preflop = roundToDecimals(safeParseFloat(blindMatch[1]));
      }
      return true;
    }
    
    if (line.includes('posts big blind')) {
      const blindMatch = line.match(PATTERNS.AMOUNT_PATTERNS.POSTS_BIG_BLIND);
      if (blindMatch) {
        hand.heroInvestments!.preflop = roundToDecimals(safeParseFloat(blindMatch[1]));
      }
      return true;
    }

    return false;
  }

  /**
   * Update investment for call/bet actions
   */
  private updateInvestment(hand: PartialParsedHand, line: string, section: HandSectionType, pattern: RegExp): void {
    const match = line.match(pattern);
    if (match) {
      const amount = safeParseFloat(match[1]);
      hand.heroInvestments![section] = roundToDecimals(
        hand.heroInvestments![section] + amount
      );
    }
  }

  /**
   * Update investment for raise actions
   */
  private updateRaiseInvestment(hand: PartialParsedHand, line: string, section: HandSectionType): void {
    const raiseMatch = line.match(PATTERNS.AMOUNT_PATTERNS.RAISES);
    if (raiseMatch) {
      hand.heroInvestments![section] = roundToDecimals(safeParseFloat(raiseMatch[1]));
    }
  }

  /**
   * Parse uncalled bet returned to hero
   */
  private parseUncalledBet(hand: PartialParsedHand, line: string, section: HandSectionType): void {
    const uncalledMatch = line.match(PATTERNS.AMOUNT_PATTERNS.UNCALLED_BET);
    if (uncalledMatch) {
      const uncalledAmount = safeParseFloat(uncalledMatch[1]);
      hand.heroInvestments![section] = roundToDecimals(
        hand.heroInvestments![section] - uncalledAmount
      );
    }
  }

  /**
   * Parse the summary section of the hand
   */
  private parseSummarySection(lines: string[], startIndex: number, hand: PartialParsedHand, heroSeatNumber: number | null): number {
    let i = startIndex + 1;
    
    while (i < lines.length && !lines[i].startsWith('Poker Hand #')) {
      const line = lines[i].trim();
      
      if (isEmptyLine(line)) {
        i++;
        continue;
      }

      // Parse pot, rake, and jackpot
      if (line.startsWith('Total pot')) {
        this.parsePotInformation(hand, line);
      }

      // Parse hero's final result
      if (line.includes(`Seat ${heroSeatNumber}: Hero`) && heroSeatNumber) {
        this.parseHeroResult(hand, line);
      }
      
      i++;
    }
    
    return i;
  }

  /**
   * Parse pot, rake, and jackpot information
   */
  private parsePotInformation(hand: PartialParsedHand, line: string): void {
    const potMatch = line.match(PATTERNS.AMOUNT_PATTERNS.TOTAL_POT);
    if (potMatch) {
      hand.potAmount = safeParseFloat(potMatch[1]);
    }

    const rakeMatch = line.match(PATTERNS.AMOUNT_PATTERNS.RAKE);
    if (rakeMatch) {
      hand.heroRake = safeParseFloat(rakeMatch[1]);
    }

    const jackpotMatch = line.match(PATTERNS.AMOUNT_PATTERNS.JACKPOT);
    if (jackpotMatch) {
      hand.jackpotAmount = safeParseFloat(jackpotMatch[1]);
    }
  }

  /**
   * Parse hero's final result
   */
  private parseHeroResult(hand: PartialParsedHand, line: string): void {
    const wonMatch = line.match(PATTERNS.AMOUNT_PATTERNS.WON);
    const collectedMatch = line.match(PATTERNS.AMOUNT_PATTERNS.COLLECTED);
    
    if (wonMatch) {
      hand.heroProfit = safeParseFloat(wonMatch[1]);
    } else if (collectedMatch) {
      hand.heroProfit = safeParseFloat(collectedMatch[1]);
    }
    
    // Determine hand result based on showdown and profit
    if (line.includes('showed')) {
      hand.handResult = (hand.heroProfit || 0) > 0 ? HandResult.SHOWDOWN_WIN : HandResult.SHOWDOWN_LOSS;
    } else {
      hand.handResult = (hand.heroProfit || 0) > 0 ? HandResult.NO_SHOWDOWN_WIN : HandResult.NO_SHOWDOWN_LOSS;
    }
  }

  /**
   * Finalize hand data and calculate derived values
   */
  private finalizeHand(hand: PartialParsedHand, heroSeatNumber: number | null, buttonSeatNumber: number | null): ParsedHand {
    // Calculate total investment
    const totalInvestment = roundToDecimals(
      (hand.heroInvestments?.preflop || 0) + 
      (hand.heroInvestments?.flop || 0) + 
      (hand.heroInvestments?.turn || 0) + 
      (hand.heroInvestments?.river || 0)
    );
    
    // Calculate final profit
    const collectedAmount = hand.heroProfit || 0;
    let finalProfit: number;
    
    if (collectedAmount > 0) {
      finalProfit = roundToDecimals(collectedAmount - totalInvestment);
    } else {
      finalProfit = roundToDecimals(-totalInvestment);
    }
    
    // Determine final stage
    const finalStage = this.determineFinalStage(hand);

    // Determine hero position
    const heroPosition = this.determineHeroPosition(heroSeatNumber, buttonSeatNumber);

    return {
      handId: hand.handId!,
      timestamp: hand.timestamp!,
      tableName: hand.tableName || '',
      gameType: hand.gameType!,
      smallBlind: hand.smallBlind!,
      bigBlind: hand.bigBlind!,
      heroPosition,
      heroHoleCards: hand.heroHoleCards || '',
      flopCards: hand.flopCards || '',
      turnCard: hand.turnCard || '',
      riverCard: hand.riverCard || '',
      heroStartingChips: hand.heroStartingChips || 0,
      heroEndingChips: (hand.heroStartingChips || 0) + finalProfit,
      potAmount: roundToDecimals(hand.potAmount || 0),
      jackpotAmount: roundToDecimals(hand.jackpotAmount || 0),
      heroProfit: finalProfit,
      heroRake: roundToDecimals(hand.heroRake || 0),
      finalStage,
      handResult: hand.handResult || HandResult.NO_SHOWDOWN_LOSS,
      heroActions: hand.heroActions!,
      heroInvestments: {
        preflop: roundToDecimals(hand.heroInvestments?.preflop || 0),
        flop: roundToDecimals(hand.heroInvestments?.flop || 0),
        turn: roundToDecimals(hand.heroInvestments?.turn || 0),
        river: roundToDecimals(hand.heroInvestments?.river || 0)
      }
    };
  }

  /**
   * Determine the final stage of the hand
   */
  private determineFinalStage(hand: PartialParsedHand): FinalStage {
    if (hand.handResult === HandResult.SHOWDOWN_WIN || hand.handResult === HandResult.SHOWDOWN_LOSS) {
      return FinalStage.SHOWDOWN;
    }
    
    if (hand.riverCard) return FinalStage.RIVER;
    if (hand.turnCard) return FinalStage.TURN;
    if (hand.flopCards) return FinalStage.FLOP;
    
    return FinalStage.PREFLOP;
  }

  /**
   * Determine hero's position based on seat numbers
   */
  private determineHeroPosition(heroSeatNumber: number | null, buttonSeatNumber: number | null): PokerPosition {
    if (!heroSeatNumber || !buttonSeatNumber) {
      return PokerPosition.BTN;
    }

    const positions = [
      PokerPosition.BTN,  // Button
      PokerPosition.SB,   // Small Blind  
      PokerPosition.BB,   // Big Blind
      PokerPosition.UTG,  // Under The Gun
      PokerPosition.HJ,   // Hijack
      PokerPosition.CO    // Cutoff
    ];
    
    const relativePosition = calculateRelativePosition(heroSeatNumber, buttonSeatNumber);
    return positions[relativePosition] || PokerPosition.BTN;
  }

  /**
   * Save hand to database with error handling
   */
  private async saveHandToDatabase(hand: ParsedHand): Promise<void> {
    if (!isValidHandId(hand.handId)) {
      throw createError('Invalid hand ID', hand.handId);
    }

    // Double-check for duplicates
    const existingHand = await this.sqliteManager.getPokerHandById(hand.handId);
    if (existingHand) {
      console.log(`${LOG_EMOJIS.WARNING} Hand ${hand.handId} already exists in database, skipping...`);
      return;
    }

    const dbHand: DatabaseInsertHand = {
      hand_id: hand.handId,
      hand_start_time: hand.timestamp,
      game_type: hand.gameType,
      small_blind: hand.smallBlind,
      big_blind: hand.bigBlind,
      hero_position: hand.heroPosition,
      hero_hole_cards: hand.heroHoleCards,
      flop_cards: hand.flopCards,
      turn_card: hand.turnCard,
      river_card: hand.riverCard,
      hero_preflop_investment: hand.heroInvestments.preflop,
      hero_flop_investment: hand.heroInvestments.flop,
      hero_turn_investment: hand.heroInvestments.turn,
      hero_river_investment: hand.heroInvestments.river,
      hero_preflop_actions: hand.heroActions.preflop.join(''),
      hero_flop_actions: hand.heroActions.flop.join(''),
      hero_turn_actions: hand.heroActions.turn.join(''),
      hero_river_actions: hand.heroActions.river.join(''),
      pot_amount: hand.potAmount,
      jackpot_amount: hand.jackpotAmount,
      hero_profit: hand.heroProfit,
      hero_rake: hand.heroRake,
      hero_hand_result: hand.handResult,
      final_stage: hand.finalStage
    };

    try {
      await this.sqliteManager.insertPokerHand(dbHand);
      console.log(`${LOG_EMOJIS.SUCCESS} Successfully saved hand: ${hand.handId}`);
    } catch (error) {
      if (error instanceof Error && isUniqueConstraintError(error)) {
        console.log(`${LOG_EMOJIS.WARNING} Hand ${hand.handId} already exists (UNIQUE constraint), skipping...`);
      } else {
        throw error;
      }
    }
  }
} 