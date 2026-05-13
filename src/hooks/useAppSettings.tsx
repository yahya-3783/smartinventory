import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppSettings {
  appName: string;
  currencySymbol: string;
  defaultStockThreshold: number;
  loading: boolean;
  refetch: () => Promise<void>;
  updateSettings: (settings: Partial<Pick<AppSettings, "appName" | "currencySymbol" | "defaultStockThreshold">>) => Promise<boolean>;
}

const defaults = {
  appName: "Smart Inventory and Customer Insight System",
  currencySymbol: "ETB",
  defaultStockThreshold: 10,
};

const AppSettingsContext = createContext<AppSettings>({
  ...defaults,
  loading: true,
  refetch: async () => {},
  updateSettings: async () => false,
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [appName, setAppName] = useState(defaults.appName);
  const [currencySymbol, setCurrencySymbol] = useState(defaults.currencySymbol);
  const [defaultStockThreshold, setDefaultStockThreshold] = useState(defaults.defaultStockThreshold);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("key, value");
    if (data) {
      data.forEach((row: any) => {
        if (row.key === "app_name") setAppName(row.value);
        if (row.key === "currency_symbol") setCurrencySymbol(row.value);
        if (row.key === "default_stock_threshold") setDefaultStockThreshold(Number(row.value));
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  const updateSettings = async (settings: Partial<Pick<AppSettings, "appName" | "currencySymbol" | "defaultStockThreshold">>) => {
    const updates: { key: string; value: string }[] = [];
    if (settings.appName !== undefined) updates.push({ key: "app_name", value: settings.appName });
    if (settings.currencySymbol !== undefined) updates.push({ key: "currency_symbol", value: settings.currencySymbol });
    if (settings.defaultStockThreshold !== undefined) updates.push({ key: "default_stock_threshold", value: String(settings.defaultStockThreshold) });

    for (const u of updates) {
      const { error } = await supabase.from("app_settings").update({ value: u.value }).eq("key", u.key);
      if (error) return false;
    }

    await fetchSettings();
    return true;
  };

  return (
    <AppSettingsContext.Provider value={{ appName, currencySymbol, defaultStockThreshold, loading, refetch: fetchSettings, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export const useAppSettings = () => useContext(AppSettingsContext);
