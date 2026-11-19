import * as signalR from '@microsoft/signalr';
import {
  BIQUOTE_BASE_URL,
  BIQUOTE_HUB_URL,
  INSTRUMENT_SPECS,
  STALE_MAX_SECONDS,
  SUPPORTED_SYMBOLS,
  TIMEFRAME_CONFIG,
} from '../constants/instruments';
import {
  CandleBar,
  CandleDataset,
  DataProvider,
  FreshnessStatus,
  HubConnectionState,
  NormalizedQuote,
  QuoteFreshness,
  SupportedSymbol,
  TimeframeKey,
} from '../types/market';

let rateLimitUntilMs = 0;

async function safeFetch(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function biquoteFetchJson<T>(url: string): Promise<T> {
  if (Date.now() < rateLimitUntilMs) {
    const secs = Math.ceil((rateLimitUntilMs - Date.now()) / 1000);
    throw new Error(`Rate limited (HTTP 429) — retry in ${secs}s`);
  }
  const res = await safeFetch(url);
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') || '15');
    rateLimitUntilMs = Date.now() + Math.max(5, retryAfter) * 1000;
    throw new Error(`HTTP 429 Rate limit — retry in ${retryAfter}s`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (${res.statusText || 'Request failed'})`);
  }
  return (await res.json()) as T;
}

export function inferDigitsAndPoint(
  symbol: SupportedSymbol,
  sample: { bid?: unknown; ask?: unknown; mid?: unknown; spread?: unknown }
): { digits: number; pointSize: number } {
  const spec = INSTRUMENT_SPECS[symbol];
  const values = [sample.bid, sample.ask, sample.mid, sample.spread]
    .map(Number)
    .filter((n) => Number.isFinite(n));

  let maxDecimals = spec.defaultDigits;
  for (const val of values) {
    const str = String(val);
    const dot = str.indexOf('.');
    if (dot !== -1) {
      const dec = str.length - dot - 1;
      if (symbol === 'XAUUSD') {
        maxDecimals = Math.min(3, Math.max(maxDecimals, dec));
      } else if (symbol === 'USDJPY') {
        maxDecimals = Math.min(3, Math.max(maxDecimals, dec));
      } else {
        maxDecimals = Math.min(5, Math.max(maxDecimals, dec));
      }
    }
  }
  const pointSize = Number((10 ** -maxDecimals).toFixed(maxDecimals));
  return { digits: maxDecimals, pointSize };
}

export function normalizeQuote(
  symbol: SupportedSymbol,
  raw: Record<string, unknown>,
  provider: DataProvider,
  prevMid: number | null = null
): NormalizedQuote | null {
  if (!raw || typeof raw !== 'object') return null;

  const bid = Number(raw.bid);
  const ask = Number(raw.ask);
  const rawMid = Number(raw.mid);
  const mid =
    Number.isFinite(rawMid) && rawMid > 0
      ? rawMid
      : Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0
      ? (bid + ask) / 2
      : NaN;

  if (!Number.isFinite(mid) || mid <= 0) return null;

  const rawSpread = Number(raw.spread);
  const spread = Number.isFinite(rawSpread)
    ? rawSpread
    : Number.isFinite(bid) && Number.isFinite(ask)
    ? Math.abs(ask - bid)
    : 0;

  const tsString = typeof raw.timestamp === 'string' && raw.timestamp ? raw.timestamp : new Date().toISOString();
  const parsedTs = Date.parse(tsString);
  const timestampMs = Number.isFinite(parsedTs) ? parsedTs : Date.now();

  const computedAge = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  const serverAge = Number.isFinite(Number(raw.quoteAgeSeconds)) ? Number(raw.quoteAgeSeconds) : computedAge;
  const quoteAgeSeconds = Math.max(serverAge, computedAge);

  const marketState = String(raw.marketState || 'open').toLowerCase();
  const stale = Boolean(raw.stale) || quoteAgeSeconds > STALE_MAX_SECONDS;
  const { digits, pointSize } = inferDigitsAndPoint(symbol, raw);

  return {
    symbol,
    provider,
    sourceLabel: provider,
    rawSource: typeof raw.source === 'string' ? raw.source : provider,
    bid: Number.isFinite(bid) && bid > 0 ? bid : mid,
    ask: Number.isFinite(ask) && ask > 0 ? ask : mid,
    mid,
    prevMid,
    spread,
    high: Number.isFinite(Number(raw.high)) && Number(raw.high) > 0 ? Number(raw.high) : null,
    low: Number.isFinite(Number(raw.low)) && Number(raw.low) > 0 ? Number(raw.low) : null,
    dayDiffPercent:
      marketState === 'closed'
        ? null
        : Number.isFinite(Number(raw.dayDiffPercent))
        ? Number(raw.dayDiffPercent)
        : null,
    timestamp: tsString,
    timestampMs,
    marketState,
    stale,
    quoteAgeSeconds,
    digits,
    pointSize,
    receivedAtMs: Date.now(),
  };
}

export function getQuoteFreshness(
  symbol: SupportedSymbol,
  provider: DataProvider,
  quote: NormalizedQuote | undefined,
  activeSet: Set<SupportedSymbol>,
  availabilityChecked: boolean,
  nowMs: number = Date.now()
): QuoteFreshness {
  if (provider === DataProvider.EXNESS) {
    if (!quote) {
      return {
        available: false,
        live: false,
        status: FreshnessStatus.UNAVAILABLE,
        ageSeconds: Infinity,
        label: 'DATA UNAVAILABLE',
      };
    }
    const age = Math.max(0, Math.floor((nowMs - quote.receivedAtMs) / 1000));
    if (age > STALE_MAX_SECONDS) {
      return {
        available: true,
        live: false,
        status: FreshnessStatus.STALE,
        ageSeconds: age,
        label: 'STALE DATA',
      };
    }
    return {
      available: true,
      live: true,
      status: FreshnessStatus.LIVE,
      ageSeconds: age,
      label: 'LIVE',
    };
  }

  if (availabilityChecked && !activeSet.has(symbol)) {
    return {
      available: false,
      live: false,
      status: FreshnessStatus.UNAVAILABLE,
      ageSeconds: Infinity,
      label: 'UNAVAILABLE',
    };
  }

  if (!quote) {
    return {
      available: false,
      live: false,
      status: FreshnessStatus.UNAVAILABLE,
      ageSeconds: Infinity,
      label: 'DATA UNAVAILABLE',
    };
  }

  const ageSinceReceipt = Math.max(0, Math.floor((nowMs - quote.receivedAtMs) / 1000));
  const ageFromTs = quote.timestampMs ? Math.max(0, Math.floor((nowMs - quote.timestampMs) / 1000)) : ageSinceReceipt;
  const ageSeconds = Math.max(quote.quoteAgeSeconds, ageSinceReceipt, ageFromTs);
  const isClosed = quote.marketState === 'closed';
  const isStale = quote.stale || ageSeconds > STALE_MAX_SECONDS;

  if (isClosed) {
    return {
      available: true,
      live: false,
      status: FreshnessStatus.CLOSED,
      ageSeconds,
      label: 'MARKET CLOSED — LAST PRICE',
    };
  }
  if (isStale) {
    return {
      available: true,
      live: false,
      status: FreshnessStatus.STALE,
      ageSeconds,
      label: 'STALE DATA',
    };
  }
  return {
    available: true,
    live: true,
    status: FreshnessStatus.LIVE,
    ageSeconds,
    label: 'LIVE',
  };
}

export function formatPrice(value: number | null | undefined, symbol: SupportedSymbol, digits?: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const d = digits ?? INSTRUMENT_SPECS[symbol].defaultDigits;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s ago`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m ago`;
}

export function formatSpread(symbol: SupportedSymbol, spread: number, pointSize?: number): string {
  if (!Number.isFinite(spread)) return '—';
  const spec = INSTRUMENT_SPECS[symbol];
  if (symbol === 'XAUUSD') {
    const pips = spread / spec.pipSize;
    const pts = spread / (pointSize || spec.defaultPointSize);
    return `$${spread.toFixed(3)} (${pips.toFixed(1)} pips / ${pts.toFixed(0)} pts)`;
  }
  return `${(spread / spec.pipSize).toFixed(1)} pips`;
}

export async function fetchBiquoteActiveSymbols(): Promise<Set<SupportedSymbol>> {
  const data = await biquoteFetchJson<Array<{ name?: string; symbol?: string } | string>>(`${BIQUOTE_BASE_URL}/api/active`);
  const active = new Set<SupportedSymbol>();
  if (Array.isArray(data)) {
    for (const item of data) {
      const rawName = typeof item === 'string' ? item : item?.name || item?.symbol;
      const upper = rawName ? (String(rawName).toUpperCase() as SupportedSymbol) : null;
      if (upper && SUPPORTED_SYMBOLS.includes(upper)) {
        active.add(upper);
      }
    }
  }
  return active;
}

export async function fetchBiquoteLatestQuotes(
  symbols: SupportedSymbol[],
  existing: Partial<Record<SupportedSymbol, NormalizedQuote>> = {}
): Promise<Partial<Record<SupportedSymbol, NormalizedQuote>>> {
  if (!symbols.length) return {};
  const query = symbols.map((s) => `symbols=${encodeURIComponent(s)}`).join('&');
  const payload = await biquoteFetchJson<Record<string, Record<string, unknown>> | Array<Record<string, unknown>>>(
    `${BIQUOTE_BASE_URL}/api/latest?${query}`
  );

  const entries: Array<[string, Record<string, unknown>]> = Array.isArray(payload)
    ? payload.map((item) => [String(item?.symbol || '').toUpperCase(), item])
    : Object.entries(payload || {}).map(([k, v]) => [k.toUpperCase(), v]);

  const out: Partial<Record<SupportedSymbol, NormalizedQuote>> = {};
  for (const [sym, raw] of entries) {
    if (!SUPPORTED_SYMBOLS.includes(sym as SupportedSymbol)) continue;
    const typedSym = sym as SupportedSymbol;
    const prevMid = existing[typedSym]?.mid ?? null;
    const norm = normalizeQuote(typedSym, raw, DataProvider.BIQUOTE, prevMid);
    if (norm) out[typedSym] = norm;
  }
  return out;
}

export async function fetchBiquoteOhlc(symbol: SupportedSymbol, tf: TimeframeKey): Promise<CandleDataset> {
  const interval = TIMEFRAME_CONFIG[tf].biquote;
  const payload = await biquoteFetchJson<{
    symbol?: string;
    interval?: string;
    bars?: Array<Record<string, unknown>>;
  }>(`${BIQUOTE_BASE_URL}/api/${encodeURIComponent(symbol)}/ohlc?interval=${encodeURIComponent(interval)}&limit=300`);

  const rawBars = Array.isArray(payload?.bars) ? payload.bars : [];
  if (!rawBars.length) {
    throw new Error(`No OHLC bars returned for ${symbol} (${interval})`);
  }

  const parsed: CandleBar[] = rawBars
    .map((bar) => {
      const openTime = String(bar.openTime || '');
      const timeMs = Date.parse(openTime);
      return {
        openTime,
        timeMs,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume || 0),
        tickVolume: Number(bar.tickVolume || 0),
        isOpen: Boolean(bar.isOpen),
      };
    })
    .filter((b) => Number.isFinite(b.timeMs) && [b.open, b.high, b.low, b.close].every(Number.isFinite))
    .sort((a, b) => a.timeMs - b.timeMs);

  const closedBars = parsed.filter((b) => !b.isOpen);
  const openBars = parsed.filter((b) => b.isOpen);
  const formingBar = openBars.length ? openBars[openBars.length - 1] : null;

  return {
    closedBars,
    formingBar,
    fetchedAtMs: Date.now(),
  };
}

export async function fetchExnessQuote(): Promise<NormalizedQuote> {
  const res = await safeFetch('/api/quote', 2500);
  if (!res.ok) throw new Error(`EXNESS MT5 HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (!data.connected || !(Number(data.bid) > 0)) {
    throw new Error(String(data.error || 'EXNESS MT5 bridge not connected'));
  }
  const sym = (String(data.symbol || 'XAUUSD').toUpperCase() as SupportedSymbol) || 'XAUUSD';
  const norm = normalizeQuote(
    SUPPORTED_SYMBOLS.includes(sym) ? sym : 'XAUUSD',
    {
      bid: data.bid,
      ask: data.ask,
      high: data.high,
      low: data.low,
      dayDiffPercent: data.change_pct,
      timestamp: new Date().toISOString(),
      source: 'EXNESS MT5',
      marketState: 'open',
      stale: false,
      quoteAgeSeconds: 0,
    },
    DataProvider.EXNESS
  );
  if (!norm) throw new Error('Invalid EXNESS MT5 quote payload');
  return norm;
}

export async function fetchExnessCandles(symbol: SupportedSymbol, tf: TimeframeKey): Promise<CandleDataset> {
  const res = await safeFetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&limit=300`, 4000);
  if (!res.ok) throw new Error(`EXNESS MT5 HTTP ${res.status}`);
  const data = (await res.json()) as { connected?: boolean; error?: string; candles?: Array<Record<string, unknown>> };
  if (!data.connected || !Array.isArray(data.candles)) {
    throw new Error(data.error || 'EXNESS MT5 bridge not connected');
  }
  const parsed: CandleBar[] = data.candles
    .map((c) => {
      const timeMs = Number(c.time) * 1000;
      return {
        openTime: new Date(timeMs).toISOString(),
        timeMs,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
        tickVolume: 0,
        isOpen: Boolean(c.isOpen),
      };
    })
    .filter((b) => Number.isFinite(b.timeMs) && [b.open, b.high, b.low, b.close].every(Number.isFinite))
    .sort((a, b) => a.timeMs - b.timeMs);

  return {
    closedBars: parsed.filter((b) => !b.isOpen),
    formingBar: parsed.find((b) => b.isOpen) ?? null,
    fetchedAtMs: Date.now(),
  };
}

export class BiquoteSignalRClient {
  private connection: signalR.HubConnection | null = null;
  private subscribedSymbols: SupportedSymbol[] = [];
  private connectEpoch = 0;

  public async connect(
    symbols: SupportedSymbol[],
    callbacks: {
      onStateChange: (state: HubConnectionState, detail?: string) => void;
      onTick: (symbol: SupportedSymbol, rawTick: Record<string, unknown>) => void;
    }
  ): Promise<void> {
    const epoch = ++this.connectEpoch;
    await this.stopExistingConnection();
    if (epoch !== this.connectEpoch) return;

    this.subscribedSymbols = [...symbols];
    callbacks.onStateChange(HubConnectionState.CONNECTING);

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(BIQUOTE_HUB_URL, { withCredentials: false })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
      .configureLogging(signalR.LogLevel.None)
      .build();

    conn.on('ReceiveTick', (tick: Record<string, unknown>) => {
      if (epoch !== this.connectEpoch) return;
      if (!tick || typeof tick !== 'object') return;
      const sym = String(tick.symbol || '').toUpperCase() as SupportedSymbol;
      if (SUPPORTED_SYMBOLS.includes(sym)) {
        callbacks.onTick(sym, tick);
      }
    });

    conn.onreconnecting((err) => {
      if (epoch !== this.connectEpoch) return;
      callbacks.onStateChange(HubConnectionState.RECONNECTING, err?.message);
    });

    conn.onreconnected(async () => {
      if (epoch !== this.connectEpoch) return;
      callbacks.onStateChange(HubConnectionState.CONNECTED);
      await this.subscribe(this.subscribedSymbols);
    });

    conn.onclose((err) => {
      if (epoch !== this.connectEpoch) return;
      callbacks.onStateChange(HubConnectionState.DISCONNECTED, err?.message);
    });

    this.connection = conn;

    try {
      await conn.start();
      if (epoch !== this.connectEpoch) {
        await conn.stop().catch(() => {});
        return;
      }
      callbacks.onStateChange(HubConnectionState.CONNECTED);
      await this.subscribe(this.subscribedSymbols);
    } catch (err) {
      if (epoch !== this.connectEpoch) return;
      const message = err instanceof Error ? err.message : 'SignalR connection failed';
      callbacks.onStateChange(HubConnectionState.ERROR, message);
      throw err;
    }
  }

  public async subscribe(symbols: SupportedSymbol[]): Promise<void> {
    this.subscribedSymbols = [...symbols];
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected || !symbols.length) {
      return;
    }
    await this.connection.invoke('Subscribe', symbols);
  }

  public getState(): HubConnectionState {
    if (!this.connection) return HubConnectionState.DISCONNECTED;
    switch (this.connection.state) {
      case signalR.HubConnectionState.Connected:
        return HubConnectionState.CONNECTED;
      case signalR.HubConnectionState.Connecting:
        return HubConnectionState.CONNECTING;
      case signalR.HubConnectionState.Reconnecting:
        return HubConnectionState.RECONNECTING;
      default:
        return HubConnectionState.DISCONNECTED;
    }
  }

  private async stopExistingConnection(): Promise<void> {
    if (this.connection) {
      const old = this.connection;
      this.connection = null;
      try {
        await old.stop();
      } catch {
        // Ignore stop errors during cleanup
      }
    }
  }

  public async disconnect(): Promise<void> {
    this.connectEpoch++;
    await this.stopExistingConnection();
  }
}
