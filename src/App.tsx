import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { CandlestickChart } from './components/CandlestickChart';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { Header } from './components/Header';
import { SignalCard } from './components/SignalCard';
import { SignalHistoryPanel } from './components/SignalHistoryPanel';
import { TickerStrip } from './components/TickerStrip';
import { Watchlists } from './components/Watchlists';
import {
  INSTRUMENT_SPECS,
  STORAGE_KEYS,
  SUPPORTED_SYMBOLS,
  TIMEFRAME_CONFIG,
  TIMEFRAME_ORDER,
  TRANSLATIONS,
} from './constants/instruments';
import {
  BiquoteSignalRClient,
  fetchBiquoteActiveSymbols,
  fetchBiquoteLatestQuotes,
  fetchBiquoteOhlc,
  fetchExnessCandles,
  fetchExnessQuote,
  formatAge,
  formatPrice,
  getQuoteFreshness,
  normalizeQuote,
} from './services/biquoteService';
import {
  CandleBar,
  CandleDataset,
  DataProvider,
  HistoryEntry,
  HubConnectionState,
  LanguageCode,
  NormalizedQuote,
  SignalAnalysis,
  SignalDirection,
  SupportedSymbol,
  TimeframeKey,
} from './types/market';
import { evaluateSetup } from './utils/ictAnalysis';

function loadInitialSymbol(): SupportedSymbol {
  const saved = localStorage.getItem(STORAGE_KEYS.symbol);
  if (saved && SUPPORTED_SYMBOLS.includes(saved as SupportedSymbol)) {
    return saved as SupportedSymbol;
  }
  return 'XAUUSD';
}

function loadInitialLanguage(): LanguageCode {
  return localStorage.getItem(STORAGE_KEYS.language) === 'kh' ? 'kh' : 'en';
}

function loadInitialHistory(): HistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (x): x is HistoryEntry =>
          Boolean(x) &&
          (x.type === SignalDirection.BUY || x.type === SignalDirection.SELL) &&
          Boolean(x.asset)
      )
      .slice(0, 60);
  } catch {
    return [];
  }
}

function playReminderTone() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [587.33, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.16;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Audio playback blocked by browser autoplay policy
  }
}

export default function App() {
  const [language, setLanguage] = useState<LanguageCode>(loadInitialLanguage);
  const [provider, setProvider] = useState<DataProvider>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.provider);
    return saved === DataProvider.EXNESS ? DataProvider.EXNESS : DataProvider.BIQUOTE;
  });
  const [activeSymbol, setActiveSymbol] = useState<SupportedSymbol>(loadInitialSymbol);
  const [timeframe, setTimeframe] = useState<TimeframeKey>('M5');
  const [alertEnabled, setAlertEnabled] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEYS.alerts) !== 'false'
  );

  const [statusMessage, setStatusMessage] = useState<string>('Connecting to BIQUOTE…');
  const [statusTone, setStatusTone] = useState<'ok' | 'warn' | 'err'>('warn');
  const [hubState, setHubState] = useState<HubConnectionState>(HubConnectionState.DISCONNECTED);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [activeSymbolsSet, setActiveSymbolsSet] = useState<Set<SupportedSymbol>>(new Set());
  const [availabilityChecked, setAvailabilityChecked] = useState<boolean>(false);
  const [quotes, setQuotes] = useState<Partial<Record<SupportedSymbol, NormalizedQuote>>>({});
  const [candleCache, setCandleCache] = useState<Record<string, CandleDataset>>({});
  const [candleError, setCandleError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(loadInitialHistory);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const signalRRef = useRef<BiquoteSignalRClient | null>(null);
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;

  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;

  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const alertEnabledRef = useRef(alertEnabled);
  alertEnabledRef.current = alertEnabled;

  const activeSymbolsRef = useRef(activeSymbolsSet);
  activeSymbolsRef.current = activeSymbolsSet;

  const availabilityCheckedRef = useRef(availabilityChecked);
  availabilityCheckedRef.current = availabilityChecked;

  const lastLoggedBarRef = useRef<string | null>(null);
  const lastBucketRef = useRef<number>(Math.floor(Date.now() / 1000 / TIMEFRAME_CONFIG[timeframe].seconds));

  const t = TRANSLATIONS[language];

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const getFreshness = useCallback(
    (sym: SupportedSymbol) =>
      getQuoteFreshness(
        sym,
        provider,
        quotes[sym],
        activeSymbolsSet,
        availabilityChecked,
        nowMs
      ),
    [provider, quotes, activeSymbolsSet, availabilityChecked, nowMs]
  );

  const loadCandlesFor = useCallback(
    async (
      targetProvider: DataProvider,
      sym: SupportedSymbol,
      tf: TimeframeKey,
      allowHistoryLog: boolean
    ) => {
      const key = `${targetProvider}:${sym}:${tf}`;
      try {
        if (
          targetProvider === DataProvider.BIQUOTE &&
          availabilityCheckedRef.current &&
          !activeSymbolsRef.current.has(sym)
        ) {
          setCandleError(`${sym} is currently unavailable on Biquote (/api/active)`);
          return;
        }
        setCandleError(null);
        const dataset =
          targetProvider === DataProvider.BIQUOTE
            ? await fetchBiquoteOhlc(sym, tf)
            : await fetchExnessCandles(sym, tf);

        setCandleCache((prev) => ({ ...prev, [key]: dataset }));

        if (allowHistoryLog && dataset.closedBars.length >= 30) {
          const lastBar = dataset.closedBars[dataset.closedBars.length - 1];
          const barKey = `${targetProvider}:${sym}:${tf}:${lastBar.timeMs}`;
          if (lastLoggedBarRef.current !== barKey) {
            lastLoggedBarRef.current = barKey;
            const q = quotesRef.current[sym];
            const fresh = getQuoteFreshness(
              sym,
              targetProvider,
              q,
              activeSymbolsRef.current,
              availabilityCheckedRef.current,
              Date.now()
            );
            const sig = evaluateSetup({
              symbol: sym,
              tf,
              provider: targetProvider,
              closedBars: dataset.closedBars,
              formingBar: dataset.formingBar,
              quote: q,
              freshness: fresh,
            });
            if (
              (sig.type === SignalDirection.BUY || sig.type === SignalDirection.SELL) &&
              sig.entry !== null &&
              sig.tp1 !== null &&
              sig.sl !== null
            ) {
              const digits = q?.digits ?? INSTRUMENT_SPECS[sym].defaultDigits;
              const entryItem: HistoryEntry = {
                id: `${barKey}:${Date.now()}`,
                time: sig.time,
                date: new Date(lastBar.timeMs).toLocaleDateString(),
                asset: sym,
                tf: TIMEFRAME_CONFIG[tf].label,
                source: targetProvider,
                type: sig.type,
                entry: formatPrice(sig.entry, sym, digits),
                tp1: formatPrice(sig.tp1, sym, digits),
                sl: formatPrice(sig.sl, sym, digits),
                status: `${sig.confluencePassed}/${sig.confluenceTotal}`,
              };
              setHistory((prev) => {
                const updated = [entryItem, ...prev].slice(0, 60);
                try {
                  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(updated));
                } catch {
                  // Ignore storage quota issues
                }
                return updated;
              });
              if (alertEnabledRef.current) playReminderTone();
              showToast(`${sym} ${TIMEFRAME_CONFIG[tf].label} ${sig.type} @ ${entryItem.entry}`);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to fetch OHLC data';
        setCandleError(msg);
      }
    },
    [showToast]
  );

  const startBiquote = useCallback(
    async (isCancelled?: () => boolean) => {
      setStatusMessage('Checking BIQUOTE active symbols…');
      setStatusTone('warn');

      let activeSet = new Set<SupportedSymbol>(SUPPORTED_SYMBOLS);
      try {
        activeSet = await fetchBiquoteActiveSymbols();
        if (isCancelled?.()) return;
        activeSymbolsRef.current = activeSet;
        availabilityCheckedRef.current = true;
        setActiveSymbolsSet(activeSet);
        setAvailabilityChecked(true);
      } catch (err) {
        if (isCancelled?.()) return;
        availabilityCheckedRef.current = false;
        setAvailabilityChecked(false);
        console.warn('Biquote /api/active failed:', err);
      }

      const activeList = SUPPORTED_SYMBOLS.filter((s) => activeSet.has(s));
      try {
        const latest = await fetchBiquoteLatestQuotes(
          activeList.length ? activeList : SUPPORTED_SYMBOLS,
          quotesRef.current
        );
        if (isCancelled?.()) return;
        setQuotes((prev) => ({ ...prev, ...latest }));
      } catch (err) {
        if (isCancelled?.()) return;
        setStatusMessage(`DATA UNAVAILABLE — ${err instanceof Error ? err.message : 'Snapshot failed'}`);
        setStatusTone('err');
      }

      if (isCancelled?.()) return;

      if (!signalRRef.current) {
        signalRRef.current = new BiquoteSignalRClient();
      }

      try {
        await signalRRef.current.connect(activeList.length ? activeList : SUPPORTED_SYMBOLS, {
          onStateChange: (state, detail) => {
            if (isCancelled?.()) return;
            setHubState(state);
            if (state === HubConnectionState.CONNECTED) {
              setStatusMessage('BIQUOTE SignalR connected · Live ticks');
              setStatusTone('ok');
            } else if (state === HubConnectionState.RECONNECTING) {
              setStatusMessage(`BIQUOTE reconnecting…${detail ? ` (${detail})` : ''}`);
              setStatusTone('warn');
            } else if (state === HubConnectionState.CONNECTING) {
              setStatusMessage('Connecting to BIQUOTE SignalR…');
              setStatusTone('warn');
            } else {
              setStatusMessage('SignalR disconnected — snapshot polling');
              setStatusTone('warn');
            }
          },
          onTick: (sym, rawTick) => {
            if (providerRef.current !== DataProvider.BIQUOTE || isCancelled?.()) return;
            setQuotes((prev) => {
              const prevMid = prev[sym]?.mid ?? null;
              const norm = normalizeQuote(sym, rawTick, DataProvider.BIQUOTE, prevMid);
              if (!norm) return prev;
              return { ...prev, [sym]: norm };
            });

            if (sym === activeSymbolRef.current) {
              const mid = Number(rawTick.mid) || (Number(rawTick.bid) + Number(rawTick.ask)) / 2;
              if (Number.isFinite(mid) && mid > 0) {
                const key = `${DataProvider.BIQUOTE}:${sym}:${timeframeRef.current}`;
                setCandleCache((prev) => {
                  const ds = prev[key];
                  if (!ds || !ds.formingBar) return prev;
                  const fb = ds.formingBar;
                  return {
                    ...prev,
                    [key]: {
                      ...ds,
                      formingBar: {
                        ...fb,
                        close: mid,
                        high: Math.max(fb.high, mid),
                        low: Math.min(fb.low, mid),
                      },
                    },
                  };
                });
              }
            }
          },
        });
      } catch (err) {
        if (isCancelled?.()) return;
        setStatusMessage(
          `SignalR failed (${err instanceof Error ? err.message : 'Network error'}) — REST snapshot active`
        );
        setStatusTone('warn');
      }
    },
    []
  );

  const checkExnessOnce = useCallback(async () => {
    try {
      const q = await fetchExnessQuote();
      setQuotes((prev) => ({ ...prev, [q.symbol]: q }));
      setStatusMessage(`EXNESS MT5 connected (${q.symbol})`);
      setStatusTone('ok');
      await loadCandlesFor(DataProvider.EXNESS, activeSymbolRef.current, timeframeRef.current, false);
    } catch {
      setStatusMessage('EXNESS MT5 unavailable — local bridge not connected');
      setStatusTone('err');
      setCandleError('EXNESS MT5 bridge not connected');
    }
  }, [loadCandlesFor]);

  // Provider initialization & switching
  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;

    const init = async () => {
      setQuotes({});
      setCandleError(null);
      if (provider === DataProvider.BIQUOTE) {
        await startBiquote(() => cancelled);
        if (cancelled) return;
        pollTimer = window.setInterval(async () => {
          if (providerRef.current !== DataProvider.BIQUOTE) return;
          const state = signalRRef.current?.getState();
          if (state !== HubConnectionState.CONNECTED) {
            try {
              const latest = await fetchBiquoteLatestQuotes(SUPPORTED_SYMBOLS, quotesRef.current);
              setQuotes((prev) => ({ ...prev, ...latest }));
            } catch {
              // Keep existing status error
            }
          }
        }, 15000);
      } else {
        if (signalRRef.current) {
          await signalRRef.current.disconnect();
        }
        if (cancelled) return;
        setHubState(HubConnectionState.DISCONNECTED);
        await checkExnessOnce();
        if (cancelled) return;
        pollTimer = window.setInterval(checkExnessOnce, 3000);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (pollTimer !== null) clearInterval(pollTimer);
      signalRRef.current?.disconnect();
    };
  }, [provider, startBiquote, checkExnessOnce]);

  // Refetch candles when active symbol, timeframe, or provider changes
  useEffect(() => {
    lastBucketRef.current = Math.floor(Date.now() / 1000 / TIMEFRAME_CONFIG[timeframe].seconds);
    loadCandlesFor(provider, activeSymbol, timeframe, false);
  }, [provider, activeSymbol, timeframe, loadCandlesFor]);

  // 1s master clock: UTC clock, quote age refresh, candle close trigger, 20m reminder
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);

      const tfSecs = TIMEFRAME_CONFIG[timeframeRef.current].seconds;
      const bucket = Math.floor(now / 1000 / tfSecs);
      if (bucket !== lastBucketRef.current) {
        lastBucketRef.current = bucket;
        window.setTimeout(() => {
          loadCandlesFor(providerRef.current, activeSymbolRef.current, timeframeRef.current, true);
        }, 1800);
      }

      const d = new Date(now);
      if (d.getMinutes() % 20 === 0 && d.getSeconds() === 0 && alertEnabledRef.current) {
        playReminderTone();
        showToast('20-minute reminder: check quote freshness & closed-candle setups');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [loadCandlesFor, showToast]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (provider === DataProvider.BIQUOTE) {
        const activeSet = await fetchBiquoteActiveSymbols().catch(() => new Set<SupportedSymbol>(SUPPORTED_SYMBOLS));
        setActiveSymbolsSet(activeSet);
        setAvailabilityChecked(true);
        const list = SUPPORTED_SYMBOLS.filter((s) => activeSet.has(s));
        const latest = await fetchBiquoteLatestQuotes(list.length ? list : SUPPORTED_SYMBOLS, quotesRef.current);
        setQuotes((prev) => ({ ...prev, ...latest }));
        if (signalRRef.current?.getState() !== HubConnectionState.CONNECTED) {
          await startBiquote();
        } else {
          await loadCandlesFor(DataProvider.BIQUOTE, activeSymbol, timeframe, false);
        }
        showToast('Biquote market data refreshed');
      } else {
        await checkExnessOnce();
        showToast('Exness MT5 bridge checked');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Refresh failed';
      setStatusMessage(`Refresh error: ${msg}`);
      setStatusTone('err');
      showToast(`Refresh failed: ${msg}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProviderChange = (next: DataProvider) => {
    if (next === provider) return;
    localStorage.setItem(STORAGE_KEYS.provider, next);
    setProvider(next);
  };

  const handleSelectSymbol = (sym: SupportedSymbol) => {
    localStorage.setItem(STORAGE_KEYS.symbol, sym);
    setActiveSymbol(sym);
  };

  const handleLanguageChange = (lang: LanguageCode) => {
    localStorage.setItem(STORAGE_KEYS.language, lang);
    setLanguage(lang);
  };

  const handleToggleAlert = () => {
    const next = !alertEnabled;
    localStorage.setItem(STORAGE_KEYS.alerts, String(next));
    setAlertEnabled(next);
    showToast(next ? '20m reminder enabled' : '20m reminder muted');
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEYS.history);
    showToast('Saved signal history cleared');
  };

  const activeCacheKey = `${provider}:${activeSymbol}:${timeframe}`;
  const activeDataset = candleCache[activeCacheKey];
  const closedBars: CandleBar[] = activeDataset?.closedBars ?? [];
  const formingBar: CandleBar | null = activeDataset?.formingBar ?? null;

  const activeQuote = quotes[activeSymbol];
  const activeFreshness = getFreshness(activeSymbol);

  const currentSignal: SignalAnalysis = useMemo(
    () =>
      evaluateSetup({
        symbol: activeSymbol,
        tf: timeframe,
        provider,
        closedBars,
        formingBar,
        quote: activeQuote,
        freshness: activeFreshness,
      }),
    [activeSymbol, timeframe, provider, closedBars, formingBar, activeQuote, activeFreshness]
  );

  const handleCopySignal = () => {
    const s = currentSignal;
    const digits = activeQuote?.digits ?? INSTRUMENT_SPECS[activeSymbol].defaultDigits;
    const lines = [
      'NETHAGA PRO — MARKET ANALYSIS',
      `Provider: ${s.source}`,
      `Instrument: ${s.asset}`,
      `Timeframe: ${TIMEFRAME_CONFIG[s.tf].label}`,
      `Decision: ${s.type}`,
      `Reference Entry: ${s.entry !== null ? formatPrice(s.entry, s.asset, digits) : '—'}`,
      `TP1 (1.5R): ${s.tp1 !== null ? formatPrice(s.tp1, s.asset, digits) : '—'}`,
      `TP2 (2.5R): ${s.tp2 !== null ? formatPrice(s.tp2, s.asset, digits) : '—'}`,
      `Stop Loss: ${s.sl !== null ? formatPrice(s.sl, s.asset, digits) : '—'}`,
      `R:R: ${s.rrText}`,
      `Confluence: ${s.confluencePassed}/${s.confluenceTotal} rules`,
      `FVG: ${s.fvg.label}`,
      `Structure: ${s.structure.label}`,
      `OB: ${s.ob.label}`,
      `Time: ${s.time}`,
    ].join('\n');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(lines)
        .then(() => showToast('Analysis copied to clipboard'))
        .catch(() => showToast('Clipboard permission denied'));
    } else {
      showToast('Clipboard unavailable');
    }
  };

  // Clocks & Countdowns
  const nowDate = new Date(nowMs);
  const utcTimeText = nowDate.toISOString().slice(11, 19) + ' UTC';
  const utcHour = nowDate.getUTCHours();

  const tfDuration = TIMEFRAME_CONFIG[timeframe].seconds;
  const remainingSecs = tfDuration - (Math.floor(nowMs / 1000) % tfDuration);
  const cH = Math.floor(remainingSecs / 3600);
  const cM = Math.floor((remainingSecs % 3600) / 60);
  const cS = remainingSecs % 60;
  const candleCountdownText = cH
    ? `${String(cH).padStart(2, '0')}:${String(cM).padStart(2, '0')}:${String(cS).padStart(2, '0')}`
    : `${String(cM).padStart(2, '0')}:${String(cS).padStart(2, '0')}`;

  const rem20 = 1200 - ((nowDate.getMinutes() % 20) * 60 + nowDate.getSeconds());
  const alertSecs = rem20 <= 0 ? 1200 : rem20;
  const alertCountdownText = `${String(Math.floor(alertSecs / 60)).padStart(2, '0')}:${String(alertSecs % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <Header
        t={t}
        provider={provider}
        onProviderChange={handleProviderChange}
        statusMessage={statusMessage}
        statusTone={statusTone}
        hubState={hubState}
        isRefreshing={isRefreshing}
        onManualRefresh={handleManualRefresh}
        alertEnabled={alertEnabled}
        alertCountdownText={alertCountdownText}
        onToggleAlert={handleToggleAlert}
        language={language}
        onLanguageChange={handleLanguageChange}
        onOpenModal={() => setIsModalOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full space-y-6">
        {/* Top Ticker & Market Sessions */}
        <TickerStrip
          t={t}
          activeSymbol={activeSymbol}
          provider={provider}
          quotes={quotes}
          getFreshness={getFreshness}
          utcTimeText={utcTimeText}
          utcHour={utcHour}
        />

        {/* Gold & Forex Watchlists */}
        <Watchlists
          t={t}
          activeSymbol={activeSymbol}
          onSelectSymbol={handleSelectSymbol}
          quotes={quotes}
          getFreshness={getFreshness}
        />

        {/* Accuracy & Stale Guard Notice */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-200 leading-relaxed">
          <strong>Data source &amp; accuracy:</strong> Live quotes and OHLC bars stream from{' '}
          <strong>BIQUOTE</strong> (<span className="font-mono-tabular">biquote.io</span>, public
          read endpoints) with zero simulated or fabricated prices. Stale quotes (&gt;5m), unavailable
          symbols, or closed markets automatically lock setups to <strong>WAIT</strong>.{' '}
          <strong>EXNESS MT5</strong> remains unavailable unless your local Windows bridge is connected.
        </div>

        {/* Timeframe Selector & UTC Candle Close Countdown */}
        <div className="bg-[#121620] border border-[#1e2535] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.selectTF}</span>
            </span>
            {TIMEFRAME_ORDER.map((tfKey) => {
              const active = tfKey === timeframe;
              return (
                <button
                  key={tfKey}
                  type="button"
                  onClick={() => setTimeframe(tfKey)}
                  className={`px-3 py-1.5 text-xs font-mono-tabular font-bold rounded-lg border transition ${
                    active
                      ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                      : 'border-[#1e2535] bg-[#080a0f] text-slate-300 hover:border-amber-500/60'
                  }`}
                >
                  {TIMEFRAME_CONFIG[tfKey].label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 bg-[#080a0f] px-4 py-2 rounded-lg border border-[#1e2535]">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-semibold">{t.candleClose}</div>
              <div className="text-xs text-amber-400 font-medium">{t.signalRule}</div>
            </div>
            <div className="text-xl font-mono-tabular font-bold text-amber-400 bg-[#121620] px-3 py-1 rounded border border-[#1e2535]">
              {candleCountdownText}
            </div>
          </div>
        </div>

        {/* Separate Forming Candle (isOpen) & Feed Telemetry Strip */}
        <div className="bg-[#121620] border border-amber-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-amber-400 font-bold font-mono-tabular uppercase text-[11px]">
              Forming Candle (isOpen):
            </span>
            {candleError ? (
              <span className="font-mono-tabular text-red-400">DATA UNAVAILABLE — {candleError}</span>
            ) : formingBar ? (
              <span className="font-mono-tabular text-slate-200">
                Open {new Date(formingBar.openTime).toISOString().slice(11, 19)} UTC · O:{' '}
                {formatPrice(formingBar.open, activeSymbol, activeQuote?.digits)} · H:{' '}
                {formatPrice(formingBar.high, activeSymbol, activeQuote?.digits)} · L:{' '}
                {formatPrice(formingBar.low, activeSymbol, activeQuote?.digits)} · C:{' '}
                {formatPrice(formingBar.close, activeSymbol, activeQuote?.digits)} (excluded from
                closed ICT calculations)
              </span>
            ) : (
              <span className="font-mono-tabular text-amber-400">
                No active open candle reported
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 font-mono-tabular text-[11px] text-slate-400">
            <span>
              Closed Bars: <strong className="text-amber-400">{closedBars.length}</strong>
            </span>
            <span>
              Hub: <strong className="text-amber-400">{provider === DataProvider.BIQUOTE ? hubState : 'EXNESS BRIDGE'}</strong>
            </span>
          </div>
        </div>

        {/* Main Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SignalCard
              t={t}
              signal={currentSignal}
              quote={activeQuote}
              freshness={activeFreshness}
              onCopySignal={handleCopySignal}
            />

            {/* Instrument Spec & Quote Verification Panel */}
            <div className="bg-[#121620] border border-[#1e2535] rounded-2xl p-4">
              <div className="flex flex-wrap justify-between items-center mb-3 gap-2 border-b border-[#1e2535] pb-2">
                <h3 className="font-bold text-xs text-white">
                  {activeSymbol} · Instrument Specification &amp; Quote Verification
                </h3>
                <span className="text-[11px] font-mono-tabular text-slate-400">
                  {activeQuote
                    ? `Last update: ${new Date(activeQuote.receivedAtMs).toLocaleTimeString()}`
                    : 'DATA UNAVAILABLE'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#080a0f] p-3 rounded-xl border border-[#1e2535]">
                  <div className="font-semibold text-amber-300">
                    Pip &amp; Point Sizing ({activeQuote ? `${activeQuote.digits} digits` : 'pending'})
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular leading-relaxed">
                    {INSTRUMENT_SPECS[activeSymbol].pipNote}
                  </div>
                </div>
                <div className="bg-[#080a0f] p-3 rounded-xl border border-[#1e2535]">
                  <div className="font-semibold text-amber-300">
                    Feed Freshness ({provider}) — {activeFreshness.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular leading-relaxed">
                    {activeQuote
                      ? `UTC: ${activeQuote.timestamp} · MarketState: ${activeQuote.marketState.toUpperCase()} · Age: ${formatAge(activeFreshness.ageSeconds)}`
                      : 'DATA UNAVAILABLE — No live tick or REST snapshot received.'}
                  </div>
                </div>
              </div>
            </div>

            <CandlestickChart
              t={t}
              symbol={activeSymbol}
              tf={timeframe}
              provider={provider}
              closedBars={closedBars}
              formingBar={formingBar}
              signal={currentSignal}
              quote={activeQuote}
              freshness={activeFreshness}
              errorMessage={candleError}
            />
          </div>

          <SignalHistoryPanel
            t={t}
            history={history}
            onClearHistory={handleClearHistory}
          />
        </div>
      </main>

      <footer className="bg-[#121620] border-t border-[#1e2535] py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-between items-center gap-2 text-xs text-slate-500">
          <span>
            &copy; 2026 NETHAGA Pro Trading Hub. Personal-use technical analysis workstation. Not financial advice.
          </span>
          <span>Verify spread, quote age, and broker digits before placing any order.</span>
        </div>
      </footer>

      <DiagnosticsModal
        t={t}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        hubState={hubState}
      />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 bg-amber-500 text-gray-950 font-bold px-4 py-3 rounded-xl shadow-2xl z-[100] text-xs border border-amber-300 max-w-[90vw]"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
