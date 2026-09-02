import fs from 'fs';
import path from 'path';
import YahooFinance from 'yahoo-finance2';
import { runAnticipationScans } from './scanners/anticipation.js';

const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('Fetching active US Common Stocks & ADRs from the SEC...');
  
  const secResponse = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'Jerry Spallone jsp0511@gmail.com' }
  });
  const secData = await secResponse.json();

  const allTickers = Object.values(secData).map(company => company.ticker);
  const cleanTickers = allTickers.filter(t => !t.includes('-') && !t.includes('.'));
  
  console.log(`Loaded ${cleanTickers.length} tickers. Starting anticipation scan...`);

  const standardResults = [];
  const ipoResults = [];
  
  const period1 = new Date();
  period1.setDate(period1.getDate() - 380); 

  for (let i = 0; i < cleanTickers.length; i++) {
    const symbol = cleanTickers[i];
    try {
      // Use native v4 chart() method to fetch clean daily quotes without legacy warnings
      const queryOptions = { period1, interval: '1d' };
      const result = await yahooFinance.chart(symbol, queryOptions);
      
      if (result && result.quotes) {
        // Map chart quotes to match historical object layout expected by the scanner
        const history = result.quotes.map(q => ({
          date: q.date,
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume
        }));

        const { standard, ipo } = runAnticipationScans(symbol, history);
        if (standard) standardResults.push(standard);
        if (ipo) ipoResults.push(ipo);
      }
    } catch (err) {
      // Suppress individual delisted or network errors
    }
    
    if (i > 0 && i % 500 === 0) console.log(`Scanned ${i}/${cleanTickers.length}...`);
    await sleep(40); 
  }

  const standardString = standardResults.join(', ');
  const ipoString = ipoResults.join(', ');

  console.log(`::notice title=Standard Anticipation Tickers::${standardString || 'No matches'}`);
  console.log(`::notice title=IPO Anticipation Tickers::${ipoString || 'No matches'}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Standard Anticipation Setups\n\n\`\`\`text\n${standardString || 'No matches'}\n\`\`\`\n\n` +
      `### IPO Anticipation Setups\n\n\`\`\`text\n${ipoString || 'No matches'}\n\`\`\`\n`
    );
  }

  console.log(`\nScan complete. Standard Matches: ${standardResults.length} | IPO Matches: ${ipoResults.length}`);
}

main();
