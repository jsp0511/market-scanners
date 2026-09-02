import { calculateSMA } from '../indicators/math.js';

export function runTI65Scan(symbol, history) {
  if (!history || history.length < 65) return null;

  const sma7 = calculateSMA(history, 7);
  const sma65 = calculateSMA(history, 65);

  if (sma7 && sma65) {
    const tiRatio = sma7 / sma65;
    if (tiRatio >= 1.05) {
      return { symbol, tiRatio: tiRatio.toFixed(3) };
    }
  }
  return null;
}
