import fs from 'fs';
import yahooFinance from 'yahoo-finance2';
import { runScanners } from './scanners/anticipation.js';

async function getStockList() {
  // Pulling standard test universe or dynamic list
  // For production scale, this iterates through the market symbol pool
  return [
    'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NFLX', 'AMD', 'PLTR',
    'WLY', 'TNON', 'XE', 'KXIAY', 'PAYP', 'LMRI', 'BIII', 'VZ', 'OKE', 'PYPL', 
    'KB', 'TEVA', 'QSR', 'AMCR', 'SOLV', 'MKC', 'PAG', 'SJM', 'CSGP', 'CAG', 
    'PPC', 'KVYO', 'SXT', 'OTF', 'MRP', 'GEF', 'CON', 'PARR', 'AMLX', 'AWR', 
    'SBLK', 'NMIH', 'CWK', 'PK', 'SLS', 'URGN', 'STOK', 'ASST', 'WEN', 'SIBN', 
    'GRNT', 'STLN', 'QUAD', 'ACB', 'STRC'
  ];
}

async function run() {
  console.log("Starting Market Scanners...");
  const symbols = await getStockList();
  
  const standardSet = new Set();
  const ipoSet = new Set();
  const trendIntensitySet = new Set();

  for (const symbol of symbols) {
    try {
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
      // Suppress individual ticker network fetch errors to keep runner clean
    }
  }

  // Deduplication Priority: If a ticker appears in both Standard Anticipation and Trend Intensity, 
  // remove it from Trend Intensity so Anticipation "owns" the high-priority consolidation setup.
  for (const symbol of standardSet) {
    trendIntensitySet.delete(symbol);
  }

  const standardList = [...standardSet].sort();
  const ipoList = [...ipoSet].sort();
  const trendIntensityList = [...trendIntensitySet].sort();

  console.log("Scan complete.");
  console.log(`Standard Anticipation: ${standardList.join(', ')}`);
  console.log(`IPO Anticipation: ${ipoList.join(', ')}`);
  console.log(`Trend Intensity: ${trendIntensityList.join(', ')}`);

  // Write to GitHub Actions Job Summary
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    const markdownOutput = `
### Standard Anticipation Setups
\`\`\`text
${standardList.join(', ')}
\`\`\`

### IPO Anticipation Setups
\`\`\`text
${ipoList.join(', ')}
\`\`\`

### Trend Intensity Setups
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
