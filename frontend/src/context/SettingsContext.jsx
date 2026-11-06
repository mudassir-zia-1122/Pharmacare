import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as settingsApi from '../api/settings.js';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  // Pharmacy info
  pharmacyName: 'PharmaCare Pharmacy',
  pharmacyAddress: 'Plot 42-B, Commercial Area, Karachi, Pakistan',
  pharmacyPhone: '+92-21-34567890',
  pharmacyLicense: 'DRAP-LIC-KHI-2026-9812',

  // Currency (configurable per business requirement)
  currencyCode: 'PKR',
  currencySymbol: '₨',
  currencyLocale: 'ur-PK',

  // Tax rules (configurable — never hardcoded)
  taxEnabled: false,
  taxLabel: 'GST',
  defaultTaxRate: 0,

  // Receipt
  receiptType: 'pdf',
  showTaxOnReceipt: true,
  receiptFooter: 'Thank you for your visit. Keep all medicines out of reach of children.',

  // Stock alerts
  nearExpiryDays: 90,
  lowStockDefault: 50,

  // Prescription
  prescriptionRequired: true,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isPersisted, setIsPersisted] = useState(false);

  // Load persisted configuration from MySQL on mount
  useEffect(() => {
    let isMounted = true;
    settingsApi.fetchSettings().then(res => {
      if (!isMounted || !res?.data) return;
      const data = res.data;
      setSettings(prev => ({
        ...prev,
        pharmacyName: data.pharmacy_name || prev.pharmacyName,
        pharmacyAddress: data.pharmacy_address || prev.pharmacyAddress,
        pharmacyPhone: data.pharmacy_phone || prev.pharmacyPhone,
        pharmacyLicense: data.pharmacy_drap_license || prev.pharmacyLicense,
        currencyCode: data.currency_code || prev.currencyCode,
        currencySymbol: data.currency_symbol || prev.currencySymbol,
        currencyLocale: data.currency_locale || prev.currencyLocale,
        taxEnabled: data.tax_enabled === 'true' || data.tax_enabled === true,
        taxLabel: data.tax_label || prev.taxLabel,
        defaultTaxRate: parseFloat(data.tax_default_rate) || 0,
        receiptType: data.receipt_default_type || prev.receiptType,
        showTaxOnReceipt: data.receipt_show_tax === 'true' || data.receipt_show_tax === true,
        receiptFooter: data.receipt_footer_note || prev.receiptFooter,
        nearExpiryDays: parseInt(data.near_expiry_days, 10) || 90,
        lowStockDefault: parseInt(data.low_stock_default, 10) || 50,
      }));
      setIsPersisted(true);
    }).catch(() => {
      // Degraded fallback uses local defaults
    });
    return () => { isMounted = false; };
  }, []);

  const updateSettings = useCallback(async (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));

    // Transform camelCase keys to snake_case backend setting_key format
    const dbPayload = {};
    if (updates.pharmacyName !== undefined) dbPayload.pharmacy_name = updates.pharmacyName;
    if (updates.pharmacyAddress !== undefined) dbPayload.pharmacy_address = updates.pharmacyAddress;
    if (updates.pharmacyPhone !== undefined) dbPayload.pharmacy_phone = updates.pharmacyPhone;
    if (updates.pharmacyLicense !== undefined) dbPayload.pharmacy_drap_license = updates.pharmacyLicense;
    if (updates.currencyCode !== undefined) dbPayload.currency_code = updates.currencyCode;
    if (updates.currencySymbol !== undefined) dbPayload.currency_symbol = updates.currencySymbol;
    if (updates.taxEnabled !== undefined) dbPayload.tax_enabled = String(updates.taxEnabled);
    if (updates.taxLabel !== undefined) dbPayload.tax_label = updates.taxLabel;
    if (updates.defaultTaxRate !== undefined) dbPayload.tax_default_rate = String(updates.defaultTaxRate);
    if (updates.nearExpiryDays !== undefined) dbPayload.near_expiry_days = String(updates.nearExpiryDays);
    if (updates.lowStockDefault !== undefined) dbPayload.low_stock_default = String(updates.lowStockDefault);

    if (Object.keys(dbPayload).length > 0) {
      try {
        await settingsApi.updateSettings(dbPayload);
      } catch (e) {
        console.warn('Could not persist settings to server:', e.message);
      }
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isPersisted }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
