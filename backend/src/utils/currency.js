export const normalizeCurrency = (currency = "USD") =>
  currency.toString().trim().toUpperCase();

export const toMinorUnits = (amount, currency = "USD") => {
  const normalizedCurrency = normalizeCurrency(currency);
  const zeroDecimalCurrencies = new Set(["JPY", "KRW"]);

  if (zeroDecimalCurrencies.has(normalizedCurrency)) {
    return Math.round(amount);
  }

  return Math.round(amount * 100);
};
