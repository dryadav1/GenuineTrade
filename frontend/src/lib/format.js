export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "Not available";

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString() : "Not available";

export const formatCurrency = (amount, currency = "USD") => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(Number(amount));
};

export const formatScore = (value) =>
  `${Math.round(Number(value || 0) * 100)}%`;
