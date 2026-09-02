import fs from 'fs';
import yahooFinance from 'yahoo-finance2';
import { runScanners } from './scanners/anticipation.js';

async function getStockList() {
  return [
    'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NFLX', 'AMD', 'PLTR',
    'AVGO', 'COST', 'PEP', 'ADBE', 'LIN', 'TMO', 'CSCO', 'ACN', 'ABT', 'DHR',
    'VZ', 'DIS', 'CMCSA', 'INTC', 'OKE', 'PYPL', 'KB', 'TEVA', 
    'QSR', 'AMCR', 'SOLV', 'MKC', 'PAG', 'SJM', 'CSGP', 'CAG', 'PPC', 'KVYO', 
    'SXT', 'OTF', 'MRP', 'GEF', 'CON', 'PARR', 'AMLX', 'AWR', 'SBLK', 'NMIH', 
    'CWK', 'PK', 'SLS', 'URGN', 'STOK', 'ASST', 'WEN', 'SIBN', 'GRNT', 'STLN', 
    'QUAD', 'ACB', 'STRC', 'KXIAY', 'PAYP', 'XE', 'LMRI', 'BIII', 'HSBC', 'MUFG',
    'T', 'PFE', 'BMY', 'ING', 'ET', 'NWG', 'WBD', 'NU', 'AJG', 'ALL', 'HLN', 'BSBR',
    'HMC', 'VOD', 'ALC', 'NMR', 'FTI', 'VRSN', 'BNTX', 'INSM', 'ROIV', 'BRO', 'CIB',
    'GIS', 'THC', 'LYB', 'GMAB', 'MDLN', 'ANDG', 'IOND', 'LFTO', 'LIME', 'AERO', 
    'LBRX', 'APC', 'AKTS', 'SPTX', 'ODTX', 'NHP', 'FSSL', 'REF', 'RVI', 'OFRM', 
    'HMH', 'PSUS', 'SATA'
  ];
}

async function run() {
  console.log("Starting Market Scanners...");
  const symbols = await getStockList();
  console.log(`Evaluating ${symbols.length} symbols...`);
  
  const standardSet = new Set();
  const ipoSet = new Set();
  const trendIntensitySet = new Set();

  for (const symbol of symbols) {
    try {
      const queryOptions = { period1: '2024-01-01', interval: '1d' };
      const result = await yahooFinance.chart(symbol, queryOptions);
      
      if (!result || !result.quotes || result.quotes.length === 0) {
        console.log(`[Skip] No data for ${symbol}`);
        continue;
      }
      
      const history = result.quotes.map(q => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume
      }));

      const scanResult = runScanners(symbol, history);
      if (scanResult.standard) {
        console.log(`[Match: Standard] ${symbol}`);
        standardSet.add(scanResult.standard);
      }
      if (scanResult.ipo) {
        console.log(`[Match: IPO] ${symbol}`);
        ipoSet.add(scanResult.ipo);
      }
      if (scanResult.trendIntensity) {
        console.log(`[Match: Trend Intensity] ${symbol}`);
        trendIntensitySet.add(scanResult.trendIntensity);
      }

    } catch (err) {
      console.log(`[Error] Failed processing ${symbol}: ${err.message}`);
    }
  }

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
