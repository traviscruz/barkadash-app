/**
 * Currency and date formatting helpers matching Philippine peso format (₱).
 */
export const formatCurrency = (amount: number): string => {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateStr: string): string => {
  return dateStr;
};
