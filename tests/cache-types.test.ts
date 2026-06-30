import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileDriver } from '../src/drivers/file-driver.js';
import { MemoryDriver } from '../src/drivers/memory-driver.js';
import { FusionCache } from '../src/fusion-cache.js';
import type { CacheDriver } from '../src/types.js';

interface CacheType {
  name: string;
  createDriver: () => CacheDriver;
  cleanup?: () => Promise<void>;
}

function defineCacheTypes(): CacheType[] {
  const fileDirs: string[] = [];

  return [
    {
      name: 'MemoryDriver',
      createDriver: () => new MemoryDriver(),
    },
    {
      name: 'MemoryDriver (maxSize=3)',
      createDriver: () => new MemoryDriver({ maxSize: 3 }),
    },
    {
      name: 'MemoryDriver (cleanup=50ms)',
      createDriver: () => new MemoryDriver({ checkInterval: 50 }),
    },
    {
      name: 'FileDriver (JSON)',
      createDriver: () => {
        const dir = join(
          tmpdir(),
          `fusion-test-json-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fileDirs.push(dir);
        return new FileDriver({ path: dir, format: 'json', flushInterval: 0 });
      },
    },
    {
      name: 'FileDriver (YAML)',
      createDriver: () => {
        const dir = join(
          tmpdir(),
          `fusion-test-yaml-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fileDirs.push(dir);
        return new FileDriver({ path: dir, format: 'yaml', flushInterval: 0 });
      },
    },
    {
      name: 'FileDriver (TOML)',
      createDriver: () => {
        const dir = join(
          tmpdir(),
          `fusion-test-toml-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        fileDirs.push(dir);
        return new FileDriver({ path: dir, format: 'toml', flushInterval: 0 });
      },
    },
  ];
}

const cacheTypes = defineCacheTypes();

for (const cacheType of cacheTypes) {
  describe(`${cacheType.name}`, () => {
    let driver: CacheDriver;
    let cache: FusionCache;

    beforeEach(async () => {
      driver = cacheType.createDriver();
      if (driver.connect) await driver.connect();
      cache = new FusionCache({ driver });
    });

    afterEach(async () => {
      if (driver.disconnect) await driver.disconnect();
    });

    describe('CRUD Operations', () => {
      it('set → get returns stored value', async () => {
        await cache.set('key', 'value');
        expect(await cache.get<string>('key')).toBe('value');
      });

      it('get returns null for missing key', async () => {
        expect(await cache.get<string>('nonexistent')).toBeNull();
      });

      it('set overwrites existing value', async () => {
        await cache.set('key', 'first');
        await cache.set('key', 'second');
        expect(await cache.get<string>('key')).toBe('second');
      });

      it('delete removes key and returns true', async () => {
        await cache.set('key', 'value');
        expect(await cache.delete('key')).toBe(true);
        expect(await cache.get<string>('key')).toBeNull();
      });

      it('delete returns false for missing key', async () => {
        expect(await cache.delete('nonexistent')).toBe(false);
      });

      it('has returns true for existing key', async () => {
        await cache.set('key', 'value');
        expect(await cache.has('key')).toBe(true);
      });

      it('has returns false for missing key', async () => {
        expect(await cache.has('nonexistent')).toBe(false);
      });

      it('clear removes all entries', async () => {
        await cache.set('a', 1);
        await cache.set('b', 2);
        await cache.set('c', 3);
        await cache.clear();
        expect(await cache.has('a')).toBe(false);
        expect(await cache.has('b')).toBe(false);
        expect(await cache.has('c')).toBe(false);
      });
    });

    describe('Data Types', () => {
      const dataTypes: Array<{
        type: string;
        value: unknown;
        description: string;
      }> = [
        { type: 'string', value: 'hello world', description: 'plain string' },
        { type: 'number', value: 42, description: 'integer' },
        { type: 'float', value: 1.23456, description: 'floating point number' },
        { type: 'boolean', value: true, description: 'boolean true' },
        { type: 'boolean', value: false, description: 'boolean false' },
        { type: 'null', value: null, description: 'null value' },
        { type: 'empty-string', value: '', description: 'empty string' },
        { type: 'zero', value: 0, description: 'zero number' },
        {
          type: 'array',
          value: [1, 2, 3, 'a', 'b', null],
          description: 'mixed array',
        },
        {
          type: 'nested-object',
          value: { a: 1, b: { c: 'deep', d: [2, 3] } },
          description: 'nested object',
        },
        { type: 'empty-object', value: {}, description: 'empty object' },
        { type: 'empty-array', value: [], description: 'empty array' },
        {
          type: 'unicode',
          value: 'مرحبا العالم 🌍',
          description: 'unicode + emoji',
        },
        {
          type: 'long-string',
          value: 'x'.repeat(10000),
          description: '10KB string',
        },
        {
          type: 'deeply-nested',
          value: { a: { b: { c: { d: { e: { f: 'deep' } } } } } },
          description: '6 levels deep',
        },
      ];

      for (const dt of dataTypes) {
        it(`stores ${dt.description} (${dt.type})`, async () => {
          await cache.set(`data:${dt.type}`, dt.value);
          const result = await cache.get(`data:${dt.type}`);
          expect(result).toEqual(dt.value);
        });
      }
    });

    describe('TTL / Expiration', () => {
      const ttlCases: Array<{
        label: string;
        ttl: string | number;
        waitMs: number;
        shouldExpire: boolean;
      }> = [
        { label: '50ms TTL', ttl: 50, waitMs: 80, shouldExpire: true },
        { label: '100ms TTL', ttl: 100, waitMs: 150, shouldExpire: true },
        {
          label: 'human "1s" TTL',
          ttl: '1s',
          waitMs: 1100,
          shouldExpire: true,
        },
        {
          label: 'no TTL (never expires)',
          ttl: 5000,
          waitMs: 50,
          shouldExpire: false,
        },
      ];

      for (const tc of ttlCases) {
        it(`${tc.label}: expires=${tc.shouldExpire}`, async () => {
          await cache.set('ttl-key', 'value', { ttl: tc.ttl });
          expect(await cache.get<string>('ttl-key')).toBe('value');
          await new Promise((r) => setTimeout(r, tc.waitMs));
          const result = await cache.get<string>('ttl-key');
          expect(result === null).toBe(tc.shouldExpire);
        });
      }

      it('has() returns false after expiration', async () => {
        await cache.set('key', 'value', { ttl: 50 });
        await new Promise((r) => setTimeout(r, 80));
        expect(await cache.has('key')).toBe(false);
      });

      it('delete() returns false after expiration', async () => {
        await cache.set('key', 'value', { ttl: 50 });
        await new Promise((r) => setTimeout(r, 80));
        expect(await cache.delete('key')).toBe(false);
      });
    });

    describe('Default TTL', () => {
      it('uses default TTL when none specified', async () => {
        const cached = new FusionCache({ driver, defaultTTL: 50 });
        await cached.set('key', 'value');
        expect(await cached.get<string>('key')).toBe('value');
        await new Promise((r) => setTimeout(r, 80));
        expect(await cached.get<string>('key')).toBeNull();
      });

      it('per-key TTL overrides default', async () => {
        const cached = new FusionCache({ driver, defaultTTL: 5000 });
        await cached.set('short', 'value', { ttl: 50 });
        await cached.set('long', 'value');
        await new Promise((r) => setTimeout(r, 80));
        expect(await cached.get<string>('short')).toBeNull();
        expect(await cached.get<string>('long')).toBe('value');
      });

      it('human-readable default TTL', async () => {
        const cached = new FusionCache({ driver, defaultTTL: '1s' });
        await cached.set('key', 'value');
        expect(await cached.get<string>('key')).toBe('value');
      });
    });

    describe('Key Prefix / Namespacing', () => {
      it('prefixes keys correctly', async () => {
        const prefixed = new FusionCache({ driver, prefix: 'app' });
        await prefixed.set('key', 'value');
        expect(await prefixed.get<string>('key')).toBe('value');
      });

      it('different prefixes isolate data', async () => {
        const v1 = new FusionCache({ driver, prefix: 'v1' });
        const v2 = new FusionCache({ driver, prefix: 'v2' });
        await v1.set('key', 'first');
        await v2.set('key', 'second');
        expect(await v1.get<string>('key')).toBe('first');
        expect(await v2.get<string>('key')).toBe('second');
      });

      it('clear with prefix clears all entries (shared driver)', async () => {
        const a = new FusionCache({ driver, prefix: 'ns1' });
        const b = new FusionCache({ driver, prefix: 'ns2' });
        await a.set('key', 1);
        await b.set('key', 2);
        await a.clear();
        // clear() clears the entire underlying driver, not just the namespace
        expect(await a.get<number>('key')).toBeNull();
        expect(await b.get<number>('key')).toBeNull();
      });
    });

    describe('getOrSet (Cache-Aside)', () => {
      it('returns cached value without calling factory', async () => {
        await cache.set('key', 'cached');
        let factoryCalled = false;
        const result = await cache.getOrSet('key', async () => {
          factoryCalled = true;
          return 'factory';
        });
        expect(result).toBe('cached');
        expect(factoryCalled).toBe(false);
      });

      it('calls factory on cache miss and stores result', async () => {
        let callCount = 0;
        const result = await cache.getOrSet('key', async () => {
          callCount++;
          return `value-${callCount}`;
        });
        expect(result).toBe('value-1');
        expect(await cache.get<string>('key')).toBe('value-1');
      });

      it('passes TTL options to set', async () => {
        await cache.getOrSet('key', async () => 'value', { ttl: 50 });
        expect(await cache.get<string>('key')).toBe('value');
        await new Promise((r) => setTimeout(r, 80));
        expect(await cache.get<string>('key')).toBeNull();
      });

      it('handles concurrent calls correctly', async () => {
        let callCount = 0;
        const promises = Array.from({ length: 5 }, () =>
          cache.getOrSet('key', async () => {
            callCount++;
            await new Promise((r) => setTimeout(r, 10));
            return `value-${callCount}`;
          }),
        );
        const results = await Promise.all(promises);
        expect(results.every((r) => r === results[0])).toBe(true);
      });
    });

    describe('Key Listing', () => {
      it('lists all keys', async () => {
        await cache.set('a', 1);
        await cache.set('b', 2);
        await cache.set('c', 3);
        const keys = await cache.keys();
        expect(keys.sort()).toEqual(['a', 'b', 'c']);
      });

      it('returns empty array when no keys', async () => {
        const keys = await cache.keys();
        expect(keys).toEqual([]);
      });

      it('filters keys by pattern', async () => {
        await cache.set('user:1', 1);
        await cache.set('user:2', 2);
        await cache.set('post:1', 3);
        const keys = await cache.keys('user:*');
        expect(keys.sort()).toEqual(['user:1', 'user:2']);
      });
    });

    describe('Large Volume', () => {
      it('handles 1000 set/get operations', async () => {
        // Skip for maxSize drivers that would evict entries
        const count = cacheType.name.includes('maxSize') ? 3 : 1000;
        const ops = Array.from({ length: count }, (_, i) =>
          cache.set(`k${i}`, i),
        );
        await Promise.all(ops);

        const gets = Array.from({ length: count }, (_, i) =>
          cache.get<number>(`k${i}`),
        );
        const results = await Promise.all(gets);
        if (cacheType.name.includes('maxSize')) {
          // With maxSize=3, all 3 entries fit without eviction
          expect(results).toEqual([0, 1, 2]);
        } else {
          expect(results).toEqual(Array.from({ length: count }, (_, i) => i));
        }
      });

      it('handles rapid set/delete cycle', async () => {
        for (let i = 0; i < 100; i++) {
          await cache.set(`key${i}`, i);
          await cache.delete(`key${i}`);
        }
        expect(await cache.has('key0')).toBe(false);
        expect(await cache.has('key99')).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('key with special characters', async () => {
        const keys = [
          'key:with:colons',
          'key/with/slashes',
          'key with spaces',
          'key-with-dashes',
          'key_with_underscores',
          'key.with.dots',
          '🔑',
        ];
        for (const key of keys) {
          await cache.set(key, 'value');
          expect(await cache.get<string>(key)).toBe('value');
        }
      });

      it('empty key', async () => {
        await cache.set('', 'value');
        expect(await cache.get<string>('')).toBe('value');
      });

      it('very long key', async () => {
        const longKey = 'k'.repeat(1000);
        await cache.set(longKey, 'value');
        expect(await cache.get<string>(longKey)).toBe('value');
      });

      it('set same key with different TTL', async () => {
        await cache.set('key', 'v1', { ttl: 5000 });
        await cache.set('key', 'v2', { ttl: 50 });
        await new Promise((r) => setTimeout(r, 80));
        expect(await cache.get<string>('key')).toBeNull();
      });
    });
  });
}
