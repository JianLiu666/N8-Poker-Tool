# N8 Poker Tool

Natural8 PokerCraft 牌局紀錄解析工具

## 功能

1. **解析功能** - 將 Natural8 PokerCraft 的 log 檔案解析並儲存至 SQLite 資料庫
2. **趨勢圖** - 根據日期範圍生成趨勢圖表

## 安裝

```bash
npm install
```

## 編譯

```bash
npm run build
```

## 使用方法

### 解析 Log 檔案

```bash
# 開發模式
npm run dev parse -i /path/to/logs

# 編譯後執行
npm start parse -i /path/to/logs

# 指定資料庫路徑
npm start parse -i /path/to/logs -d /path/to/database.db
```

### 生成趨勢圖

```bash
# 開發模式
npm run dev chart

# 編譯後執行
npm start chart

# 指定日期範圍
npm start chart --start 2024-01-01 --end 2024-01-31

# 指定輸出目錄
npm start chart -o /path/to/charts
```

## 資料庫結構

### poker_sessions
- 牌局會話資訊

### poker_hands
- 單手牌局資訊

### poker_actions
- 牌局動作紀錄

## 開發

```bash
# 開發模式
npm run dev

# 測試
npm test

# 清理編譯檔案
npm run clean
```

## 注意事項

- 目前為基礎框架版本，實際解析和圖表功能將在後續版本實現
- 資料庫會自動建立在 `./data/poker.db`
- 圖表會輸出到 `./charts` 目錄 