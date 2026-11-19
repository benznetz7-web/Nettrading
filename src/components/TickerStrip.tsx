import React from 'react';
import { TranslationStrings } from '../constants/instruments';
import { formatAge, formatPrice, formatSpread } from '../services/biquoteService';
import {
  DataProvider,
  FreshnessStatus,
  NormalizedQuote,
  QuoteFreshness,
  SupportedSymbol,
} from '../types/market';

interface TickerStripProps {
  t: TranslationStrings;
  activeSymbol: SupportedSymbol;
  provider: DataProvider;
  quotes: Partial<Record<SupportedSymbol, NormalizedQuote>>;
  getFreshness: (sym: SupportedSymbol) => QuoteFreshness;
  utcTimeText: string;
  utcHour: number;
}

function statusBadgeStyle(status: FreshnessStatus): string {
  switch (status) {
    case FreshnessStatus.LIVE:
      return 'text-emerald-400';
    case FreshnessStatus.CLOSED:
      return 'text-amber-400';
    case FreshnessStatus.STALE:
      return 'text-orange-400';
    default:
      return 'text-red-400';
  }
}

export const TickerStrip: React.FC<TickerStripProps> = ({
  t,
  activeSymbol,
  provider,
  quotes,
  getFreshness,
  utcTimeText,
  utcHour,
}) => {
  const activeQuote = quotes[activeSymbol];
  const activeFreshness = getFreshness(activeSymbol);
  const activePrefix = activeSymbol === 'XAUUSD' ? '$' : '';
  const activeTrend =
    activeQuote && activeQuote.prevMid !== null
      ? activeQuote.mid > activeQuote.prevMid
        ? 'text-emerald-400'
        : activeQuote.mid < activeQuote.prevMid
        ? 'text-red-400'
        : 'text-amber-400'
      : 'text-amber-400';

  const renderMajorCard = (sym: 'EURUSD' | 'GBPUSD', subtitle: string) => {
    const q = quotes[sym];
    const f = getFreshness(sym);
    return (
      <div className="bg-[#121620] border border-[#1e2535] rounded-xl p-4 flex flex-col justify-between">
        <div className="flex justify-between items-start gap-2">
          <div>
            <span className="text-xs text-slate-400 font-medium">{subtitle}</span>
            <h2 className="text-xl font-extrabold text-white mt-0.5">{sym}</h2>
          </div>
          <span className={`text-[11px] font-mono-tabular font-bold ${statusBadgeStyle(f.status)}`}>
            {provider} · {f.status}
          </span>
        </div>

        {!q || !f.available ? (
          <div className="mt-3">
            <div className="text-sm font-mono-tabular font-bold text-red-400">DATA UNAVAILABLE</div>
            <div className="mt-2 text-[11px] font-mono-tabular text-slate-500">
              Bid: — · Ask: — · Spread: —
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-mono-tabular font-bold text-white">
                {formatPrice(q.mid, sym, q.digits)}
              </span>
              {q.marketState === 'closed' || q.dayDiffPercent === null ? (
                <span className="text-xs font-mono-tabular font-semibold text-amber-400">
                  {q.marketState === 'closed' ? 'MARKET CLOSED' : '—'}
                </span>
              ) : (
                <span
                  className={`text-xs font-mono-tabular font-semibold ${
                    q.dayDiffPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {q.dayDiffPercent >= 0 ? '+' : ''}
                  {q.dayDiffPercent.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] text-slate-400 font-mono-tabular space-y-0.5">
              <div className="flex justify-between">
                <span>Bid: <span className="text-slate-200">{formatPrice(q.bid, sym, q.digits)}</span></span>
                <span>Ask: <span className="text-slate-200">{formatPrice(q.ask, sym, q.digits)}</span></span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Spread: <span className="text-slate-300">{formatSpread(sym, q.spread, q.pointSize)}</span></span>
                <span>{formatAge(f.ageSeconds)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const sessions = [
    { name: 'London', open: utcHour >= 7 && utcHour < 16 },
    { name: 'New York', open: utcHour >= 12 && utcHour < 21 },
    { name: 'Tokyo', open: utcHour >= 0 && utcHour < 9 },
    { name: 'Sydney', open: utcHour >= 21 || utcHour < 6 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Active Instrument */}
      <div className="bg-[#121620] border border-[#1e2535] rounded-xl p-4 flex flex-col justify-between">
        <div className="flex justify-between items-start gap-2">
          <div>
            <span className="text-xs text-slate-400 font-medium">
              {provider} · {t.activePair}
            </span>
            <h2 className="text-xl font-extrabold text-white mt-0.5">{activeSymbol}</h2>
          </div>
          <span className={`text-[11px] font-mono-tabular font-bold ${statusBadgeStyle(activeFreshness.status)}`}>
            {activeFreshness.status}
          </span>
        </div>

        {!activeQuote || !activeFreshness.available ? (
          <div className="mt-3">
            <div className="text-lg font-mono-tabular font-bold text-red-400">DATA UNAVAILABLE</div>
            <div className="mt-2 text-[11px] font-mono-tabular text-slate-500">
              No active quote from {provider}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className={`text-2xl font-mono-tabular font-bold transition-colors ${activeTrend}`}>
                {activePrefix}
                {formatPrice(activeQuote.mid, activeSymbol, activeQuote.digits)}
              </span>
              {activeQuote.marketState === 'closed' || activeQuote.dayDiffPercent === null ? (
                <span className="text-[11px] font-mono-tabular font-semibold text-amber-400">
                  {activeQuote.marketState === 'closed' ? 'MARKET CLOSED — LAST PRICE' : '—'}
                </span>
              ) : (
                <span
                  className={`text-xs font-mono-tabular font-semibold ${
                    activeQuote.dayDiffPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {activeQuote.dayDiffPercent >= 0 ? '+' : ''}
                  {activeQuote.dayDiffPercent.toFixed(2)}%
                </span>
              )}
            </div>

            <div className="mt-2 text-[11px] text-slate-400 font-mono-tabular space-y-0.5">
              <div className="flex justify-between">
                <span>
                  Bid:{' '}
                  <span className="text-slate-200">
                    {activePrefix}
                    {formatPrice(activeQuote.bid, activeSymbol, activeQuote.digits)}
                  </span>
                </span>
                <span>
                  Ask:{' '}
                  <span className="text-slate-200">
                    {activePrefix}
                    {formatPrice(activeQuote.ask, activeSymbol, activeQuote.digits)}
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>
                  Spread:{' '}
                  <span className="text-slate-300">
                    {formatSpread(activeSymbol, activeQuote.spread, activeQuote.pointSize)}
                  </span>
                </span>
                <span className={activeFreshness.live ? 'text-amber-400' : 'text-orange-400'}>
                  {formatAge(activeFreshness.ageSeconds)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>
                  H:{' '}
                  <span className="text-slate-300">
                    {activeQuote.high !== null
                      ? `${activePrefix}${formatPrice(activeQuote.high, activeSymbol, activeQuote.digits)}`
                      : '—'}
                  </span>
                </span>
                <span>
                  L:{' '}
                  <span className="text-slate-300">
                    {activeQuote.low !== null
                      ? `${activePrefix}${formatPrice(activeQuote.low, activeSymbol, activeQuote.digits)}`
                      : '—'}
                  </span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Card 2: EURUSD */}
      {renderMajorCard('EURUSD', 'Euro / US Dollar')}

      {/* Card 3: GBPUSD */}
      {renderMajorCard('GBPUSD', 'British Pound / USD')}

      {/* Card 4: Market Sessions & Quote UTC */}
      <div className="bg-[#121620] border border-[#1e2535] rounded-xl p-4 flex flex-col justify-between">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-slate-400 font-semibold">{t.marketSessions}</span>
          <span className="text-xs font-mono-tabular text-amber-400">{utcTimeText}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {sessions.map((s) => (
            <div
              key={s.name}
              className="bg-[#080a0f] px-2.5 py-1.5 rounded-lg border border-[#1e2535] flex justify-between items-center"
            >
              <span className="text-slate-300">{s.name}</span>
              <span
                className={`font-mono-tabular text-[10px] font-bold ${
                  s.open ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {s.open ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 pt-2 border-t border-[#1e2535] text-[11px] font-mono-tabular text-slate-400 flex justify-between gap-2">
          <span>
            Source: <strong className="text-amber-400">{provider}</strong>
          </span>
          <span className="truncate">
            {activeQuote?.timestamp
              ? `Quote: ${new Date(activeQuote.timestamp).toISOString().slice(11, 19)} UTC`
              : 'No timestamp'}
          </span>
        </div>
      </div>
    </div>
  );
};
