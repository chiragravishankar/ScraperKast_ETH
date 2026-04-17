'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeneralSettings {
  siteName:        string;
  domain:          string;
  description:     string;
  timezone:        string;
  currencyDisplay: 'USD' | 'EUR' | 'GBP';
  dateFormat:      'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  defaultBotAction:'allow' | 'block' | 'pending';
  defaultLicense:  'summarization' | 'training' | 'full_access' | 'custom';
  freeTierEnabled: boolean;
  freeTierLimit:   number;
}

export interface PaymentSettings {
  platformFeePercent:      number; // fixed 5, display only
  minWithdrawal:           number; // USDC
  autoWithdrawEnabled:     boolean;
  autoWithdrawThreshold:   number; // USDC
  withdrawalWallet:        string;
  businessName:            string;
  taxId:                   string;
  billingAddress:          string;
  invoiceEmail:            string;
  generateInvoices:        boolean;
  invoiceFrequency:        'monthly' | 'per_transaction';
}

export interface AutomationSettings {
  autoBlockSuspicious:     boolean;
  suspiciousThresholdRph:  number; // req per hour
  autoAllowVerified:       boolean;
  autoUpgradeToPaid:       boolean;
  lowBalanceAlert:         boolean;
  lowBalanceThreshold:     number; // USDC
  highRevenueAlert:        boolean;
  highRevenueThreshold:    number; // USDC daily
  dailySummaryEmail:       boolean;
  dailySummaryTime:        string; // "09:00"
  weeklyReport:            boolean;
  weeklyReportDay:         string; // "Monday"
  realTimeAlerts:          boolean;
}

export interface APISettings {
  productionKey:      string;
  testKey:            string;
  prodKeyCreated:     number; // ms timestamp
  prodKeyLastUsed:    number;
  webhookUrl:         string;
  webhookSecret:      string;
  webhookEvents:      {
    paymentReceived:     boolean;
    botBlocked:          boolean;
    balanceLow:          boolean;
    withdrawalCompleted: boolean;
  };
  framework:          'express' | 'fastify' | 'nextjs' | 'other';
}

export interface SecuritySettings {
  twoFactorEnabled:   boolean;
  twoFactorMethod:    'sms' | 'authenticator';
  sessionTimeout:     60 | 240 | 1440; // minutes
  ipWhitelistEnabled: boolean;
  allowedIPs:         string[];
  dataRetentionDays:  30 | 60 | 90;
  autoDeleteOldData:  boolean;
}

export interface NotificationSettings {
  email:               string;
  sms:                 string;
  dailySummary:        boolean;
  weeklyReport:        boolean;
  paymentReceived:     boolean;
  withdrawalCompleted: boolean;
  botBlocked:          boolean;
  lowBalance:          boolean;
  highRevenue:         boolean;
  securityAlerts:      boolean;
  quietHoursEnabled:   boolean;
  quietFrom:           string; // "22:00"
  quietTo:             string; // "08:00"
  quietAllowCritical:  boolean;
}

export interface AdvancedSettings {
  debugMode:          boolean;
  verboseLogging:     boolean;
  testMode:           boolean;
  maintenanceMode:    boolean;
  cacheEnabled:       boolean;
  requestLogging:     'full' | 'minimal' | 'none';
  analyticsSampling:  100 | 50 | 10;
  betaFeatures:       boolean;
  betaAIPricing:      boolean;
  betaMultiCurrency:  boolean;
  betaTeamCollab:     boolean;
}

export interface AllSettings {
  general:       GeneralSettings;
  payment:       PaymentSettings;
  automation:    AutomationSettings;
  api:           APISettings;
  security:      SecuritySettings;
  notifications: NotificationSettings;
  advanced:      AdvancedSettings;
}

// ── Seed defaults ─────────────────────────────────────────────────────────────

const OWNER_WALLET    = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

export const SEED_SETTINGS: AllSettings = {
  general: {
    siteName: 'My Blog', domain: 'myblog.com', description: '',
    timezone: 'UTC', currencyDisplay: 'USD', dateFormat: 'MM/DD/YYYY',
    defaultBotAction: 'allow', defaultLicense: 'summarization',
    freeTierEnabled: true, freeTierLimit: 100,
  },
  payment: {
    platformFeePercent: 5, minWithdrawal: 1, autoWithdrawEnabled: true,
    autoWithdrawThreshold: 100, withdrawalWallet: OWNER_WALLET,
    businessName: '', taxId: '', billingAddress: '', invoiceEmail: '',
    generateInvoices: false, invoiceFrequency: 'monthly',
  },
  automation: {
    autoBlockSuspicious: true, suspiciousThresholdRph: 1000,
    autoAllowVerified: true, autoUpgradeToPaid: true,
    lowBalanceAlert: true, lowBalanceThreshold: 10,
    highRevenueAlert: false, highRevenueThreshold: 100,
    dailySummaryEmail: true, dailySummaryTime: '09:00',
    weeklyReport: true, weeklyReportDay: 'Monday',
    realTimeAlerts: false,
  },
  api: {
    productionKey: 'sk_live_scraperkast_abc123xyz456def789ghi',
    testKey:       'sk_test_scraperkast_xyz789abc123def456ghi',
    prodKeyCreated: Date.now() - 30 * 86_400_000,
    prodKeyLastUsed: Date.now() - 2 * 3_600_000,
    webhookUrl: '', webhookSecret: 'whsec_' + Math.random().toString(36).slice(2, 18),
    webhookEvents: { paymentReceived: true, botBlocked: true, balanceLow: false, withdrawalCompleted: true },
    framework: 'express',
  },
  security: {
    twoFactorEnabled: false, twoFactorMethod: 'authenticator',
    sessionTimeout: 240, ipWhitelistEnabled: false, allowedIPs: [],
    dataRetentionDays: 90, autoDeleteOldData: false,
  },
  notifications: {
    email: 'owner@myblog.com', sms: '',
    dailySummary: true, weeklyReport: true, paymentReceived: true,
    withdrawalCompleted: true, botBlocked: false, lowBalance: true,
    highRevenue: false, securityAlerts: true,
    quietHoursEnabled: false, quietFrom: '22:00', quietTo: '08:00', quietAllowCritical: true,
  },
  advanced: {
    debugMode: false, verboseLogging: false, testMode: true,
    maintenanceMode: false, cacheEnabled: true, requestLogging: 'minimal',
    analyticsSampling: 100, betaFeatures: false,
    betaAIPricing: false, betaMultiCurrency: false, betaTeamCollab: false,
  },
};

// ── Context ───────────────────────────────────────────────────────────────────

const LS_KEY = 'sk_settings_v1';

interface SettingsStoreValue {
  settings:      AllSettings;
  dirty:         boolean;
  lastSaved:     number | null;
  update:        <K extends keyof AllSettings>(tab: K, patch: Partial<AllSettings[K]>) => void;
  save:          () => void;
  reset:         () => void;
  exportAll:     () => string;
  importAll:     (json: string) => { ok: boolean; error?: string };
  regenApiKey:   (type: 'production' | 'test') => void;
}

const Ctx = createContext<SettingsStoreValue | null>(null);

function randKey(prefix: string) {
  return `${prefix}_${Array.from({ length: 24 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join('')}`;
}

export function SettingsStoreProvider({ children }: { children: ReactNode }) {
  const [settings,  setSettings]  = useState<AllSettings>(SEED_SETTINGS);
  const [dirty,     setDirty]     = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSettings(JSON.parse(raw) as AllSettings);
    } catch { /* ignore */ }
  }, []);

  const update = useCallback(<K extends keyof AllSettings>(tab: K, patch: Partial<AllSettings[K]>) => {
    setSettings(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
    setDirty(true);
  }, []);

  const save = useCallback(() => {
    setSettings(prev => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(prev)); } catch { /* ignore */ }
      return prev;
    });
    setDirty(false);
    setLastSaved(Date.now());
  }, []);

  const reset = useCallback(() => {
    setSettings(SEED_SETTINGS);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    setDirty(false);
    setLastSaved(null);
  }, []);

  const exportAll = useCallback(() => {
    let current: AllSettings = SEED_SETTINGS;
    setSettings(prev => { current = prev; return prev; });
    return JSON.stringify({ version: 1, settings: current }, null, 2);
  }, []);

  const importAll = useCallback((json: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(json) as { settings?: AllSettings };
      if (!parsed.settings) return { ok: false, error: 'JSON must have a "settings" key.' };
      setSettings(parsed.settings);
      try { localStorage.setItem(LS_KEY, json); } catch { /* ignore */ }
      setDirty(false);
      setLastSaved(Date.now());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, []);

  const regenApiKey = useCallback((type: 'production' | 'test') => {
    setSettings(prev => ({
      ...prev,
      api: {
        ...prev.api,
        ...(type === 'production'
          ? { productionKey: randKey('sk_live_scraperkast'), prodKeyCreated: Date.now() }
          : { testKey: randKey('sk_test_scraperkast') }),
      },
    }));
    setDirty(true);
  }, []);

  return (
    <Ctx.Provider value={{ settings, dirty, lastSaved, update, save, reset, exportAll, importAll, regenApiKey }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings(): SettingsStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be inside <SettingsStoreProvider>');
  return ctx;
}
