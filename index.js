import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import { runTI65Scan } from './scanners/ti65.js';

const TICKERS = JSON.parse(fs.readFileSync(path.join('data', 'tickers.json'), 'utf-8'));

async function main() {
  const ti65Results = [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 110);
  const period1 = startDate.toISOString().split('T')[0];

  console.log(`Starting scan across ${TICKERS.length} symbols...`);

  for (const symbol of TICKERS) {
    try {
      const history = await yahooFinance.historical(symbol, { period1, interval: '1d' });
      const ti65Match = runTI65Scan(symbol, history);
      if (ti65Match) ti65Results.push(ti65Match);
    } catch (err) {
      console.warn(`Error scanning ${symbol}:`, err.message);
    }
  }

  const csvHeader = 'Symbol,TI65_Ratio\n';
  const csvRows = ti65Results.map(r => `${r.symbol},${r.tiRatio}`).join('\n');
  fs.writeFileSync(path.join('exports', 'ti65_bullish.csv'), csvHeader + csvRows);

  console.log(`Scan finished. ${ti65Results.length} matches written to exports/ti65_bullish.csv`);
}

main();
