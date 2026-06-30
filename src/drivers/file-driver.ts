import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { FileDriverError } from '../errors.js';
import { parseTTL } from '../ttl-parser.js';
import type { CacheDriver, CacheSetOptions, FileFormat } from '../types.js';
import type { FileDriverOptions } from '../types.js';

interface StoredEntry<T = unknown> {
  value: T;
  expiresAt?: number;
  tags?: string[];
}

type YamlModule = typeof import('yaml');
type TomlModule = typeof import('smol-toml');

export class FileDriver implements CacheDriver {
  private dir: string;
  private format: FileFormat;
  private flushInterval: number;
  private flushTimer?: ReturnType<typeof setInterval>;
  private dirty = new Set<string>();
  private cache = new Map<string, StoredEntry>();
  private yamlModule?: YamlModule;
  private tomlModule?: TomlModule;

  constructor(options: FileDriverOptions = {}) {
    this.dir = options.path ?? '.cache';
    this.format = options.format ?? 'json';
    this.flushInterval = options.flushInterval ?? 1000;
  }

  async connect(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await this.loadAll();

    if (this.flushInterval > 0) {
      this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
      if (this.flushTimer.unref) this.flushTimer.unref();
    }
  }

  async disconnect(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.flush();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.dirty.add(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(
    key: string,
    value: T,
    options?: CacheSetOptions,
  ): Promise<void> {
    let expiresAt: number | undefined;
    if (options?.ttl !== undefined) {
      const ttlMs = parseTTL(options.ttl);
      expiresAt = Date.now() + ttlMs;
    }

    this.cache.set(key, { value, expiresAt, tags: options?.tags });
    this.dirty.add(key);
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.dirty.add(key);
      return false;
    }

    this.cache.delete(key);
    this.dirty.add(key);
    return true;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.dirty.add(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    try {
      const files = await readdir(this.dir);
      await Promise.all(
        files
          .filter((f) => f.endsWith(`.${this.format}`))
          .map((f) => unlink(join(this.dir, f)).catch(() => {})),
      );
    } catch {
      // Directory doesn't exist, ignore
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) return allKeys;

    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return allKeys.filter((key) => regex.test(key));
  }

  private filePath(key: string): string {
    let safe = key.replace(/[/\\]/g, '_').replace(/\./g, '_');
    // Truncate long filenames and add hash suffix
    if (safe.length > 200) {
      const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
      safe = `${safe.slice(0, 180)}_${hash}`;
    }
    return join(this.dir, `${safe}.${this.format}`);
  }

  private async loadAll(): Promise<void> {
    try {
      const files = await readdir(this.dir);
      const entries = await Promise.all(
        files
          .filter((f) => f.endsWith(`.${this.format}`))
          .map(async (f) => {
            const key = f.slice(0, -(this.format.length + 1));
            try {
              const raw = await readFile(join(this.dir, f), 'utf-8');
              const entry = await this.parse(raw);
              if (
                entry.expiresAt !== undefined &&
                Date.now() > entry.expiresAt
              ) {
                return null;
              }
              return [key, entry] as const;
            } catch {
              return null;
            }
          }),
      );

      for (const entry of entries) {
        if (entry) this.cache.set(entry[0], entry[1]);
      }
    } catch {
      // Directory doesn't exist yet, will be created in connect()
    }
  }

  private async flush(): Promise<void> {
    if (this.dirty.size === 0) return;

    const keys = Array.from(this.dirty);
    this.dirty.clear();

    await Promise.all(
      keys.map(async (key) => {
        const entry = this.cache.get(key);
        if (entry) {
          await this.writeToFile(key, entry);
        } else {
          await this.deleteFile(key);
        }
      }),
    );
  }

  private async writeToFile(key: string, entry: StoredEntry): Promise<void> {
    const path = this.filePath(key);
    const tmpPath = `${path}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    const content = await this.serialize(entry);
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, path);
  }

  private async deleteFile(key: string): Promise<void> {
    const path = this.filePath(key);
    try {
      await unlink(path);
    } catch {
      // File doesn't exist, ignore
    }
  }

  private async serialize(entry: StoredEntry): Promise<string> {
    switch (this.format) {
      case 'json':
        return JSON.stringify(entry);
      case 'yaml':
        return this.serializeYaml(entry);
      case 'toml':
        return this.serializeToml(entry);
      default:
        return JSON.stringify(entry);
    }
  }

  private async parse(content: string): Promise<StoredEntry> {
    switch (this.format) {
      case 'json':
        return JSON.parse(content) as StoredEntry;
      case 'yaml':
        return this.parseYaml(content);
      case 'toml':
        return this.parseToml(content);
      default:
        return JSON.parse(content) as StoredEntry;
    }
  }

  private async loadYaml(): Promise<YamlModule> {
    if (!this.yamlModule) {
      try {
        this.yamlModule = await import('yaml');
      } catch {
        throw new FileDriverError(
          'YAML format requires the "yaml" package. Install it with: pnpm add yaml',
        );
      }
    }
    return this.yamlModule;
  }

  private async loadToml(): Promise<TomlModule> {
    if (!this.tomlModule) {
      try {
        this.tomlModule = await import('smol-toml');
      } catch {
        throw new FileDriverError(
          'TOML format requires the "smol-toml" package. Install it with: pnpm add smol-toml',
        );
      }
    }
    return this.tomlModule;
  }

  private async serializeYaml(entry: StoredEntry): Promise<string> {
    const yaml = await this.loadYaml();
    return yaml.stringify(entry);
  }

  private async parseYaml(content: string): Promise<StoredEntry> {
    const yaml = await this.loadYaml();
    return yaml.parse(content) as StoredEntry;
  }

  private async serializeToml(entry: StoredEntry): Promise<string> {
    const toml = await this.loadToml();
    const sanitized = this.sanitizeForToml(entry);
    return toml.stringify(sanitized as Record<string, unknown>);
  }

  private sanitizeForToml(value: unknown): unknown {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value
        .filter((v) => v !== null && v !== undefined)
        .map((v) => this.sanitizeForToml(v));
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = this.sanitizeForToml(v);
      }
      return result;
    }
    return value;
  }

  private async parseToml(content: string): Promise<StoredEntry> {
    const toml = await this.loadToml();
    return toml.parse(content) as unknown as StoredEntry;
  }
}
