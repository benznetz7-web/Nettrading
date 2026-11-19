export enum DataProvider {
  BIQUOTE = 'BIQUOTE',
  EXNESS = 'EXNESS',
}

export enum HubConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

export enum FreshnessStatus {
  LIVE = 'LIVE',
  CLOSED = 'CLOSED',
  STALE = 'STALE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export enum SignalDirection {
  BUY = 'BUY',
  SELL = 'SELL',
  WAIT = 'WAIT',
}

export type LanguageCode = 'en' | 'kh';

export type SupportedSymbol =
  | 'XAUUSD'
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'AUDUSD'
  | 'USDCAD'
  | 'USDCHF'
  | 'NZDUSD';

export type TimeframeKey = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export interface InstrumentSpec {
  symbol: SupportedSymbol;
  group: 'GOLD' | 'FX';
  label: string;
  defaultDigits: number;
  pipSize: number;
  defaultPointSize: number;
  pipNote: string;
}

export interface NormalizedQuote {
  symbol: SupportedSymbol;
  provider: DataProvider;
  sourceLabel: string;
  rawSource: string;
  bid: number;
  ask: number;
  mid: number;
  prevMid: number | null;
  spread: number;
  high: number | null;
  low: number | null;
  dayDiffPercent: number | null;
  timestamp: string;
  timestampMs: number;
  marketState: 'open' | 'closed' | string;
  stale: boolean;
  quoteAgeSeconds: number;
  digits: number;
  pointSize: number;
  receivedAtMs: number;
}

export interface QuoteFreshness {
  available: boolean;
  live: boolean;
  status: FreshnessStatus;
  ageSeconds: number;
  label: string;
}

export interface CandleBar {
  openTime: string;
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickVolume: number;
  isOpen: boolean;
}

export interface CandleDataset {
  closedBars: CandleBar[];
  formingBar: CandleBar | null;
  fetchedAtMs: number;
}

export interface FvgZone {
  type: 'BULLISH' | 'BEARISH' | 'NONE';
  top: number;
  bottom: number;
  label: string;
}

export interface StructureDetection {
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  kind: 'BOS' | 'CHoCH' | 'NONE';
  swingHigh: number | null;
  swingLow: number | null;
  label: string;
}

export interface OrderBlockZone {
  type: 'BULLISH' | 'BEARISH' | 'NONE';
  high: number;
  low: number;
  label: string;
}

export interface ConfluenceRule {
  name: string;
  pass: boolean;
  detail: string;
}

export interface SignalAnalysis {
  asset: SupportedSymbol;
  tf: TimeframeKey;
  source: DataProvider;
  type: SignalDirection;
  entry: number | null;
  tp1: number | null;
  tp2: number | null;
  sl: number | null;
  rrText: string;
  confluencePassed: number;
  confluenceTotal: number;
  rules: ConfluenceRule[];
  ema9: number | null;
  ema21: number | null;
  ema9Series: number[];
  ema21Series: number[];
  rsi14: number | null;
  atr14: number | null;
  fvg: FvgZone;
  structure: StructureDetection;
  ob: OrderBlockZone;
  closedCount: number;
  formingBar: CandleBar | null;
  candleTime: number;
  time: string;
  reason: string;
}

export interface HistoryEntry {
  id: string;
  time: string;
  date: string;
  asset: SupportedSymbol;
  tf: string;
  source: DataProvider;
  type: SignalDirection.BUY | SignalDirection.SELL;
  entry: string;
  tp1: string;
  sl: string;
  status: string;
}
