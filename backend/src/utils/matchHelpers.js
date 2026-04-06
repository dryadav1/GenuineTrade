export const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildExactMatchRegex = (value = "") =>
  new RegExp(`^${escapeRegex(value.trim())}$`, "i");

export const normalizeValue = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenizeValue = (value = "") =>
  normalizeValue(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

export const normalizeCountry = (value = "") => normalizeValue(value);

const synonymGroups = [
  ["turmeric", "turmeric powder", "haldi"],
  ["chilli", "chili", "red chilli", "red chili", "mirchi"],
  ["rice", "basmati rice", "non basmati rice", "basmati"],
  ["tea", "black tea", "green tea"],
  ["cardamom", "elaichi"],
  ["ginger", "ginger powder", "adrak"]
];

const synonymMap = synonymGroups.reduce((map, group) => {
  const normalizedGroup = group.map((item) => normalizeValue(item));

  normalizedGroup.forEach((item) => {
    map[item] = normalizedGroup;
  });

  return map;
}, {});

export const expandSynonyms = (value = "") => {
  const normalized = normalizeValue(value);
  const tokens = tokenizeValue(value);
  const synonymTerms = new Set([normalized, ...tokens]);

  if (synonymMap[normalized]) {
    synonymMap[normalized].forEach((item) => synonymTerms.add(item));
  }

  tokens.forEach((token) => {
    if (synonymMap[token]) {
      synonymMap[token].forEach((item) => synonymTerms.add(item));
    }
  });

  return Array.from(synonymTerms).filter(Boolean);
};

export const createProductSearchTerms = (products = []) => {
  const productValues = Array.isArray(products) ? products : [products];
  const searchTerms = new Set();

  productValues.forEach((product) => {
    expandSynonyms(product).forEach((term) => {
      searchTerms.add(term);
      tokenizeValue(term).forEach((token) => searchTerms.add(token));
    });
  });

  return Array.from(searchTerms).filter(Boolean);
};

export const parseProducts = (products) => {
  if (Array.isArray(products)) {
    return products
      .map((item) => `${item}`.trim())
      .filter(Boolean);
  }

  if (typeof products === "string") {
    return products
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};
