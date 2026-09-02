import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import { runTI65Scan } from './scanners/ti65.js';

const yahooFinance = new YahooFinance();

// Helper to pause the loop so Yahoo doesn't ban the server IP
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // 1. Fetch the TC2000 Equivalent Universe (US Common Stocks via SEC)
  console.log('Fetching active US corporate tickers from the SEC...');
  
  // The SEC requires a declared User-Agent to access this JSON file
  const secResponse = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'Jerry Spallone - LoamLabs LLC' }
  });
  const secData = await secResponse.json();

  const allTickers = Object.values(secData).map(company => company.ticker);
  
  // Strip out warrants and units (which contain dashes or dots in SEC data)
  const cleanTickers = allTickers.filter(t => !t.includes('-') && !t.includes('.'));
  console.log(`Loaded ${cleanTickers.length} US Common Stocks.`);

  const ti65Results = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 110);
  const period1 = startDate.toISOString().split('T')[0];

  console.log('Starting scan (this will take roughly 8-10 minutes)...');

  for (let i = 0; i < cleanTickers.length; i++) {
    const symbol = cleanTickers[i];
    try {
      const history = await yahooFinance.historical(symbol, { period1, interval: '1d' });
      
      // 2. Stockbee Liquidity Rules
      if (history && history.length > 65) {
        const latest = history[history.length - 1];
        
        // Calculate 50-day average volume
        const volSlice = history.slice(-50);
        const avgVol = volSlice.reduce((sum, day) => sum + day.volume, 0) / 50;

        // Ensure price is over $3 and trades > 100k shares daily
        if (latest.close > 3 && avgVol > 100000) {
            const ti65Match = runTI65Scan(symbol, history);
            if (ti65Match) ti65Results.push(ti65Match);
        }
      }
    } catch (err) {
      // Suppress individual ticker errors (like delisted stocks) to keep logs clean
    }
    
    if (i > 0 && i % 500 === 0) console.log(`Scanned ${i}/${cleanTickers.length}...`);
    
    // 40ms delay between API calls to stay under Yahoo's rate limit
    await sleep(40); 
  }

  const commaSeparated = ti65Results.map(r => r.symbol).join(', ');
  
  console.log(`::notice title=TI65 Tickers::${commaSeparated || 'No matches found'}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### TI65 Bullish Tickers\n\n\`\`\`text\n${commaSeparated || 'No matches'}\n\`\`\`\n`
    );
  }

  console.log(`\nScan complete. Matches: ${ti65Results.length}`);
}

main();
