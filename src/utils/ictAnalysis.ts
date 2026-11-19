import { INSTRUMENT_SPECS } from '../constants/instruments';
import { formatPrice } from '../services/biquoteService';
import {
  CandleBar,
  ConfluenceRule,
  DataProvider,
  FreshnessStatus,
  FvgZone,
  NormalizedQuote,
  OrderBlockZone,
  QuoteFreshness,
  SignalAnalysis,
  SignalDirection,
  StructureDetection,
  SupportedSymbol,
  TimeframeKey,
} from '../types/market';

export function calculateEMASeries(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function calculateRSI(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateATR(candles: CandleBar[], period = 14): number | null {
  if (candles.length <= period) return null;
  const ranges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    ranges.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  let atr = ranges.slice(0, period).reduce((acc, v) => acc + v, 0) / period;
  for (let i = period; i < ranges.length; i++) {
    atr = (atr * (period - 1) + ranges[i]) / period;
  }
  return atr;
}

export function detectFVG(candles: CandleBar[], symbol: SupportedSymbol, digits?: number): FvgZone {
  for (let i = candles.length - 1; i >= Math.max(2, candles.length - 30); i--) {
    const first = candles[i - 2];
    const third = candles[i];
    if (third.low > first.high) {
      return {
        type: 'BULLISH',
        top: third.low,
        bottom: first.high,
        label: `Bullish FVG ${formatPrice(first.high, symbol, digits)}–${formatPrice(third.low, symbol, digits)}`,
      };
    }
    if (third.high < first.low) {
      return {
        type: 'BEARISH',
        top: first.low,
        bottom: third.high,
        label: `Bearish FVG ${formatPrice(third.high, symbol, digits)}–${formatPrice(first.low, symbol, digits)}`,
      };
    }
  }
  return { type: 'NONE', top: 0, bottom: 0, label: 'No recent 3-bar FVG on closed bars' };
}

export function detectStructureBosChoch(
  candles: CandleBar[],
  symbol: SupportedSymbol,
  digits?: number
): StructureDetection {
  if (candles.length < 20) {
    return {
      type: 'NEUTRAL',
      kind: 'NONE',
      swingHigh: null,
      swingLow: null,
      label: 'Insufficient closed bars for structure',
    };
  }

  const swingHighs: Array<{ index: number; price: number }> = [];
  const swingLows: Array<{ index: number; price: number }> = [];
  const start = Math.max(1, candles.length - 50);

  for (let i = start; i < candles.length - 2; i++) {
    if (candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high) {
      swingHighs.push({ index: i, price: candles[i].high });
    }
    if (candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low) {
      swingLows.push({ index: i, price: candles[i].low });
    }
  }

  const recentHigh = swingHighs.length
    ? swingHighs[swingHighs.length - 1]
    : { index: candles.length - 3, price: Math.max(...candles.slice(-15, -1).map((c) => c.high)) };
  const recentLow = swingLows.length
    ? swingLows[swingLows.length - 1]
    : { index: candles.length - 3, price: Math.min(...candles.slice(-15, -1).map((c) => c.low)) };

  let priorBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const hh = swingHighs[swingHighs.length - 1].price > swingHighs[swingHighs.length - 2].price;
    const hl = swingLows[swingLows.length - 1].price > swingLows[swingLows.length - 2].price;
    const lh = swingHighs[swingHighs.length - 1].price < swingHighs[swingHighs.length - 2].price;
    const ll = swingLows[swingLows.length - 1].price < swingLows[swingLows.length - 2].price;
    if (hh && hl) priorBias = 'BULLISH';
    else if (lh && ll) priorBias = 'BEARISH';
  }

  const lastClosed = candles[candles.length - 1];
  if (lastClosed.close > recentHigh.price) {
    const kind = priorBias === 'BEARISH' ? 'CHoCH' : 'BOS';
    return {
      type: 'BULLISH',
      kind,
      swingHigh: recentHigh.price,
      swingLow: recentLow.price,
      label: `Bullish ${kind} above ${formatPrice(recentHigh.price, symbol, digits)}`,
    };
  }
  if (lastClosed.close < recentLow.price) {
    const kind = priorBias === 'BULLISH' ? 'CHoCH' : 'BOS';
    return {
      type: 'BEARISH',
      kind,
      swingHigh: recentHigh.price,
      swingLow: recentLow.price,
      label: `Bearish ${kind} below ${formatPrice(recentLow.price, symbol, digits)}`,
    };
  }

  const window5 = candles.slice(-5);
  const max5 = Math.max(...window5.map((c) => c.close));
  const min5 = Math.min(...window5.map((c) => c.close));

  if (swingHighs.length >= 2 && max5 > swingHighs[swingHighs.length - 2].price && lastClosed.close > recentLow.price) {
    const kind = priorBias === 'BEARISH' ? 'CHoCH' : 'BOS';
    return {
      type: 'BULLISH',
      kind,
      swingHigh: recentHigh.price,
      swingLow: recentLow.price,
      label: `Recent Bullish ${kind} (${formatPrice(recentLow.price, symbol, digits)}–${formatPrice(recentHigh.price, symbol, digits)})`,
    };
  }

  if (swingLows.length >= 2 && min5 < swingLows[swingLows.length - 2].price && lastClosed.close < recentHigh.price) {
    const kind = priorBias === 'BULLISH' ? 'CHoCH' : 'BOS';
    return {
      type: 'BEARISH',
      kind,
      swingHigh: recentHigh.price,
      swingLow: recentLow.price,
      label: `Recent Bearish ${kind} (${formatPrice(recentLow.price, symbol, digits)}–${formatPrice(recentHigh.price, symbol, digits)})`,
    };
  }

  return {
    type: 'NEUTRAL',
    kind: 'NONE',
    swingHigh: recentHigh.price,
    swingLow: recentLow.price,
    label: `Consolidation range ${formatPrice(recentLow.price, symbol, digits)}–${formatPrice(recentHigh.price, symbol, digits)}`,
  };
}

export function detectRuleBasedOrderBlock(
  candles: CandleBar[],
  structure: StructureDetection,
  symbol: SupportedSymbol,
  digits?: number
): OrderBlockZone {
  if (structure.type === 'NEUTRAL') {
    return { type: 'NONE', high: 0, low: 0, label: 'No confirmed BOS/CHoCH; potential OB unassigned' };
  }
  for (let i = candles.length - 2; i >= Math.max(1, candles.length - 16); i--) {
    const c = candles[i];
    const isOpposing = structure.type === 'BULLISH' ? c.close < c.open : c.close > c.open;
    if (isOpposing) {
      return {
        type: structure.type,
        high: c.high,
        low: c.low,
        label: `Rule-based potential ${structure.type === 'BULLISH' ? 'demand' : 'supply'} OB ${formatPrice(c.low, symbol, digits)}–${formatPrice(c.high, symbol, digits)}`,
      };
    }
  }
  return { type: 'NONE', high: 0, low: 0, label: 'No opposing candle before recent structural break' };
}

export function evaluateSetup(params: {
  symbol: SupportedSymbol;
  tf: TimeframeKey;
  provider: DataProvider;
  closedBars: CandleBar[];
  formingBar: CandleBar | null;
  quote: NormalizedQuote | undefined;
  freshness: QuoteFreshness;
}): SignalAnalysis {
  const { symbol, tf, provider, closedBars, formingBar, quote, freshness } = params;
  const digits = quote?.digits ?? INSTRUMENT_SPECS[symbol].defaultDigits;

  const makeEmpty = (reason: string): SignalAnalysis => ({
    asset: symbol,
    tf,
    source: provider,
    type: SignalDirection.WAIT,
    entry: null,
    tp1: null,
    tp2: null,
    sl: null,
    rrText: '—',
    confluencePassed: 0,
    confluenceTotal: 6,
    rules: [],
    ema9: null,
    ema21: null,
    ema9Series: [],
    ema21Series: [],
    rsi14: null,
    atr14: null,
    fvg: { type: 'NONE', top: 0, bottom: 0, label: reason },
    structure: { type: 'NEUTRAL', kind: 'NONE', swingHigh: null, swingLow: null, label: reason },
    ob: { type: 'NONE', high: 0, low: 0, label: reason },
    closedCount: closedBars.length,
    formingBar,
    candleTime: closedBars.length ? closedBars[closedBars.length - 1].timeMs : 0,
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    reason,
  });

  if (!closedBars || closedBars.length < 30) {
    return makeEmpty(`Insufficient closed bars (${closedBars?.length || 0}/30 required)`);
  }

  const closes = closedBars.map((c) => c.close);
  const ema9Series = calculateEMASeries(closes, 9);
  const ema21Series = calculateEMASeries(closes, 21);
  const ema9 = ema9Series[ema9Series.length - 1];
  const ema21 = ema21Series[ema21Series.length - 1];
  const rsi14 = calculateRSI(closes, 14);
  const atr14 = calculateATR(closedBars, 14);
  const fvg = detectFVG(closedBars, symbol, digits);
  const structure = detectStructureBosChoch(closedBars, symbol, digits);
  const ob = detectRuleBasedOrderBlock(closedBars, structure, symbol, digits);

  if (!freshness.available || !freshness.live || !quote) {
    const reason = !freshness.available
      ? 'DATA UNAVAILABLE — live quote missing'
      : freshness.status === FreshnessStatus.CLOSED
      ? 'MARKET CLOSED — locked to WAIT'
      : 'STALE QUOTE (>5m) — locked to WAIT';

    const out = makeEmpty(reason);
    out.ema9 = ema9;
    out.ema21 = ema21;
    out.ema9Series = ema9Series;
    out.ema21Series = ema21Series;
    out.rsi14 = rsi14;
    out.atr14 = atr14;
    out.fvg = fvg;
    out.structure = structure;
    out.ob = ob;
    out.rules = [
      { name: 'Fresh Live Feed', pass: false, detail: freshness.label },
      { name: 'EMA 9 / 21 Alignment', pass: ema9 !== ema21, detail: ema9 > ema21 ? 'Bullish' : 'Bearish' },
      { name: 'RSI(14) Neutral Band', pass: rsi14 !== null && rsi14 > 30 && rsi14 < 70, detail: rsi14 !== null ? rsi14.toFixed(1) : '—' },
      { name: 'Structure (BOS/CHoCH)', pass: structure.type !== 'NEUTRAL', detail: structure.kind },
      { name: 'Fair Value Gap', pass: fvg.type !== 'NONE', detail: fvg.type },
      { name: 'Rule-Based OB', pass: ob.type !== 'NONE', detail: ob.type },
    ];
    return out;
  }

  const bullRules: ConfluenceRule[] = [
    { name: 'Fresh Live Feed', pass: freshness.live, detail: `${freshness.ageSeconds}s` },
    { name: 'EMA 9 > EMA 21', pass: ema9 > ema21, detail: `${formatPrice(ema9, symbol, digits)} > ${formatPrice(ema21, symbol, digits)}` },
    { name: 'RSI(14) 50–70', pass: rsi14 !== null && rsi14 >= 50 && rsi14 < 70, detail: rsi14 !== null ? rsi14.toFixed(1) : '—' },
    { name: `Structure (${structure.kind})`, pass: structure.type === 'BULLISH', detail: structure.type },
    { name: 'Bullish FVG', pass: fvg.type === 'BULLISH', detail: fvg.type },
    { name: 'Rule-Based Demand OB', pass: ob.type === 'BULLISH', detail: ob.type },
  ];

  const bearRules: ConfluenceRule[] = [
    { name: 'Fresh Live Feed', pass: freshness.live, detail: `${freshness.ageSeconds}s` },
    { name: 'EMA 9 < EMA 21', pass: ema9 < ema21, detail: `${formatPrice(ema9, symbol, digits)} < ${formatPrice(ema21, symbol, digits)}` },
    { name: 'RSI(14) 30–50', pass: rsi14 !== null && rsi14 <= 50 && rsi14 > 30, detail: rsi14 !== null ? rsi14.toFixed(1) : '—' },
    { name: `Structure (${structure.kind})`, pass: structure.type === 'BEARISH', detail: structure.type },
    { name: 'Bearish FVG', pass: fvg.type === 'BEARISH', detail: fvg.type },
    { name: 'Rule-Based Supply OB', pass: ob.type === 'BEARISH', detail: ob.type },
  ];

  const bullScore = bullRules.filter((r) => r.pass).length;
  const bearScore = bearRules.filter((r) => r.pass).length;

  let type = SignalDirection.WAIT;
  let activeRules = bullScore >= bearScore ? bullRules : bearRules;
  let confluencePassed = Math.max(bullScore, bearScore);

  const bullQualified = bullScore >= 4 && bullScore > bearScore && ema9 > ema21 && structure.type === 'BULLISH';
  const bearQualified = bearScore >= 4 && bearScore > bullScore && ema9 < ema21 && structure.type === 'BEARISH';

  if (bullQualified) {
    type = SignalDirection.BUY;
    activeRules = bullRules;
    confluencePassed = bullScore;
  } else if (bearQualified) {
    type = SignalDirection.SELL;
    activeRules = bearRules;
    confluencePassed = bearScore;
  }

  let entry: number | null = null;
  let sl: number | null = null;
  let tp1: number | null = null;
  let tp2: number | null = null;
  let rrText = '—';

  if (type !== SignalDirection.WAIT && atr14 && atr14 > 0) {
    entry = type === SignalDirection.BUY ? quote.ask : quote.bid;
    const minStop = atr14 * 1.1;
    const maxStop = atr14 * 3.0;

    if (type === SignalDirection.BUY) {
      const structuralBase =
        ob.type === 'BULLISH' && ob.low < entry
          ? ob.low
          : structure.swingLow && structure.swingLow < entry
          ? structure.swingLow
          : entry - atr14 * 1.5;
      const structuralStop = structuralBase - atr14 * 0.35;
      const dist = Math.min(maxStop, Math.max(minStop, entry - structuralStop));
      sl = entry - dist;
      tp1 = entry + dist * 1.5;
      tp2 = entry + dist * 2.5;
    } else {
      const structuralBase =
        ob.type === 'BEARISH' && ob.high > entry
          ? ob.high
          : structure.swingHigh && structure.swingHigh > entry
          ? structure.swingHigh
          : entry + atr14 * 1.5;
      const structuralStop = structuralBase + atr14 * 0.35;
      const dist = Math.min(maxStop, Math.max(minStop, structuralStop - entry));
      sl = entry + dist;
      tp1 = entry - dist * 1.5;
      tp2 = entry - dist * 2.5;
    }
    rrText = '1:1.5 (TP1) / 1:2.5 (TP2)';
  }

  return {
    asset: symbol,
    tf,
    source: provider,
    type,
    entry,
    tp1,
    tp2,
    sl,
    rrText,
    confluencePassed,
    confluenceTotal: 6,
    rules: activeRules,
    ema9,
    ema21,
    ema9Series,
    ema21Series,
    rsi14,
    atr14,
    fvg,
    structure,
    ob,
    closedCount: closedBars.length,
    formingBar,
    candleTime: closedBars[closedBars.length - 1].timeMs,
    time: new Date().toLocaleTimeString('en-US', { hour12: false }),
    reason:
      type === SignalDirection.WAIT
        ? 'Confluence criteria not met — waiting for confirmation'
        : `${type} rule confluence met (${confluencePassed}/6)`,
  };
}

export function formatDistanceLabel(
  symbol: SupportedSymbol,
  distance: number,
  pointSize?: number
): string {
  const spec = INSTRUMENT_SPECS[symbol];
  const pips = distance / spec.pipSize;
  const pts = distance / (pointSize || spec.defaultPointSize);
  if (symbol === 'XAUUSD') {
    return `$${distance.toFixed(2)} (${pips.toFixed(1)} pips / ${pts.toFixed(0)} pts @ $${(pointSize || spec.defaultPointSize)})`;
  }
  return `${pips.toFixed(1)} pips (${pts.toFixed(0)} pts)`;
}
