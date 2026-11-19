import React from 'react';
import { INSTRUMENT_SPECS, TIMEFRAME_CONFIG, TranslationStrings } from '../constants/instruments';
import { formatPrice } from '../services/biquoteService';
import {
  CandleBar,
  DataProvider,
  FreshnessStatus,
  NormalizedQuote,
  QuoteFreshness,
  SignalAnalysis,
  SignalDirection,
  SupportedSymbol,
  TimeframeKey,
} from '../types/market';

interface CandlestickChartProps {
  t: TranslationStrings;
  symbol: SupportedSymbol;
  tf: TimeframeKey;
  provider: DataProvider;
  closedBars: CandleBar[];
  formingBar: CandleBar | null;
  signal: SignalAnalysis;
  quote: NormalizedQuote | undefined;
  freshness: QuoteFreshness;
  errorMessage: string | null;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  t,
  symbol,
  tf,
  provider,
  closedBars,
  formingBar,
  signal,
  quote,
  freshness,
  errorMessage,
}) => {
  const digits = quote?.digits ?? INSTRUMENT_SPECS[symbol].defaultDigits;
  const displayClosed = closedBars.slice(-39);
  const allVisible = formingBar ? [...displayClosed, formingBar] : displayClosed;

  const hasData = allVisible.length > 0;
  const showLevels = signal.type !== SignalDirection.WAIT && signal.entry !== null;
  const liveRef = quote?.mid ?? (allVisible.length ? allVisible[allVisible.length - 1].close : null);

  let low = 0;
  let high = 1;
  if (hasData) {
    const levels: number[] = allVisible.flatMap((c) => [c.high, c.low]);
    if (liveRef !== null && Number.isFinite(liveRef)) levels.push(liveRef);
    if (showLevels && signal.entry !== null && signal.tp1 !== null && signal.tp2 !== null && signal.sl !== null) {
      levels.push(signal.entry, signal.tp1, signal.tp2, signal.sl);
    }
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    const pad = Math.max((max - min) * 0.08, INSTRUMENT_SPECS[symbol].pipSize * 4);
    low = min - pad;
    high = max + pad;
  }

  const y = (price: number) => 228 - ((price - low) / (high - low || 1)) * 216;
  const spacing = hasData ? 600 / allVisible.length : 15;
  const bodyW = Math.max(3, Math.min(12, spacing * 0.62));

  const ema9Slice = signal.ema9Series.slice(-displayClosed.length);
  const ema21Slice = signal.ema21Series.slice(-displayClosed.length);
  const buildPath = (series: number[]) =>
    series
      .map((val, idx) => {
        const x = idx * spacing + spacing / 2;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y(val).toFixed(1)}`;
      })
      .join(' ');

  const ema9Path = buildPath(ema9Slice);
  const ema21Path = buildPath(ema21Slice);

  const feedDotClass = !hasData
    ? 'bg-red-500'
    : freshness.status === FreshnessStatus.LIVE
    ? 'bg-emerald-500 animate-ping'
    : 'bg-amber-500';

  const feedTextClass = !hasData
    ? 'text-red-400'
    : freshness.status === FreshnessStatus.LIVE
    ? 'text-emerald-400'
    : 'text-amber-400';

  return (
    <div className="bg-[#0b0e14] border-2 border-[#1e2535] rounded-2xl p-4 shadow-2xl">
      <div className="flex flex-wrap justify-between items-center mb-3 gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-mono-tabular font-bold text-xs">
            {symbol} · {TIMEFRAME_CONFIG[tf].label}
          </span>
          <h3 className="font-bold text-sm text-slate-100">{t.chartTitle}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono-tabular">
          <span className={`w-2 h-2 rounded-full ${feedDotClass}`} aria-hidden="true" />
          <span className={`font-bold ${feedTextClass}`}>
            {hasData ? `${provider} · ${freshness.status}` : 'DATA UNAVAILABLE'}
          </span>
        </div>
      </div>

      <div className="w-full h-72 sm:h-80 bg-[#080b10] rounded-xl border border-slate-800 relative overflow-hidden">
        <svg className="w-full h-full block" viewBox="0 0 668 240" preserveAspectRatio="none">
          {/* Grid */}
          {[40, 80, 120, 160, 200].map((gy) => (
            <line key={gy} x1="0" y1={gy} x2="600" y2={gy} stroke="#161b26" strokeWidth="1" />
          ))}
          {[150, 300, 450].map((gx) => (
            <line key={gx} x1={gx} y1="0" x2={gx} y2="240" stroke="#161b26" strokeWidth="1" />
          ))}
          <line x1="600" y1="0" x2="600" y2="240" stroke="#1f2937" strokeWidth="1.5" />

          {/* ICT Zones */}
          {hasData && signal.fvg.type !== 'NONE' && signal.fvg.top > 0 && (
            <g>
              <rect
                x="300"
                y={Math.min(y(signal.fvg.top), y(signal.fvg.bottom))}
                width="300"
                height={Math.max(5, Math.abs(y(signal.fvg.top) - y(signal.fvg.bottom)))}
                fill="#f59e0b"
                fillOpacity="0.14"
                stroke="#f59e0b"
                strokeDasharray="3 2"
              />
              <text
                x="306"
                y={Math.min(y(signal.fvg.top), y(signal.fvg.bottom)) + 10}
                fill="#f59e0b"
                fontSize="9"
                fontFamily="monospace"
              >
                FVG ({signal.fvg.type})
              </text>
            </g>
          )}

          {hasData && signal.ob.type !== 'NONE' && signal.ob.high > 0 && (
            <g>
              <rect
                x="300"
                y={Math.min(y(signal.ob.high), y(signal.ob.low))}
                width="300"
                height={Math.max(5, Math.abs(y(signal.ob.high) - y(signal.ob.low)))}
                fill="#a855f7"
                fillOpacity="0.14"
                stroke="#a855f7"
                strokeDasharray="3 2"
              />
              <text
                x="306"
                y={Math.min(y(signal.ob.high), y(signal.ob.low)) + 10}
                fill="#c084fc"
                fontSize="9"
                fontFamily="monospace"
              >
                RULE-BASED OB
              </text>
            </g>
          )}

          {/* Candles */}
          {hasData &&
            allVisible.map((c, i) => {
              const x = i * spacing + spacing / 2;
              const up = c.close >= c.open;
              const color = up ? '#10b981' : '#ef4444';
              const topY = Math.min(y(c.open), y(c.close));
              const rectH = Math.max(2, Math.abs(y(c.open) - y(c.close)));
              return (
                <g key={c.timeMs}>
                  <line
                    x1={x}
                    x2={x}
                    y1={y(c.high)}
                    y2={y(c.low)}
                    stroke={color}
                    strokeWidth={c.isOpen ? 1 : 1.4}
                    strokeDasharray={c.isOpen ? '2 2' : undefined}
                  />
                  <rect
                    x={x - bodyW / 2}
                    y={topY}
                    width={bodyW}
                    height={rectH}
                    fill={color}
                    fillOpacity={c.isOpen ? 0.35 : 1}
                    stroke={c.isOpen ? '#f59e0b' : undefined}
                    strokeDasharray={c.isOpen ? '2 1' : undefined}
                  />
                </g>
              );
            })}

          {/* EMA 9 & EMA 21 */}
          {hasData && ema9Path && (
            <path d={ema9Path} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.9" />
          )}
          {hasData && ema21Path && (
            <path
              d={ema21Path}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="1.3"
              strokeDasharray="3 2"
              opacity="0.8"
            />
          )}

          {/* Signal Levels */}
          {hasData && showLevels && signal.tp2 !== null && (
            <g>
              <line x1="0" y1={y(signal.tp2)} x2="600" y2={y(signal.tp2)} stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 3" />
              <rect x="602" y={y(signal.tp2) - 7.5} width="64" height="15" fill="#065f46" rx="2" />
              <text x="605" y={y(signal.tp2) + 3} fill="#34d399" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                {formatPrice(signal.tp2, symbol, digits)}
              </text>
            </g>
          )}
          {hasData && showLevels && signal.tp1 !== null && (
            <g>
              <line x1="0" y1={y(signal.tp1)} x2="600" y2={y(signal.tp1)} stroke="#34d399" strokeWidth="1.5" strokeDasharray="4 3" />
              <rect x="602" y={y(signal.tp1) - 7.5} width="64" height="15" fill="#064e3b" rx="2" />
              <text x="605" y={y(signal.tp1) + 3} fill="#6ee7b7" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                {formatPrice(signal.tp1, symbol, digits)}
              </text>
            </g>
          )}
          {hasData && showLevels && signal.entry !== null && (
            <g>
              <line x1="0" y1={y(signal.entry)} x2="600" y2={y(signal.entry)} stroke="#3b82f6" strokeWidth="2" />
              <rect x="602" y={y(signal.entry) - 7.5} width="64" height="15" fill="#1d4ed8" rx="2" />
              <text x="605" y={y(signal.entry) + 3} fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                {formatPrice(signal.entry, symbol, digits)}
              </text>
            </g>
          )}
          {hasData && showLevels && signal.sl !== null && (
            <g>
              <line x1="0" y1={y(signal.sl)} x2="600" y2={y(signal.sl)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" />
              <rect x="602" y={y(signal.sl) - 7.5} width="64" height="15" fill="#7f1d1d" rx="2" />
              <text x="605" y={y(signal.sl) + 3} fill="#fca5a5" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                {formatPrice(signal.sl, symbol, digits)}
              </text>
            </g>
          )}

          {/* Live Price Line */}
          {hasData && liveRef !== null && Number.isFinite(liveRef) && (
            <g>
              <line x1="0" y1={y(liveRef)} x2="600" y2={y(liveRef)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
              <rect x="602" y={y(liveRef) - 7.5} width="64" height="15" fill="#d97706" rx="2" />
              <text x="605" y={y(liveRef) + 3} fill="#000000" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                {formatPrice(liveRef, symbol, digits)}
              </text>
            </g>
          )}
        </svg>

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080b10]/90 text-red-400 font-mono-tabular text-xs sm:text-sm font-bold text-center px-4">
            {errorMessage ? `DATA UNAVAILABLE — ${errorMessage}` : 'DATA UNAVAILABLE — Waiting for OHLC candles'}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-between items-center mt-3 text-[11px] text-slate-400 gap-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 bg-amber-500/30 border border-amber-400 rounded-sm" />
          FVG Zone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 bg-purple-500/30 border border-purple-400 rounded-sm" />
          Rule-Based Potential OB
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-amber-500" />
          EMA 9
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-blue-500" />
          EMA 21 / Entry
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-emerald-500" />
          TP1 / TP2
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-red-500" />
          SL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 border border-dashed border-amber-400 bg-emerald-500/30 rounded-sm" />
          Forming Bar (isOpen)
        </span>
      </div>
    </div>
  );
};
