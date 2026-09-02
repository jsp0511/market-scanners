import { calculateSMA } from '../indicators/math.js';

export function runScanners(symbol, history) {
  if (!history || history.length < 65) return { standard: null, ipo: null, trendIntensity: null };

  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  
  // Liquidity Check: minv3.1 >= 100000
  const last3Days = history.slice(-3);
  const minVol3 = Math.min(...last3Days.map(day => day.volume));
  if (minVol3 < 100000) return { standard: null, ipo: null, trendIntensity: null };

  // Price Floor: > 3
  if (latest.close <= 3) return { standard: null, ipo: null, trendIntensity: null };

  const netChange = latest.close - previous.close;
  const percentChange = ((netChange / previous.close) * 100);
  const isIPO = history.length < 252;

  let standard = null;
  let ipo = null;
  let trendIntensity = null;

  if (isIPO) {
    const minPrice252 = Math.min(...history.map(day => day.low));
    const dtRatio = latest.close / minPrice252;

    if (
      dtRatio >= 1 &&
      netChange >= -0.40 && netChange <= 0.40 &&
      percentChange >= -1.0 && percentChange <= 1.0
    ) {
      ipo = symbol;
    }
  } else {
    const sma7 = calculateSMA(history, 7);
    const sma65 = calculateSMA(history, 65);
    const tiRatio = (sma7 && sma65) ? (sma7 / sma65) : 0;

    // Pure Trend Intensity condition (avgc7/avgc65 >= 1.05)
    if (tiRatio >= 1.05) {
      trendIntensity = symbol;
    }

    // Standard Anticipation conditions (tiRatio > 1.04 plus tight daily range)
    if (
      tiRatio > 1.04 &&
      netChange >= -0.40 && netChange <= 0.40 &&
      percentChange >= -1.0 && percentChange <= 1.0
    ) {
      standard = symbol;
    }
  }

  return { standard, ipo, trendIntensity };
}
