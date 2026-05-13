import { useAppSettings } from "@/hooks/useAppSettings";
import { formatCurrency as formatCurrencyBase } from "@/lib/formatters";
import { useCallback } from "react";

export function useCurrency() {
  const { currencySymbol } = useAppSettings();
  const format = useCallback(
    (amount: number) => formatCurrencyBase(amount, currencySymbol),
    [currencySymbol]
  );
  return { formatCurrency: format, currencySymbol };
}
