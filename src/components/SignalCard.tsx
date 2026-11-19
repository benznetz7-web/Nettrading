import React from 'react';
import { Check, Copy, X } from 'lucide-react';
import { INSTRUMENT_SPECS, TIMEFRAME_CONFIG, TranslationStrings } from '../constants/instruments';
import { formatPrice } from '../services/biquoteService';
import {
  FreshnessStatus,
  NormalizedQuote,
  QuoteFreshness,
  SignalAnalysis,
  SignalDirection,
} from '../types/market';
import { formatDistanceLabel } from '../utils/ictAnalysis';

interface SignalCardProps {
  t: TranslationStrings;
  signal: SignalAnalysis;
  quote: NormalizedQuote | undefined;
  freshness: QuoteFreshness;
  onCopySignal: () => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  t,
  signal,
  quote,
  freshness,
  onCopySignal,
}) => {
  const sym = signal.asset;
  const spec = INSTRUMENT_SPECS[sym];
  const digits = quote?.digits ?? spec.defaultDigits;
  const pointSize = quote?.pointSize ?? spec.defaultPointSize;
  const prefix = sym === 'XAUUSD' ? '$' : '';

  const isBuy = signal.type === SignalDirection.BUY;
  const isSell = signal.type === SignalDirection.SELL;
  const isWait = !isBuy && !isSell;

  const cardBorder = isBuy
    ? 'border-emerald-500/60'
    : isSell
    ? 'border-red-500/60'
    : 'border-amber-500/50';

  const badgeClass = isBuy
    ? 'bg-emerald-500 text-gray-950 pulse-buy'
    : isSell
    ? 'bg-red-500 text-white pulse-sell'
    : 'bg-amber-500 text-gray-950';

  // Live P/L calculation from actual current bid/ask vs reference entry
  let livePnlLabel = 'Live P/L: —';
  let livePnlTone = 'text-slate-400';

  if (!freshness.available) {
    livePnlLabel = 'DATA UNAVAILABLE';
    livePnlTone = 'text-red-400';
  } else if (freshness.status === FreshnessStatus.CLOSED) {
    livePnlLabel = 'Market closed — locked to WAIT';
    livePnlTone = 'text-amber-400';
  } else if (freshness.status === FreshnessStatus.STALE) {
    livePnlLabel = 'Stale quote — locked to WAIT';
    livePnlTone = 'text-orange-400';
  } else if (!isWait && quote && signal.entry !== null) {
    const exitPrice = isBuy ? quote.bid : quote.ask;
    const signedMove = isBuy ? exitPrice - signal.entry : signal.entry - exitPrice;
    const pips = signedMove / spec.pipSize;
    const points = signedMove / pointSize;
    if (sym === 'XAUUSD') {
      livePnlLabel = `Live P/L: ${signedMove >= 0 ? '+' : '-'}$${Math.abs(signedMove).toFixed(2)} (${pips >= 0 ? '+' : ''}${pips.toFixed(1)} pips / ${points >= 0 ? '+' : ''}${points.toFixed(0)} pts @ $${pointSize})`;
    } else {
      livePnlLabel = `Live P/L: ${pips >= 0 ? '+' : ''}${pips.toFixed(1)} pips (${points >= 0 ? '+' : ''}${points.toFixed(0)} pts)`;
    }
    livePnlTone = signedMove >= 0 ? 'text-emerald-400' : 'text-red-400';
  }

  return (
    <div className={`bg-[#121620] border-2 ${cardBorder} rounded-2xl p-5 sm:p-6 shadow-xl`}>
      {/* Header Row */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
            <span
              className={`font-extrabold text-sm px-4 py-1 rounded-lg tracking-wider ${badgeClass}`}
            >
              {signal.type}
            </span>
            <span className="text-amber-400 font-bold">
              {TIMEFRAME_CONFIG[signal.tf].label}
            </span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-slate-300 font-semibold">SOURCE: {signal.source}</span>
          </div>
          <h2 className="text-2xl font-black text-white mt-2 flex flex-wrap items-baseline gap-2">
            <span>{sym}</span>
            <span className="text-sm font-normal text-slate-400 font-mono-tabular">
              {signal.reason} ({signal.time})
            </span>
          </h2>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onCopySignal}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-950 font-extrabold text-xs px-4 py-2 rounded-lg shadow-lg shadow-amber-500/20 transition whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{t.copySignal}</span>
          </button>
          <div className="text-right">
            <div className="text-xs text-slate-400">{t.confluenceLabel}</div>
            <div className="text-lg font-mono-tabular font-bold text-amber-400">
              {signal.confluencePassed}/{signal.confluenceTotal} Rules
            </div>
          </div>
        </div>
      </div>

      {/* Entry / TP1 / TP2 / SL Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <div className="bg-[#080a0f] p-3.5 rounded-xl border border-[#1e2535]">
          <div className="text-xs text-slate-400 font-semibold mb-1">{t.entryPrice}</div>
          <div className="text-lg sm:text-xl font-mono-tabular font-bold text-white">
            {signal.entry !== null ? `${prefix}${formatPrice(signal.entry, sym, digits)}` : '—'}
          </div>
          <div className={`text-[11px] font-mono-tabular font-semibold mt-1 ${livePnlTone}`}>
            {livePnlLabel}
          </div>
        </div>

        <div className="bg-[#080a0f] p-3.5 rounded-xl border border-emerald-500/30">
          <div className="text-xs text-emerald-400 font-semibold mb-1">TP 1 (1.5R)</div>
          <div className="text-lg sm:text-xl font-mono-tabular font-bold text-emerald-400">
            {signal.tp1 !== null ? `${prefix}${formatPrice(signal.tp1, sym, digits)}` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
            {!isWait && signal.entry !== null && signal.tp1 !== null
              ? `+${formatDistanceLabel(sym, Math.abs(signal.tp1 - signal.entry), pointSize)}`
              : 'No valid setup'}
          </div>
        </div>

        <div className="bg-[#080a0f] p-3.5 rounded-xl border border-emerald-500/30">
          <div className="text-xs text-emerald-400 font-semibold mb-1">TP 2 (2.5R)</div>
          <div className="text-lg sm:text-xl font-mono-tabular font-bold text-emerald-400">
            {signal.tp2 !== null ? `${prefix}${formatPrice(signal.tp2, sym, digits)}` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
            {!isWait && signal.entry !== null && signal.tp2 !== null
              ? `+${formatDistanceLabel(sym, Math.abs(signal.tp2 - signal.entry), pointSize)}`
              : 'No valid setup'}
          </div>
        </div>

        <div className="bg-[#080a0f] p-3.5 rounded-xl border border-red-500/30">
          <div className="text-xs text-red-400 font-semibold mb-1">STOP LOSS (SL)</div>
          <div className="text-lg sm:text-xl font-mono-tabular font-bold text-red-400">
            {signal.sl !== null ? `${prefix}${formatPrice(signal.sl, sym, digits)}` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
            {!isWait && signal.entry !== null && signal.sl !== null
              ? `-${formatDistanceLabel(sym, Math.abs(signal.entry - signal.sl), pointSize)}`
              : 'No valid setup'}
          </div>
        </div>
      </div>

      {/* Indicator Telemetry Strip */}
      <div className="mt-4 bg-[#080a0f] px-3.5 py-2.5 rounded-xl border border-[#1e2535] flex flex-wrap justify-between items-center gap-3 text-xs font-mono-tabular">
        <span>
          R:R: <strong className="text-amber-400">{signal.rrText}</strong>
        </span>
        <span>
          EMA 9/21:{' '}
          <strong className="text-slate-200">
            {signal.ema9 !== null && signal.ema21 !== null
              ? `${formatPrice(signal.ema9, sym, digits)} / ${formatPrice(signal.ema21, sym, digits)} (${signal.ema9 > signal.ema21 ? 'Bull' : 'Bear'})`
              : '—'}
          </strong>
        </span>
        <span>
          RSI(14):{' '}
          <strong className="text-slate-200">
            {signal.rsi14 !== null ? signal.rsi14.toFixed(1) : '—'}
          </strong>
        </span>
        <span>
          ATR(14):{' '}
          <strong className="text-slate-200">
            {signal.atr14 !== null
              ? sym === 'XAUUSD'
                ? `$${signal.atr14.toFixed(2)}`
                : `${(signal.atr14 / spec.pipSize).toFixed(1)} pips`
              : '—'}
          </strong>
        </span>
      </div>

      {/* Transparent Confluence Rules */}
      {signal.rules.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] font-mono-tabular">
          {signal.rules.map((rule) => (
            <div
              key={rule.name}
              className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                rule.pass
                  ? 'border-emerald-500/30 bg-emerald-950/50 text-emerald-400'
                  : 'border-[#1e2535] bg-[#080a0f] text-slate-400'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                {rule.pass ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                <span className="truncate">{rule.name}</span>
              </span>
              <span className="text-[10px] shrink-0">{rule.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* ICT Breakdown */}
      <div className="mt-4 pt-4 border-t border-[#1e2535] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-[#080a0f] p-3 rounded-xl border border-amber-500/30">
          <span className="text-slate-400 block mb-0.5 font-semibold">{t.fvgLabel}</span>
          <span className="font-mono-tabular text-amber-400 font-bold">{signal.fvg.label}</span>
        </div>
        <div className="bg-[#080a0f] p-3 rounded-xl border border-blue-500/30">
          <span className="text-slate-400 block mb-0.5 font-semibold">{t.structureLabel}</span>
          <span className="font-mono-tabular text-emerald-400 font-bold">{signal.structure.label}</span>
        </div>
        <div className="bg-[#080a0f] p-3 rounded-xl border border-purple-500/30">
          <span className="text-slate-400 block mb-0.5 font-semibold">{t.obLabel}</span>
          <span className="font-mono-tabular text-purple-400 font-bold">{signal.ob.label}</span>
        </div>
      </div>
    </div>
  );
};
