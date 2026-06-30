import { parseTTL } from './ttl-parser.js';
import type {
  CacheDriver,
  CacheSetOptions,
  FusionCacheOptions,
  GetOrSetOptions,
} from './types.js';

export class FusionCache {
  private driver: CacheDriver;
  private prefix: string;
  private defaultTTL?: number;

  constructor(options: FusionCacheOptions) {
    this.driver = options.driver;
    this.prefix = options.prefix ?? '';
    if (options.defaultTTL !== undefined) {
      this.defaultTTL = parseTTL(options.defaultTTL);
    }
  }

  private formatKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  private resolveTTL(options?: CacheSetOptions): number | undefined {
    if (options?.ttl !== undefined) return parseTTL(options.ttl);
    return this.defaultTTL;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.driver.get<T>(this.formatKey(key));
  }

  async set<T>(
    key: string,
    value: T,
    options?: CacheSetOptions,
  ): Promise<void> {
    const ttl = this.resolveTTL(options);
    await this.driver.set(this.formatKey(key), value, {
      ...options,
      ttl,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.driver.delete(this.formatKey(key));
  }

  async has(key: string): Promise<boolean> {
    return this.driver.has(this.formatKey(key));
  }

  async clear(): Promise<void> {
    return this.driver.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    if (!this.driver.keys) return [];
    const prefixPattern = this.prefix
      ? `${this.prefix}:${pattern ?? '*'}`
      : pattern;
    return this.driver.keys(prefixPattern);
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: GetOrSetOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async connect(): Promise<void> {
    if (this.driver.connect) await this.driver.connect();
  }

  async disconnect(): Promise<void> {
    if (this.driver.disconnect) await this.driver.disconnect();
  }
}
