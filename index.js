import fs from 'fs';
import YahooFinance from 'yahoo-finance2';
import { runScanners } from './scanners/anticipation.js';

const yahooFinance = new YahooFinance();

async function getStockList() {
  console.log("Fetching full market symbol directory...");
  const response = await fetch('https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt');
  const text = await response.text();
  const symbols = text.split('\n')
    .map(s => s.trim().toUpperCase())
    .filter(s => s && /^[A-Z]+$/.test(s));
  
  console.log(`Loaded ${symbols.length} symbols from full market exchange directory.`);
  return symbols;
}

async function run() {
  console.log("Starting Full Market Scanners...");
  const symbols = await getStockList();
  
  const standardSet = new Set();
  const ipoSet = new Set();
  const trendIntensitySet = new Set();
  let processedCount = 0;

  for (const symbol of symbols) {
    try {
      processedCount++;
      if (processedCount % 250 === 0) {
        console.log(`Progress: Evaluated ${processedCount}/${symbols.length} symbols...`);
      }

      const queryOptions = { period1: '2024-01-01', interval: '1d' };
      const result = await yahooFinance.chart(symbol, queryOptions);
      
      if (!result || !result.quotes || result.quotes.length === 0) continue;
      
      const history = result.quotes.map(q => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume
      }));

      const scanResult = runScanners(symbol, history);
      if (scanResult.standard) standardSet.add(scanResult.standard);
      if (scanResult.ipo) ipoSet.add(scanResult.ipo);
      if (scanResult.trendIntensity) trendIntensitySet.add(scanResult.trendIntensity);

    } catch (err) {
      // Suppress individual ticker network/rate-limit fetch errors to keep runner clean
    }
  }

  // Deduplication Priority: Standard Anticipation takes precedence over Trend Intensity
  for (const symbol of standardSet) {
    trendIntensitySet.delete(symbol);
  }

  const standardList = [...standardSet].sort();
  const ipoList = [...ipoSet].sort();
  const trendIntensityList = [...trendIntensitySet].sort();

  console.log("Scan complete.");
  console.log(`Standard Anticipation matches: ${standardList.length}`);
  console.log(`IPO Anticipation matches: ${ipoList.length}`);
  console.log(`Trend Intensity matches: ${trendIntensityList.length}`);

  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const markdownOutput = `
### Standard Anticipation Setups (${standardList.length})
\`\`\`text
${standardList.join(', ')}
\`\`\`

### IPO Anticipation Setups (${ipoList.length})
\`\`\`text
${ipoList.join(', ')}
\`\`\`

### Trend Intensity Setups (${trendIntensityList.length})
\`\`\`text
${trendIntensityList.join(', ')}
\`\`\`
`;
    fs.writeFileSync(summaryFile, markdownOutput);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
