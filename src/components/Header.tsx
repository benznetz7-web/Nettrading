import React from 'react';
import { Bell, BellOff, Crown, Network, RefreshCw } from 'lucide-react';
import { TranslationStrings } from '../constants/instruments';
import { DataProvider, HubConnectionState, LanguageCode } from '../types/market';

interface HeaderProps {
  t: TranslationStrings;
  provider: DataProvider;
  onProviderChange: (provider: DataProvider) => void;
  statusMessage: string;
  statusTone: 'ok' | 'warn' | 'err';
  hubState: HubConnectionState;
  isRefreshing: boolean;
  onManualRefresh: () => void;
  alertEnabled: boolean;
  alertCountdownText: string;
  onToggleAlert: () => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onOpenModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  t,
  provider,
  onProviderChange,
  statusMessage,
  statusTone,
  hubState,
  isRefreshing,
  onManualRefresh,
  alertEnabled,
  alertCountdownText,
  onToggleAlert,
  language,
  onLanguageChange,
  onOpenModal,
}) => {
  const dotClass =
    statusTone === 'ok'
      ? 'bg-emerald-500 animate-pulse'
      : statusTone === 'err'
      ? 'bg-red-500'
      : 'bg-amber-500 animate-pulse';

  const statusTextClass =
    statusTone === 'ok'
      ? 'text-emerald-400'
      : statusTone === 'err'
      ? 'text-red-400'
      : 'text-amber-400';

  return (
    <header className="bg-[#121620]/95 backdrop-blur-md border-b border-[#1e2535] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-gray-950 font-bold shadow-lg shadow-amber-500/20">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-extrabold text-lg tracking-wide whitespace-nowrap">
                NETHAGA
              </span>
              <span className="text-xs font-mono-tabular text-amber-300/80 whitespace-nowrap">
                Pro Trading Hub
              </span>
            </div>
            <p className="text-xs text-slate-400">{t.subtitle}</p>
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Provider Selector */}
          <div
            className="flex bg-[#080a0f] p-1 rounded-lg border border-[#1e2535]"
            role="group"
            aria-label="Market Data Provider"
          >
            <button
              type="button"
              onClick={() => onProviderChange(DataProvider.BIQUOTE)}
              className={`px-3 py-1.5 text-xs font-mono-tabular font-bold rounded-md transition whitespace-nowrap shrink-0 ${
                provider === DataProvider.BIQUOTE
                  ? 'bg-amber-500 text-gray-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              BIQUOTE
            </button>
            <button
              type="button"
              onClick={() => onProviderChange(DataProvider.EXNESS)}
              className={`px-3 py-1.5 text-xs font-mono-tabular font-bold rounded-md transition whitespace-nowrap shrink-0 ${
                provider === DataProvider.EXNESS
                  ? 'bg-amber-500 text-gray-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EXNESS MT5
            </button>
          </div>

          {/* Connection Telemetry */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#080a0f] border border-[#1e2535] text-xs">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
            <span className={`font-mono-tabular font-medium whitespace-nowrap ${statusTextClass}`}>
              {statusMessage}
            </span>
            {provider === DataProvider.BIQUOTE && (
              <span className="text-[11px] text-slate-500 font-mono-tabular hidden sm:inline">
                · Hub: {hubState}
              </span>
            )}
          </div>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-[#080a0f] hover:bg-[#1e2535] disabled:opacity-60 text-amber-400 text-xs font-bold py-2 px-3 rounded-lg border border-amber-500/30 transition whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{t.refreshBtn}</span>
          </button>

          {/* 20-Min Reminder */}
          <button
            type="button"
            onClick={onToggleAlert}
            className="flex items-center gap-2 bg-[#1e2535]/70 hover:bg-[#1e2535] text-xs font-medium py-2 px-3 rounded-lg border border-slate-700 transition whitespace-nowrap shrink-0"
          >
            {alertEnabled ? (
              <Bell className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="text-slate-200">{alertEnabled ? t.alertOn : t.alertOff}</span>
            <span className="font-mono-tabular text-amber-400 text-xs bg-[#080a0f] px-1.5 py-0.5 rounded">
              {alertCountdownText}
            </span>
          </button>

          {/* Language Switcher */}
          <div className="flex bg-[#080a0f] p-1 rounded-lg border border-[#1e2535]">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap ${
                language === 'en' ? 'bg-amber-500 text-gray-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('kh')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition whitespace-nowrap ${
                language === 'kh' ? 'bg-amber-500 text-gray-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              ខ្មែរ
            </button>
          </div>

          {/* Data Source Info / Diagnostics */}
          <button
            type="button"
            onClick={onOpenModal}
            className="text-xs bg-[#080a0f] hover:bg-[#1e2535] text-slate-200 px-3 py-2 rounded-lg border border-[#1e2535] transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Network className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.apiBtn}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
