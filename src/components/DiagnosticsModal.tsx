import React, { useState } from 'react';
import { Plug, Play, X } from 'lucide-react';
import { BIQUOTE_BASE_URL, BIQUOTE_HUB_URL, TranslationStrings } from '../constants/instruments';
import { biquoteFetchJson } from '../services/biquoteService';
import { HubConnectionState } from '../types/market';

interface DiagnosticsModalProps {
  t: TranslationStrings;
  isOpen: boolean;
  onClose: () => void;
  hubState: HubConnectionState;
}

interface TestLogLine {
  id: number;
  text: string;
  status: 'info' | 'pass' | 'fail';
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  t,
  isOpen,
  onClose,
  hubState,
}) => {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<TestLogLine[]>([
    {
      id: 0,
      text: 'Click "Run Tests" to verify /api/active, /api/latest, all 7 OHLC intervals, and SignalR.',
      status: 'info',
    },
  ]);

  if (!isOpen) return null;

  const runLiveSelfTests = async () => {
    setRunning(true);
    let nextId = 1;
    const nextLogs: TestLogLine[] = [
      { id: nextId++, text: 'Starting Biquote live endpoint checks…', status: 'info' },
    ];
    setLogs([...nextLogs]);

    const push = (text: string, status: 'info' | 'pass' | 'fail') => {
      nextLogs.push({ id: nextId++, text, status });
      setLogs([...nextLogs]);
    };

    try {
      const active = await biquoteFetchJson<Array<{ name?: string }>>(`${BIQUOTE_BASE_URL}/api/active`);
      if (!Array.isArray(active) || active.length === 0) throw new Error('Empty active list');
      push(`[PASS] GET /api/active -> ${active.length} active symbols`, 'pass');
    } catch (e) {
      push(`[FAIL] GET /api/active -> ${e instanceof Error ? e.message : 'Error'}`, 'fail');
    }

    try {
      const latest = await biquoteFetchJson<Record<string, { mid?: number; marketState?: string }>>(
        `${BIQUOTE_BASE_URL}/api/latest?symbols=EURUSD&symbols=XAUUSD`
      );
      if (!latest?.EURUSD && !latest?.XAUUSD) throw new Error('Missing EURUSD/XAUUSD');
      push(
        `[PASS] GET /api/latest -> EURUSD mid=${latest.EURUSD?.mid ?? 'N/A'}, XAUUSD mid=${latest.XAUUSD?.mid ?? 'N/A'}`,
        'pass'
      );
    } catch (e) {
      push(`[FAIL] GET /api/latest -> ${e instanceof Error ? e.message : 'Error'}`, 'fail');
    }

    try {
      const intervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
      const summary: string[] = [];
      for (const iv of intervals) {
        const res = await biquoteFetchJson<{ bars?: unknown[] }>(
          `${BIQUOTE_BASE_URL}/api/XAUUSD/ohlc?interval=${iv}&limit=10`
        );
        summary.push(`${iv}:${res?.bars?.length ?? 0}`);
      }
      push(`[PASS] GET /api/XAUUSD/ohlc -> ${summary.join(', ')}`, 'pass');
    } catch (e) {
      push(`[FAIL] GET /api/XAUUSD/ohlc -> ${e instanceof Error ? e.message : 'Error'}`, 'fail');
    }

    push(
      hubState === HubConnectionState.CONNECTED
        ? `[PASS] SignalR ${BIQUOTE_HUB_URL} -> State=${hubState}`
        : `[FAIL] SignalR ${BIQUOTE_HUB_URL} -> State=${hubState}`,
      hubState === HubConnectionState.CONNECTED ? 'pass' : 'fail'
    );

    setRunning(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
    >
      <div className="bg-[#121620] border border-[#1e2535] w-full max-w-lg rounded-2xl p-6 relative shadow-2xl max-h-[88vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close diagnostics"
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 id="diagnostics-modal-title" className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Plug className="w-4 h-4 text-amber-400" />
          <span>{t.modalTitle}</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">{t.modalDesc}</p>

        <div className="space-y-3 text-xs font-mono-tabular">
          <div className="p-3 bg-[#080a0f] rounded-lg border border-[#1e2535] space-y-1">
            <div className="text-amber-400 font-bold">REST Endpoints (BIQUOTE):</div>
            <div className="text-slate-300">Active: GET {BIQUOTE_BASE_URL}/api/active</div>
            <div className="text-slate-300">Latest: GET {BIQUOTE_BASE_URL}/api/latest?symbols=...</div>
            <div className="text-slate-300">OHLC: GET {BIQUOTE_BASE_URL}/api/{'{symbol}'}/ohlc?interval=...&amp;limit=300</div>
          </div>

          <div className="p-3 bg-[#080a0f] rounded-lg border border-[#1e2535] space-y-1">
            <div className="text-amber-400 font-bold">SignalR Live Tick Hub:</div>
            <div className="text-slate-300">{BIQUOTE_HUB_URL} (Subscribe / ReceiveTick)</div>
            <div className="text-slate-400">Current Hub State: {hubState}</div>
          </div>

          <div className="p-3 bg-[#080a0f] rounded-lg border border-[#1e2535] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-amber-400 font-bold">Live Browser Self-Test:</span>
              <button
                type="button"
                onClick={runLiveSelfTests}
                disabled={running}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-bold rounded flex items-center gap-1 transition"
              >
                <Play className="w-3 h-3" />
                <span>{running ? 'Running…' : 'Run Tests'}</span>
              </button>
            </div>
            <div className="bg-[#0b0e14] border border-[#1e2535] rounded-lg p-2.5 max-h-44 overflow-y-auto space-y-1 text-[11px]">
              {logs.map((line) => (
                <div
                  key={line.id}
                  className={
                    line.status === 'pass'
                      ? 'text-emerald-400'
                      : line.status === 'fail'
                      ? 'text-red-400'
                      : 'text-slate-300'
                  }
                >
                  {line.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
