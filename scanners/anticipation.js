import { calculateSMA } from '../indicators/math.js';

function smaCloseEndingAt(history, period, endIndex) {
  const startIndex = endIndex - period + 1;
  if (startIndex < 0) return null;
  let sum = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    sum += history[i].close;
  }
  return sum / period;
}

export function runScanners(symbol, history) {
  if (!history || history.length < 5) return { standard: null, ipo: null, trendIntensity: null, young: null };
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];

  // Liquidity Check: minv3.1 >= 100000
  const last3Days = history.slice(-3);
  const minVol3 = Math.min(...last3Days.map(day => day.volume));
  if (minVol3 < 100000) return { standard: null, ipo: null, trendIntensity: null, young: null };
  // Price Floor: > 3
  if (latest.close <= 3) return { standard: null, ipo: null, trendIntensity: null, young: null };
  const netChange = latest.close - previous.close;
  const percentChange = ((netChange / previous.close) * 100);
  const isIPO = history.length < 252;
  let standard = null;
  let ipo = null;
  let trendIntensity = null;
  let young = null;
  if (isIPO) {
    // Note: Pradeep's DT column (c/minl252) is only used to sort stocks into
    // the IPO watchlist before scanning -- isIPO (history.length < 252) already
    // does that job. It is not itself a scan condition, so it's not applied here.
    if (
      netChange >= -0.40 && netChange <= 0.40 &&
      percentChange >= -1.0 && percentChange <= 1.0
    ) {
      ipo = symbol;
    }
  } else {
    if (history.length >= 65) {
      const sma7 = calculateSMA(history, 7);
      const sma65 = calculateSMA(history, 65);
      const tiRatio = (sma7 && sma65) ? (sma7 / sma65) : 0;
      // Pure Trend Intensity condition
      if (tiRatio >= 1.05) {
        trendIntensity = symbol;
      }
      // Standard Anticipation conditions
      if (
        tiRatio > 1.04 &&
        netChange >= -0.40 && netChange <= 0.40 &&
        percentChange >= -1.0 && percentChange <= 1.0
      ) {
        standard = symbol;
      }
      // Young Trend Intensity: strong now, wasn't strong 25 trading days ago
      // avgc7/avgc65 >= 1.05 AND AVGC7.25/AVGC65.25 <= 1.05 (Stockbee blog)
      const latestIndex = history.length - 1;
      const pastIndex = latestIndex - 25;
      if (tiRatio >= 1.05 && pastIndex - 64 >= 0) {
        const sma7Past = smaCloseEndingAt(history, 7, pastIndex);
        const sma65Past = smaCloseEndingAt(history, 65, pastIndex);
        if (sma7Past && sma65Past) {
          const tiRatioPast = sma7Past / sma65Past;
          if (tiRatioPast <= 1.05) {
            young = symbol;
          }
        }
      }
    }
  }
  return { standard, ipo, trendIntensity, young };
}
