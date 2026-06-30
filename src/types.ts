export type HumanTTL =
  | `${number}s`
  | `${number}m`
  | `${number}h`
  | `${number}d`
  | `${number}w`;

export interface CacheSetOptions {
  ttl?: number | HumanTTL;
  tags?: string[];
}

export interface CacheDriver {
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys?(pattern?: string): Promise<string[]>;
}

export interface FusionCacheOptions {
  driver: CacheDriver;
  prefix?: string;
  defaultTTL?: number | HumanTTL;
  namespace?: string;
}

export interface GetOrSetOptions extends CacheSetOptions {}

export interface MemoryDriverOptions {
  maxSize?: number;
  checkInterval?: number;
}

export type FileFormat = 'json' | 'yaml' | 'toml';

export interface FileDriverOptions {
  path?: string;
  format?: FileFormat;
  flushInterval?: number;
}

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt?: number;
  tags?: string[];
}
