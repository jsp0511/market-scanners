import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import { runTI65Scan } from './scanners/ti65.js';

// v4 requires initializing the class
const yahooFinance = new YahooFinance();
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

  const commaSeparated = ti65Results.map(r => r.symbol).join(', ');

  // Prints directly into the "Annotations" box on your GitHub screen
  console.log(`::notice title=TI65 Tickers::${commaSeparated || 'No matches found'}`);

  // Prints a clean copy-paste block on the GitHub Summary tab
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### TI65 Bullish Tickers\n\n\`\`\`text\n${commaSeparated || 'No matches'}\n\`\`\`\n`
    );
  }

  console.log(`\nResults: ${commaSeparated}`);
}

main();
