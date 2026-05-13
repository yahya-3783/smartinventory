import { format as dateFnsFormat } from "date-fns";

export const formatDate = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(d, "dd/MM/yyyy");
};

export const formatCurrency = (amount: number, symbol: string = "ETB") =>
  `${symbol} ${amount.toFixed(2)}`;
