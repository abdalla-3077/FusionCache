import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryDriver } from '../../src/drivers/memory-driver.js';

describe('MemoryDriver', () => {
  let driver: MemoryDriver;

  beforeEach(() => {
    driver = new MemoryDriver();
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  describe('basic operations', () => {
    it('stores and retrieves values', async () => {
      await driver.set('key', 'value');
      const result = await driver.get<string>('key');
      expect(result).toBe('value');
    });

    it('returns null for missing keys', async () => {
      const result = await driver.get<string>('missing');
      expect(result).toBeNull();
    });

    it('stores complex objects', async () => {
      const obj = { name: 'test', nested: { a: [1, 2, 3] } };
      await driver.set('obj', obj);
      const result = await driver.get<typeof obj>('obj');
      expect(result).toEqual(obj);
    });

    it('deletes keys', async () => {
      await driver.set('key', 'value');
      const deleted = await driver.delete('key');
      expect(deleted).toBe(true);
      expect(await driver.get('key')).toBeNull();
    });

    it('returns false when deleting non-existent keys', async () => {
      const deleted = await driver.delete('missing');
      expect(deleted).toBe(false);
    });

    it('checks key existence', async () => {
      await driver.set('key', 'value');
      expect(await driver.has('key')).toBe(true);
      expect(await driver.has('missing')).toBe(false);
    });

    it('clears all entries', async () => {
      await driver.set('a', 1);
      await driver.set('b', 2);
      await driver.clear();
      expect(await driver.has('a')).toBe(false);
      expect(await driver.has('b')).toBe(false);
    });

    it('lists all keys', async () => {
      await driver.set('a', 1);
      await driver.set('b', 2);
      await driver.set('c', 3);
      const keys = await driver.keys();
      expect(keys.sort()).toEqual(['a', 'b', 'c']);
    });

    it('lists keys with pattern', async () => {
      await driver.set('user:1', 1);
      await driver.set('user:2', 2);
      await driver.set('post:1', 3);
      const keys = await driver.keys('user:*');
      expect(keys.sort()).toEqual(['user:1', 'user:2']);
    });
  });

  describe('TTL', () => {
    it('expires entries after TTL', async () => {
      await driver.set('key', 'value', { ttl: 100 });
      expect(await driver.get<string>('key')).toBe('value');

      await new Promise((r) => setTimeout(r, 150));
      expect(await driver.get<string>('key')).toBeNull();
    });

    it('has() returns false for expired entries', async () => {
      await driver.set('key', 'value', { ttl: 100 });
      expect(await driver.has('key')).toBe(true);

      await new Promise((r) => setTimeout(r, 150));
      expect(await driver.has('key')).toBe(false);
    });

    it('delete() returns false for expired entries', async () => {
      await driver.set('key', 'value', { ttl: 100 });
      await new Promise((r) => setTimeout(r, 150));
      const deleted = await driver.delete('key');
      expect(deleted).toBe(false);
    });
  });

  describe('maxSize', () => {
    it('evicts oldest when maxSize reached', async () => {
      const limited = new MemoryDriver({ maxSize: 3 });
      await limited.set('a', 1);
      await limited.set('b', 2);
      await limited.set('c', 3);
      await limited.set('d', 4);

      expect(await limited.has('a')).toBe(false);
      expect(await limited.has('b')).toBe(true);
      expect(await limited.has('c')).toBe(true);
      expect(await limited.has('d')).toBe(true);

      await limited.disconnect();
    });

    it('does not evict when under maxSize', async () => {
      const limited = new MemoryDriver({ maxSize: 5 });
      await limited.set('a', 1);
      await limited.set('b', 2);
      expect(await limited.has('a')).toBe(true);
      expect(await limited.has('b')).toBe(true);
      await limited.disconnect();
    });
  });

  describe('periodic cleanup', () => {
    it('cleans up expired entries periodically', async () => {
      const cleaning = new MemoryDriver({ checkInterval: 50 });
      await cleaning.set('key', 'value', { ttl: 50 });

      expect(await cleaning.get<string>('key')).toBe('value');
      await new Promise((r) => setTimeout(r, 120));
      expect(await cleaning.get<string>('key')).toBeNull();

      await cleaning.disconnect();
    });
  });

  describe('connect/disconnect', () => {
    it('connect and disconnect are no-ops', async () => {
      await driver.connect();
      await driver.disconnect();
    });
  });
});
