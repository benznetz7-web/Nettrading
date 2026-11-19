import React from 'react';
import { Coins, Globe } from 'lucide-react';
import { INSTRUMENT_SPECS, SUPPORTED_SYMBOLS, TranslationStrings } from '../constants/instruments';
import { formatAge, formatPrice, formatSpread } from '../services/biquoteService';
import {
  FreshnessStatus,
  NormalizedQuote,
  QuoteFreshness,
  SupportedSymbol,
} from '../types/market';

interface WatchlistsProps {
  t: TranslationStrings;
  activeSymbol: SupportedSymbol;
  onSelectSymbol: (symbol: SupportedSymbol) => void;
  quotes: Partial<Record<SupportedSymbol, NormalizedQuote>>;
  getFreshness: (symbol: SupportedSymbol) => QuoteFreshness;
}

export const Watchlists: React.FC<WatchlistsProps> = ({
  t,
  activeSymbol,
  onSelectSymbol,
  quotes,
  getFreshness,
}) => {
  const goldSymbols = SUPPORTED_SYMBOLS.filter((s) => INSTRUMENT_SPECS[s].group === 'GOLD');
  const fxSymbols = SUPPORTED_SYMBOLS.filter((s) => INSTRUMENT_SPECS[s].group === 'FX');

  const goldAvailableCount = goldSymbols.filter((s) => getFreshness(s).available).length;
  const fxAvailableCount = fxSymbols.filter((s) => getFreshness(s).available).length;

  const renderTile = (sym: SupportedSymbol) => {
    const q = quotes[sym];
    const f = getFreshness(sym);
    const isActive = sym === activeSymbol;
    const prefix = sym === 'XAUUSD' ? '$' : '';
    const statusColor =
      f.status === FreshnessStatus.LIVE
        ? 'text-emerald-400'
        : f.status === FreshnessStatus.CLOSED
        ? 'text-amber-400'
        : f.status === FreshnessStatus.STALE
        ? 'text-orange-400'
        : 'text-red-400';

    return (
      <button
        key={sym}
        type="button"
        onClick={() => onSelectSymbol(sym)}
        className={`w-full text-left bg-[#080a0f] rounded-xl p-3 border transition ${
          isActive
            ? 'border-amber-500 bg-amber-500/10'
            : 'border-[#1e2535] hover:border-amber-500/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-extrabold text-xs text-white font-mono-tabular">{sym}</span>
          <span className={`font-mono-tabular text-[10px] font-bold ${statusColor}`}>
            {f.status}
          </span>
        </div>

        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span
            className={`font-mono-tabular font-bold text-sm ${
              q && f.available ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {q && f.available ? `${prefix}${formatPrice(q.mid, sym, q.digits)}` : 'DATA UNAVAILABLE'}
          </span>
          <span className="font-mono-tabular text-[10px] text-slate-400">
            {q && f.available ? formatAge(f.ageSeconds) : '—'}
          </span>
        </div>

        <div className="mt-1 text-[10px] font-mono-tabular text-slate-400 flex justify-between gap-2">
          <span>
            {q && f.available
              ? `B: ${formatPrice(q.bid, sym, q.digits)} / A: ${formatPrice(q.ask, sym, q.digits)}`
              : 'Symbol inactive or offline'}
          </span>
        </div>
        <div className="text-[10px] font-mono-tabular text-slate-500 mt-0.5 truncate">
          {q && f.available ? `Spr: ${formatSpread(sym, q.spread, q.pointSize)}` : '—'}
        </div>
      </button>
    );
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4" aria-label="Gold and Forex Watchlists">
      {/* Gold Watchlist */}
      <div className="bg-[#121620] border border-[#1e2535] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2">
            <Coins className="w-4 h-4" />
            <span>{t.goldWatchlist}</span>
          </h3>
          <span className="text-xs font-mono-tabular text-slate-400">
            {goldAvailableCount}/{goldSymbols.length} Active
          </span>
        </div>
        <div className="space-y-2">{goldSymbols.map(renderTile)}</div>
      </div>

      {/* Forex Watchlist */}
      <div className="lg:col-span-2 bg-[#121620] border border-[#1e2535] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span>{t.forexWatchlist}</span>
          </h3>
          <span className="text-xs font-mono-tabular text-slate-400">
            {fxAvailableCount}/{fxSymbols.length} Active
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {fxSymbols.map(renderTile)}
        </div>
      </div>
    </section>
  );
};
