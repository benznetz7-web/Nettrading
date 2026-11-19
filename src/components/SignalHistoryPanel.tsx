import React from 'react';
import { GraduationCap, ListChecks, Trash2 } from 'lucide-react';
import { TranslationStrings } from '../constants/instruments';
import { HistoryEntry, SignalDirection } from '../types/market';

interface SignalHistoryPanelProps {
  t: TranslationStrings;
  history: HistoryEntry[];
  onClearHistory: () => void;
}

export const SignalHistoryPanel: React.FC<SignalHistoryPanelProps> = ({
  t,
  history,
  onClearHistory,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-[#121620] border border-[#1e2535] rounded-2xl p-5 flex flex-col h-[520px]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-amber-400" />
            <span>{t.signalHistory}</span>
          </h3>
          <button
            type="button"
            onClick={onClearHistory}
            className="text-[11px] bg-[#080a0f] hover:bg-red-950/50 text-slate-400 hover:text-red-400 px-2.5 py-1 rounded-md font-mono-tabular border border-[#1e2535] transition flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t.clearLog}</span>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto space-y-2.5 pr-1">
          {history.length === 0 ? (
            <div className="text-center text-slate-500 text-xs py-12 font-mono-tabular">
              {t.noSetupYet}
            </div>
          ) : (
            history.map((item) => {
              const isBuy = item.type === SignalDirection.BUY;
              return (
                <div
                  key={item.id}
                  className="bg-[#080a0f] p-3 rounded-xl border border-[#1e2535] flex items-center justify-between gap-2 text-xs hover:border-slate-700 transition"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white flex flex-wrap items-center gap-2">
                      <span>{item.asset}</span>
                      <span className="text-[11px] text-amber-400 font-mono-tabular">{item.tf}</span>
                      <span
                        className={`text-[11px] font-black font-mono-tabular ${
                          isBuy ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-tabular mt-1">
                      Entry: {item.entry} · TP1: {item.tp1} · SL: {item.sl}
                    </div>
                  </div>
                  <div className="text-right font-mono-tabular shrink-0">
                    <span className="text-[10px] text-slate-400 block">
                      {item.date} {item.time}
                    </span>
                    <span className="text-[10px] font-bold text-amber-400">
                      {item.source} · {item.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Risk Management Checklist */}
      <div className="bg-gradient-to-br from-[#121620] to-[#080a0f] border border-amber-500/30 rounded-2xl p-5">
        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4" />
          <span>{t.traderTipTitle}</span>
        </h4>
        <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
          <li>{t.rule1}</li>
          <li>{t.rule2}</li>
          <li>{t.rule3}</li>
          <li>{t.rule4}</li>
        </ul>
      </div>
    </div>
  );
};
