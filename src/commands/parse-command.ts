import { SqliteManager } from '../database/sqlite-manager';
import { PokerHand, GameType, HandResult, FinalStage, PokerPosition } from '../database/sqlite-manager';
import path from 'path';
import fs from 'fs-extra';

export interface ParseCommandOptions {
  inputDir: string;
  dbPath?: string;
}

interface ParsedHand {
  handId: string;
  timestamp: string;
  tableName: string;
  gameType: string;
  smallBlind: number;
  bigBlind: number;
  heroPosition: string;
  heroHoleCards: string;
  flopCards: string;
  turnCard: string;
  riverCard: string;
  heroStartingChips: number;
  heroEndingChips: number;
  potAmount: number;
  jackpotAmount: number;
  heroProfit: number;
  heroRake: number;
  finalStage: string;
  handResult: string;
  heroActions: {
    preflop: string[];
    flop: string[];
    turn: string[];
    river: string[];
  };
  heroInvestments: {
    preflop: number;
    flop: number;
    turn: number;
    river: number;
  };
}

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
      console.log('🚀 Starting parse command...');
      
      // 連接資料庫
      await this.sqliteManager.connect();
      await this.sqliteManager.initializeTables();
      
      // 測試資料庫連線
      const isConnected = await this.sqliteManager.testConnection();
      if (!isConnected) {
        throw new Error('Database connection test failed');
      }

      // 解析手牌紀錄檔案
      const handLogFiles = await this.getHandLogFiles();
      console.log(`Found ${handLogFiles.length} hand log files to parse`);

      let totalHandsParsed = 0;
      let totalProfit = 0;

      for (const filePath of handLogFiles) {
        console.log(`📄 Parsing file: ${path.basename(filePath)}`);
        const { handsParsed, profit } = await this.parseHandLogFile(filePath);
        totalHandsParsed += handsParsed;
        totalProfit += profit;
        console.log(`✅ Parsed ${handsParsed} hands from ${path.basename(filePath)}, profit: ${profit.toFixed(2)}`);
      }

      console.log(`🎯 Total hands parsed: ${totalHandsParsed}`);
      console.log(`💰 Total profit: ${totalProfit.toFixed(2)}`);

      // 斷開資料庫連線
      await this.sqliteManager.disconnect();
      console.log('✅ Parse command completed successfully!');

    } catch (error) {
      console.error('❌ Parse command failed:', error);
      await this.sqliteManager.disconnect();
      throw error;
    }
  }

  private async getHandLogFiles(): Promise<string[]> {
    const inputDir = path.resolve(this.options.inputDir);
    
    if (!await fs.pathExists(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }

    const files = await fs.readdir(inputDir);
    const handLogFiles = files
      .filter(file => file.endsWith('.txt'))
      .map(file => path.join(inputDir, file));

    if (handLogFiles.length === 0) {
      throw new Error(`No .txt files found in ${inputDir}`);
    }

    return handLogFiles;
  }

  private async parseHandLogFile(filePath: string): Promise<{ handsParsed: number, profit: number }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim());
    
    const hands: ParsedHand[] = [];
    let i = 0;
    let skippedHands = 0;
    
    while (i < lines.length) {
      if (lines[i].startsWith('Poker Hand #')) {
        const hand = this.parseCompleteHand(lines, i);
        if (hand) {
          // 檢查這個手牌是否已經存在於資料庫中
          const existingHand = await this.sqliteManager.getPokerHandById(hand.hand.handId);
          if (existingHand) {
            console.log(`⏭️  Skipping already parsed hand: ${hand.hand.handId}`);
            skippedHands++;
          } else {
            hands.push(hand.hand);
          }
          i = hand.nextIndex;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    // 儲存到資料庫
    let totalProfit = 0;
    for (const hand of hands) {
      await this.saveHandToDatabase(hand);
      totalProfit += hand.heroProfit;
    }

    if (skippedHands > 0) {
      console.log(`⏭️  Skipped ${skippedHands} already parsed hands from ${path.basename(filePath)}`);
    }

    return { handsParsed: hands.length, profit: totalProfit };
  }

  private parseCompleteHand(lines: string[], startIndex: number): { hand: ParsedHand, nextIndex: number } | null {
    let i = startIndex;
    
    // 解析手牌頭部
    const handHeader = this.parseHandHeader(lines[i]);
    if (!handHeader) return null;
    
    i++;
    
    // 初始化手牌資料
    const hand: Partial<ParsedHand> = {
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
    let currentSection: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';

    // 解析手牌內容
    while (i < lines.length && !lines[i].startsWith('Poker Hand #')) {
      const line = lines[i];
      
      if (line.trim() === '') {
        i++;
        continue;
      }

      // 解析桌子資訊和 button 位置
      if (line.startsWith('Table \'')) {
        const tableMatch = line.match(/Table '([^']+)'/);
        if (tableMatch) {
          hand.tableName = tableMatch[1];
        }
        
        const buttonMatch = line.match(/Seat #(\d+) is the button/);
        if (buttonMatch) {
          buttonSeatNumber = parseInt(buttonMatch[1]);
        }
      }

      // 解析座位資訊
      else if (line.startsWith('Seat ') && line.includes('Hero')) {
        const seatMatch = line.match(/Seat (\d+): Hero \(\$([0-9.]+) in chips\)/);
        if (seatMatch) {
          heroSeatNumber = parseInt(seatMatch[1]);
          hand.heroStartingChips = parseFloat(seatMatch[2]);
        }
      }

      // 解析底牌
      else if (line.startsWith('Dealt to Hero [')) {
        const cardsMatch = line.match(/Dealt to Hero \[([^\]]+)\]/);
        if (cardsMatch) {
          hand.heroHoleCards = cardsMatch[1];
        }
      }

             // 解析階段轉換和公共牌
       else if (line.startsWith('*** FLOP ***')) {
         currentSection = 'flop';
         const flopMatch = line.match(/\[([^\]]+)\]/);
         if (flopMatch) {
           hand.flopCards = flopMatch[1];
         }
       }
       else if (line.startsWith('*** TURN ***')) {
         currentSection = 'turn';
         // TURN 行格式: *** TURN *** [8s 5s 4h] [9c] 或 *** TURN *** [8s 5s 4h 9c]
         const turnMatches = line.match(/\[([^\]]+)\]/g);
         if (turnMatches) {
           if (turnMatches.length >= 2) {
             // 有兩個方括號，第二個是 turn 牌
             hand.turnCard = turnMatches[1].replace(/[\[\]]/g, '');
           } else {
             // 只有一個方括號，包含所有牌，取第 4 張
             const cards = turnMatches[0].replace(/[\[\]]/g, '').split(' ');
             hand.turnCard = cards[3];
           }
         }
       }
       else if (line.startsWith('*** RIVER ***')) {
         currentSection = 'river';
         // RIVER 行格式: *** RIVER *** [8s 5s 4h 9c] [9h] 或 *** RIVER *** [8s 5s 4h 9c 9h]
         const riverMatches = line.match(/\[([^\]]+)\]/g);
         if (riverMatches) {
           if (riverMatches.length >= 2) {
             // 有兩個方括號，第二個是 river 牌
             hand.riverCard = riverMatches[1].replace(/[\[\]]/g, '');
           } else {
             // 只有一個方括號，包含所有牌，取第 5 張
             const cards = riverMatches[0].replace(/[\[\]]/g, '').split(' ');
             hand.riverCard = cards[4];
           }
         }
       }

      // 解析 Hero 的動作
      else if (line.includes('Hero:')) {
        this.parseHeroAction(hand, line, currentSection);
      }

      // 解析 Uncalled bet returned
      else if (line.includes('Uncalled bet') && line.includes('returned to Hero')) {
        const uncalledMatch = line.match(/Uncalled bet \(\$([0-9.]+)\) returned to Hero/);
        if (uncalledMatch) {
          const uncalledAmount = parseFloat(uncalledMatch[1]);
          hand.heroInvestments![currentSection] = Math.round((hand.heroInvestments![currentSection] - uncalledAmount) * 100) / 100;
        }
      }

      // 解析 SUMMARY 段落
      else if (line.startsWith('*** SUMMARY ***')) {
        i = this.parseSummarySection(lines, i, hand, heroSeatNumber);
        break;
      }

      i++;
    }

    // 完成手牌解析
    const finalizedHand = this.finalizeHand(hand, heroSeatNumber, buttonSeatNumber);
    return { hand: finalizedHand, nextIndex: i };
  }

  private parseHandHeader(line: string): Partial<ParsedHand> | null {
    const match = line.match(/Poker Hand #([^:]+): Hold'em No Limit \(\$([0-9.]+)\/\$([0-9.]+)\) - (.+)/);
    if (!match) return null;

    const [, handId, smallBlind, bigBlind, timestamp] = match;
    
    return {
      handId,
      smallBlind: parseFloat(smallBlind),
      bigBlind: parseFloat(bigBlind),
      timestamp,
      gameType: GameType.RUSH_AND_CASH,
      heroProfit: 0
    };
  }

  private parseHeroAction(hand: Partial<ParsedHand>, line: string, section: 'preflop' | 'flop' | 'turn' | 'river'): void {
    if (!hand.heroActions || !hand.heroInvestments) return;

    // 修正浮點數精度問題的輔助函數
    const roundToTwoDecimals = (num: number): number => Math.round(num * 100) / 100;

    // 解析盲注
    if (line.includes('posts small blind')) {
      const blindMatch = line.match(/posts small blind \$([0-9.]+)/);
      if (blindMatch) {
        hand.heroInvestments.preflop = roundToTwoDecimals(parseFloat(blindMatch[1]));
      }
      return;
    }
    
    if (line.includes('posts big blind')) {
      const blindMatch = line.match(/posts big blind \$([0-9.]+)/);
      if (blindMatch) {
        hand.heroInvestments.preflop = roundToTwoDecimals(parseFloat(blindMatch[1]));
      }
      return;
    }

    // 解析動作
    if (line.includes('folds')) {
      hand.heroActions[section].push('F');
    } else if (line.includes('checks')) {
      hand.heroActions[section].push('X');
    } else if (line.includes('calls')) {
      hand.heroActions[section].push('C');
      const callMatch = line.match(/calls \$([0-9.]+)/);
      if (callMatch) {
        hand.heroInvestments[section] = roundToTwoDecimals(
          hand.heroInvestments[section] + parseFloat(callMatch[1])
        );
      }
    } else if (line.includes('bets') && !line.includes('raises')) {
      hand.heroActions[section].push('B');
      const betMatch = line.match(/bets \$([0-9.]+)/);
      if (betMatch) {
        hand.heroInvestments[section] = roundToTwoDecimals(
          hand.heroInvestments[section] + parseFloat(betMatch[1])
        );
      }
    } else if (line.includes('raises')) {
      hand.heroActions[section].push('R');
      const raiseMatch = line.match(/raises \$[0-9.]+ to \$([0-9.]+)/);
      if (raiseMatch) {
        hand.heroInvestments[section] = roundToTwoDecimals(parseFloat(raiseMatch[1]));
      }
    }
  }

  private parseSummarySection(lines: string[], startIndex: number, hand: Partial<ParsedHand>, heroSeatNumber: number | null): number {
    let i = startIndex + 1;
    
    while (i < lines.length && !lines[i].startsWith('Poker Hand #')) {
      const line = lines[i].trim();
      
      if (line === '') {
        i++;
        continue;
      }

      // 解析 Total pot、Rake 和 Jackpot
      if (line.startsWith('Total pot')) {
        const potMatch = line.match(/Total pot \$([0-9.]+)/);
        if (potMatch) {
          hand.potAmount = parseFloat(potMatch[1]);
        }
        const rakeMatch = line.match(/Rake \$([0-9.]+)/);
        if (rakeMatch) {
          hand.heroRake = parseFloat(rakeMatch[1]);
        }
        const jackpotMatch = line.match(/Jackpot \$([0-9.]+)/);
        if (jackpotMatch) {
          hand.jackpotAmount = parseFloat(jackpotMatch[1]);
        }
      }

      // 解析 Hero 的最終結果
      if (line.includes(`Seat ${heroSeatNumber}: Hero`) && heroSeatNumber) {
        // 檢查是否贏錢
        const wonMatch = line.match(/won \(\$([0-9.]+)\)/);
        const collectedMatch = line.match(/collected \(\$([0-9.]+)\)/);
        
        if (wonMatch) {
          hand.heroProfit = parseFloat(wonMatch[1]);
        } else if (collectedMatch) {
          hand.heroProfit = parseFloat(collectedMatch[1]);
        }
        
        // 檢查是否有顯示牌
        if (line.includes('showed')) {
          hand.handResult = hand.heroProfit! > 0 ? HandResult.SHOWDOWN_WIN : HandResult.SHOWDOWN_LOSS;
        } else {
          hand.handResult = hand.heroProfit! > 0 ? HandResult.NO_SHOWDOWN_WIN : HandResult.NO_SHOWDOWN_LOSS;
        }
      }
      
      i++;
    }
    
    return i;
  }

  private finalizeHand(hand: Partial<ParsedHand>, heroSeatNumber: number | null, buttonSeatNumber: number | null): ParsedHand {
    // 修正浮點數精度問題的輔助函數
    const roundToTwoDecimals = (num: number): number => Math.round(num * 100) / 100;
    
    // 計算總投入（修正浮點數精度）
    const totalInvestment = roundToTwoDecimals(
      (hand.heroInvestments?.preflop || 0) + 
      (hand.heroInvestments?.flop || 0) + 
      (hand.heroInvestments?.turn || 0) + 
      (hand.heroInvestments?.river || 0)
    );
    
    // 重新計算 hero_profit：pot - rake - jackpot - 總投資
    const potAmount = hand.potAmount || 0;
    const jackpotAmount = hand.jackpotAmount || 0;
    const rakeAmount = hand.heroRake || 0;
    
    // 如果 Hero 贏了錢，profit = pot - rake - jackpot - 投資
    // 如果 Hero 沒贏錢，profit = -投資
    const collectedAmount = hand.heroProfit || 0; // 這是從 SUMMARY 解析出的 Hero 收到的金額
    let finalProfit: number;
    
    if (collectedAmount > 0) {
      // Hero 贏錢的情況：實際收益 = 收到的金額 - 總投資
      finalProfit = roundToTwoDecimals(collectedAmount - totalInvestment);
    } else {
      // Hero 沒贏錢的情況：損失 = -總投資
      finalProfit = roundToTwoDecimals(-totalInvestment);
    }
    
    // 確定最終階段
    let finalStage = FinalStage.PREFLOP;
    if (hand.riverCard) finalStage = FinalStage.RIVER;
    else if (hand.turnCard) finalStage = FinalStage.TURN;
    else if (hand.flopCards) finalStage = FinalStage.FLOP;
    
    if (hand.handResult === HandResult.SHOWDOWN_WIN || hand.handResult === HandResult.SHOWDOWN_LOSS) {
      finalStage = FinalStage.SHOWDOWN;
    }

    // 確定 Hero 位置
    const heroPosition = (heroSeatNumber && buttonSeatNumber) 
      ? this.determineHeroPosition(hand, heroSeatNumber, buttonSeatNumber)
      : PokerPosition.BTN;

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
      potAmount: roundToTwoDecimals(potAmount),
      jackpotAmount: roundToTwoDecimals(jackpotAmount),
      heroProfit: finalProfit,
      heroRake: roundToTwoDecimals(rakeAmount),
      finalStage,
      handResult: hand.handResult || HandResult.NO_SHOWDOWN_LOSS,
      heroActions: hand.heroActions!,
      heroInvestments: {
        preflop: roundToTwoDecimals(hand.heroInvestments?.preflop || 0),
        flop: roundToTwoDecimals(hand.heroInvestments?.flop || 0),
        turn: roundToTwoDecimals(hand.heroInvestments?.turn || 0),
        river: roundToTwoDecimals(hand.heroInvestments?.river || 0)
      }
    };
  }

  private determineHeroPosition(hand: Partial<ParsedHand>, heroSeatNumber: number, buttonSeatNumber: number): string {
    // 6人桌位置對應表
    const positions = [
      PokerPosition.BTN,  // Button
      PokerPosition.SB,   // Small Blind  
      PokerPosition.BB,   // Big Blind
      PokerPosition.UTG,  // Under The Gun
      PokerPosition.HJ,   // Hijack
      PokerPosition.CO    // Cutoff
    ];
    
    // 計算相對位置 (Hero 相對於 Button 的位置)
    let relativePosition = (heroSeatNumber - buttonSeatNumber + 6) % 6;
    
    return positions[relativePosition];
  }

  private async saveHandToDatabase(hand: ParsedHand): Promise<void> {
    // 再次檢查以確保不重複插入（雙重保護）
    const existingHand = await this.sqliteManager.getPokerHandById(hand.handId);
    if (existingHand) {
      console.log(`⚠️  Hand ${hand.handId} already exists in database, skipping...`);
      return;
    }

    const dbHand: Omit<PokerHand, 'id' | 'created_at'> = {
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
      console.log(`✅ Successfully saved hand: ${hand.handId}`);
    } catch (error) {
      // 如果是 UNIQUE constraint 錯誤，則忽略（表示已存在）
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        console.log(`⚠️  Hand ${hand.handId} already exists (UNIQUE constraint), skipping...`);
      } else {
        throw error;
      }
    }
  }
} 