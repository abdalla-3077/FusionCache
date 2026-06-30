import { parseTTL } from '../ttl-parser.js';
import type { CacheDriver, CacheSetOptions } from '../types.js';
import type { MemoryDriverOptions } from '../types.js';

interface StoredEntry<T = unknown> {
  value: T;
  expiresAt?: number;
}

export class MemoryDriver implements CacheDriver {
  private store = new Map<string, StoredEntry>();
  private options: Required<MemoryDriverOptions>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: MemoryDriverOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 0,
      checkInterval: options.checkInterval ?? 0,
    };

    if (this.options.checkInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.options.checkInterval,
      );
      if (this.cleanupTimer.unref) this.cleanupTimer.unref();
    }
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(
    key: string,
    value: T,
    options?: CacheSetOptions,
  ): Promise<void> {
    if (
      this.options.maxSize > 0 &&
      !this.store.has(key) &&
      this.store.size >= this.options.maxSize
    ) {
      this.evictOldest();
    }

    let expiresAt: number | undefined;
    if (options?.ttl !== undefined) {
      const ttlMs = parseTTL(options.ttl);
      expiresAt = Date.now() + ttlMs;
    }

    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());

    if (!pattern) return allKeys;

    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return allKeys.filter((key) => regex.test(key));
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== undefined && now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  private evictOldest(): void {
    const firstKey = this.store.keys().next().value;
    if (firstKey !== undefined) {
      this.store.delete(firstKey);
    }
  }
}
