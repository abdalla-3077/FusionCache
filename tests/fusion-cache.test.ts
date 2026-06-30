import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryDriver } from '../src/drivers/memory-driver.js';
import { FusionCache } from '../src/fusion-cache.js';

describe('FusionCache', () => {
  let driver: MemoryDriver;
  let cache: FusionCache;

  beforeEach(() => {
    driver = new MemoryDriver();
    cache = new FusionCache({ driver });
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  describe('basic operations', () => {
    it('stores and retrieves values', async () => {
      await cache.set('key', 'value');
      const result = await cache.get<string>('key');
      expect(result).toBe('value');
    });

    it('returns null for missing keys', async () => {
      const result = await cache.get<string>('missing');
      expect(result).toBeNull();
    });

    it('stores complex objects', async () => {
      const obj = { name: 'test', count: 42, nested: { a: 1 } };
      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');
      expect(result).toEqual(obj);
    });

    it('stores arrays', async () => {
      const arr = [1, 2, 3, 'a', 'b'];
      await cache.set('arr', arr);
      const result = await cache.get<typeof arr>('arr');
      expect(result).toEqual(arr);
    });

    it('overwrites existing values', async () => {
      await cache.set('key', 'first');
      await cache.set('key', 'second');
      const result = await cache.get<string>('key');
      expect(result).toBe('second');
    });

    it('deletes keys', async () => {
      await cache.set('key', 'value');
      const deleted = await cache.delete('key');
      expect(deleted).toBe(true);
      const result = await cache.get<string>('key');
      expect(result).toBeNull();
    });

    it('returns false when deleting non-existent keys', async () => {
      const deleted = await cache.delete('missing');
      expect(deleted).toBe(false);
    });

    it('checks key existence', async () => {
      await cache.set('key', 'value');
      expect(await cache.has('key')).toBe(true);
      expect(await cache.has('missing')).toBe(false);
    });

    it('clears all entries', async () => {
      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.set('c', 3);
      await cache.clear();
      expect(await cache.has('a')).toBe(false);
      expect(await cache.has('b')).toBe(false);
      expect(await cache.has('c')).toBe(false);
    });

    it('lists keys', async () => {
      await cache.set('a', 1);
      await cache.set('b', 2);
      await cache.set('c', 3);
      const keys = await cache.keys();
      expect(keys.sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('prefix', () => {
    it('namespaces keys with prefix', async () => {
      const prefixed = new FusionCache({ driver, prefix: 'app' });
      await prefixed.set('key', 'value');
      expect(await prefixed.get<string>('key')).toBe('value');
      expect(await driver.get<string>('app:key')).toBe('value');
    });

    it('isolates prefixed caches', async () => {
      const cache1 = new FusionCache({ driver, prefix: 'v1' });
      const cache2 = new FusionCache({ driver, prefix: 'v2' });
      await cache1.set('key', 'first');
      await cache2.set('key', 'second');
      expect(await cache1.get<string>('key')).toBe('first');
      expect(await cache2.get<string>('key')).toBe('second');
    });
  });

  describe('TTL', () => {
    it('expires entries after TTL', async () => {
      await cache.set('key', 'value', { ttl: '1s' });
      expect(await cache.get<string>('key')).toBe('value');
    });

    it('accepts number TTL', async () => {
      await cache.set('key', 'value', { ttl: 60000 });
      expect(await cache.get<string>('key')).toBe('value');
    });

    it('uses default TTL', async () => {
      const cached = new FusionCache({ driver, defaultTTL: '1h' });
      await cached.set('key', 'value');
      expect(await cached.get<string>('key')).toBe('value');
    });

    it('per-key TTL overrides default', async () => {
      const cached = new FusionCache({ driver, defaultTTL: '1h' });
      await cached.set('key', 'value', { ttl: '5s' });
      expect(await cached.get<string>('key')).toBe('value');
    });
  });

  describe('getOrSet', () => {
    it('returns cached value if exists', async () => {
      await cache.set('key', 'cached');
      const result = await cache.getOrSet('key', async () => 'factory');
      expect(result).toBe('cached');
    });

    it('calls factory and caches result on miss', async () => {
      let called = false;
      const result = await cache.getOrSet('key', async () => {
        called = true;
        return 'factory';
      });
      expect(called).toBe(true);
      expect(result).toBe('factory');
      expect(await cache.get<string>('key')).toBe('factory');
    });

    it('passes options to set on miss', async () => {
      await cache.getOrSet('key', async () => 'value', { ttl: '5s' });
      expect(await cache.get<string>('key')).toBe('value');
    });
  });

  describe('generic type safety', () => {
    interface User {
      id: number;
      name: string;
    }

    it('preserves generic types', async () => {
      const user: User = { id: 1, name: 'Alice' };
      await cache.set<User>('user:1', user);
      const result = await cache.get<User>('user:1');
      expect(result).toEqual(user);
      expect(result?.name).toBe('Alice');
    });
  });
});
