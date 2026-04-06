const memoryStore = new Map();
const expiryTimers = new Map();

const clearExpiry = (key) => {
  const timer = expiryTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(key);
  }
};

const scheduleExpiry = (key, ttlSeconds) => {
  clearExpiry(key);

  if (!ttlSeconds) {
    return;
  }

  const timeout = setTimeout(() => {
    memoryStore.delete(key);
    expiryTimers.delete(key);
  }, ttlSeconds * 1000);

  expiryTimers.set(key, timeout);
};

export const cacheService = {
  driver: process.env.CACHE_DRIVER || "memory",

  async get(key) {
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  },

  async set(key, value, ttlSeconds = null) {
    memoryStore.set(key, value);
    scheduleExpiry(key, ttlSeconds);
    return value;
  },

  async delete(key) {
    clearExpiry(key);
    memoryStore.delete(key);
  },

  async increment(key, amount = 1) {
    const current = Number((await this.get(key)) || 0);
    const next = current + amount;
    memoryStore.set(key, next);
    return next;
  },

  async decrement(key, amount = 1) {
    const current = Number((await this.get(key)) || 0);
    const next = Math.max(current - amount, 0);
    memoryStore.set(key, next);
    return next;
  }
};
