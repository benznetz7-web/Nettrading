import { InstrumentSpec, LanguageCode, SupportedSymbol, TimeframeKey } from '../types/market';

export const STORAGE_KEYS = {
  history: 'nethaga_signal_history_v6',
  language: 'nethaga_language_v6',
  alerts: 'nethaga_alerts_v6',
  provider: 'nethaga_provider_v6',
  symbol: 'nethaga_active_symbol_v6',
  goldPipMode: 'nethaga_gold_pip_mode_v6',
} as const;

export const BIQUOTE_BASE_URL = 'https://biquote.io';
export const BIQUOTE_HUB_URL = 'https://biquote.io/hubs/tick';
export const STALE_MAX_SECONDS = 300;

export const INSTRUMENT_SPECS: Record<SupportedSymbol, InstrumentSpec> = {
  XAUUSD: {
    symbol: 'XAUUSD',
    group: 'GOLD',
    label: 'Gold / US Dollar',
    defaultDigits: 2,
    pipSize: 0.1,
    defaultPointSize: 0.01,
    pipNote: 'USD movement shown explicitly; broker Gold digits vary (2-digit $0.01 pt vs 3-digit $0.001 pt, standard $0.10 pip).',
  },
  EURUSD: {
    symbol: 'EURUSD',
    group: 'FX',
    label: 'Euro / US Dollar',
    defaultDigits: 5,
    pipSize: 0.0001,
    defaultPointSize: 0.00001,
    pipNote: 'Standard 0.0001 pip (5-digit quote: 0.00001 point).',
  },
  GBPUSD: {
    symbol: 'GBPUSD',
    group: 'FX',
    label: 'British Pound / USD',
    defaultDigits: 5,
    pipSize: 0.0001,
    defaultPointSize: 0.00001,
    pipNote: 'Standard 0.0001 pip (5-digit quote: 0.00001 point).',
  },
  USDJPY: {
    symbol: 'USDJPY',
    group: 'FX',
    label: 'US Dollar / Japanese Yen',
    defaultDigits: 3,
    pipSize: 0.01,
    defaultPointSize: 0.001,
    pipNote: 'Standard 0.01 pip (3-digit quote: 0.001 point).',
  },
  AUDUSD: {
    symbol: 'AUDUSD',
    group: 'FX',
    label: 'Australian Dollar / USD',
    defaultDigits: 5,
    pipSize: 0.0001,
    defaultPointSize: 0.00001,
    pipNote: 'Standard 0.0001 pip (5-digit quote: 0.00001 point).',
  },
  USDCAD: {
    symbol: 'USDCAD',
    group: 'FX',
    label: 'US Dollar / Canadian Dollar',
    defaultDigits: 5,
    pipSize: 0.0001,
    defaultPointSize: 0.00001,
    pipNote: 'Standard 0.0001 pip (5-digit quote: 0.00001 point).',
  },
  USDCHF: {
    symbol: 'USDCHF',
    group: 'FX',
    label: 'US Dollar / Swiss Franc',
    defaultDigits: 5,
    pipSize: 0.0001,
    defaultPointSize: 0.00001,
    pipNote: 'Standard 0.0001 pip (5-digit quote: 0.00001 point).',
  },
  NZDUSD: {
    symbol: 'NZDUSD',
    group: 'FX',
    label: 'New Zealand Dollar / USD',
    defaultDigits: 5,
    pipSize: 0.0001,
    defaultPointSize: 0.00001,
    pipNote: 'Standard 0.0001 pip (5-digit quote: 0.00001 point).',
  },
};

export const SUPPORTED_SYMBOLS: SupportedSymbol[] = Object.keys(INSTRUMENT_SPECS) as SupportedSymbol[];

export const TIMEFRAME_CONFIG: Record<TimeframeKey, { biquote: string; seconds: number; label: string }> = {
  M1: { biquote: '1m', seconds: 60, label: '1m' },
  M5: { biquote: '5m', seconds: 300, label: '5m' },
  M15: { biquote: '15m', seconds: 900, label: '15m' },
  M30: { biquote: '30m', seconds: 1800, label: '30m' },
  H1: { biquote: '1h', seconds: 3600, label: '1h' },
  H4: { biquote: '4h', seconds: 14400, label: '4h' },
  D1: { biquote: '1d', seconds: 86400, label: '1d' },
};

export const TIMEFRAME_ORDER: TimeframeKey[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

export interface TranslationStrings {
  subtitle: string;
  activePair: string;
  marketSessions: string;
  selectTF: string;
  candleClose: string;
  signalRule: string;
  confluenceLabel: string;
  entryPrice: string;
  chartTitle: string;
  signalHistory: string;
  traderTipTitle: string;
  rule1: string;
  rule2: string;
  rule3: string;
  rule4: string;
  modalTitle: string;
  modalDesc: string;
  apiBtn: string;
  refreshBtn: string;
  goldWatchlist: string;
  forexWatchlist: string;
  alertOn: string;
  alertOff: string;
  copySignal: string;
  clearLog: string;
  noSetupYet: string;
  fvgLabel: string;
  structureLabel: string;
  obLabel: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationStrings> = {
  en: {
    subtitle: 'Personal technical analysis workstation • BIQUOTE live feed',
    activePair: 'ACTIVE PAIR',
    marketSessions: 'MARKET SESSIONS (UTC)',
    selectTF: 'Select Candle Timeframe:',
    candleClose: 'NEXT BAR CLOSE IN (UTC)',
    signalRule: 'Confirmed closed candles only',
    confluenceLabel: 'Rule Confluence (Not Win Probability)',
    entryPrice: 'REFERENCE ENTRY',
    chartTitle: 'Price Chart • FVG / BOS / CHoCH / Potential OB',
    signalHistory: 'Saved Signal History',
    traderTipTitle: 'Risk Management Checklist',
    rule1: 'Risk only a small, predefined portion of your account per trade.',
    rule2: 'Wait for the selected candle to close; never act on an unfinished bar.',
    rule3: 'Check spread, quote age, and broker price before placing any order.',
    rule4: 'Do not trade when market is closed, stale, or DATA UNAVAILABLE.',
    modalTitle: 'BIQUOTE Data Source & Live Diagnostics',
    modalDesc: 'Default provider: Biquote (public CORS-enabled REST + SignalR hub, no API key required). Exness MT5 remains unavailable unless your local Windows bridge is running.',
    apiBtn: 'Data Source Info',
    refreshBtn: 'Refresh',
    goldWatchlist: 'Gold Watchlist',
    forexWatchlist: 'Forex Watchlist (Major Pairs)',
    alertOn: '20m Reminder: ON',
    alertOff: '20m Reminder: OFF',
    copySignal: 'Copy Analysis',
    clearLog: 'Clear Log',
    noSetupYet: 'No valid setup — waiting for rule confluence on closed candles.',
    fvgLabel: 'Fair Value Gap (FVG):',
    structureLabel: 'Structure (BOS / CHoCH):',
    obLabel: 'Rule-Based Potential OB:',
  },
  kh: {
    subtitle: 'ផ្ទាំងវិភាគទីផ្សារផ្ទាល់ខ្លួន • ប្រភពទិន្នន័យ BIQUOTE',
    activePair: 'គូរូបិយប័ណ្ណកំពុងវិភាគ',
    marketSessions: 'វគ្គទីផ្សារ (UTC)',
    selectTF: 'ជ្រើសរើស Timeframe ទៀន:',
    candleClose: 'ទៀនបន្ទាប់បិទក្នុង (UTC)',
    signalRule: 'វិភាគតែទៀនដែលបានបិទរួច',
    confluenceLabel: 'កម្រិតស្របគ្នានៃច្បាប់ (មិនមែនភាគរយឈ្នះ)',
    entryPrice: 'តម្លៃចូលយោង',
    chartTitle: 'ក្រាហ្វតម្លៃ • FVG / BOS / CHoCH / Potential OB',
    signalHistory: 'ប្រវត្តិវិភាគដែលបានរក្សាទុក',
    traderTipTitle: 'បញ្ជីត្រួតពិនិត្យការគ្រប់គ្រងហានិភ័យ',
    rule1: 'កំណត់ហានិភ័យត្រឹមចំនួនតូចដែលបានកំណត់ជាមុនក្នុងមួយប្រតិបត្តិការ។',
    rule2: 'រង់ចាំឱ្យទៀនបិទសិន កុំសម្រេចចិត្តលើទៀនដែលមិនទាន់បិទ។',
    rule3: 'ពិនិត្យ Spread អាយុតម្លៃ និងតម្លៃ Broker មុនដាក់បញ្ជា។',
    rule4: 'កុំជួញដូរពេលទីផ្សារបិទ ទិន្នន័យយឺត (Stale) ឬ DATA UNAVAILABLE។',
    modalTitle: 'ប្រភពទិន្នន័យ BIQUOTE និងការត្រួតពិនិត្យ',
    modalDesc: 'ប្រភពលំនាំដើម៖ Biquote (REST + SignalR មិនបាច់ប្រើ API Key)។ EXNESS MT5 មិនដំណើរការទេ លុះត្រាតែមាន Windows bridge ភ្ជាប់។',
    apiBtn: 'ព័ត៌មានប្រភពទិន្នន័យ',
    refreshBtn: 'ផ្ទុកឡើងវិញ',
    goldWatchlist: 'បញ្ជីមាស (Gold)',
    forexWatchlist: 'បញ្ជីរូបិយប័ណ្ណសំខាន់ៗ (Forex)',
    alertOn: 'រំលឹក ២០នាទី: បើក',
    alertOff: 'រំលឹក ២០នាទី: បិទ',
    copySignal: 'ចម្លងការវិភាគ',
    clearLog: 'លុបប្រវត្តិ',
    noSetupYet: 'មិនទាន់មាន Setup ត្រឹមត្រូវ — កំពុងរង់ចាំទៀនបិទ។',
    fvgLabel: 'Fair Value Gap (FVG):',
    structureLabel: 'រចនាសម្ព័ន្ធ (BOS / CHoCH):',
    obLabel: 'Rule-Based Potential OB:',
  },
};
