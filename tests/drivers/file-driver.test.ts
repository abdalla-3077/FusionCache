import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileDriver } from '../../src/drivers/file-driver.js';

describe('FileDriver', () => {
  let driver: FileDriver;
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'fusion-cache-test-'));
    driver = new FileDriver({ path: testDir, flushInterval: 0 });
    await driver.connect();
  });

  afterEach(async () => {
    await driver.disconnect();
    await rm(testDir, { recursive: true, force: true });
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
      const obj = { name: 'test', count: 42, nested: { a: [1, 2, 3] } };
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
  });

  describe('persistence', () => {
    it('persists data to disk and reloads on connect', async () => {
      await driver.set('key', 'value');
      await driver.disconnect();

      const driver2 = new FileDriver({ path: testDir, flushInterval: 0 });
      await driver2.connect();
      const result = await driver2.get<string>('key');
      expect(result).toBe('value');
      await driver2.disconnect();
    });

    it('persists complex objects', async () => {
      const obj = { name: 'test', data: [1, 2, 3] };
      await driver.set('obj', obj);
      await driver.disconnect();

      const driver2 = new FileDriver({ path: testDir, flushInterval: 0 });
      await driver2.connect();
      const result = await driver2.get<typeof obj>('obj');
      expect(result).toEqual(obj);
      await driver2.disconnect();
    });
  });

  describe('connect/disconnect', () => {
    it('creates directory on connect', async () => {
      const newDir = join(testDir, 'nested', 'cache');
      const d = new FileDriver({ path: newDir, flushInterval: 0 });
      await d.connect();
      await d.set('key', 'value');
      await d.disconnect();

      const d2 = new FileDriver({ path: newDir, flushInterval: 0 });
      await d2.connect();
      expect(await d2.get<string>('key')).toBe('value');
      await d2.disconnect();
    });
  });

  describe('default path', () => {
    it('creates .cache directory by default', async () => {
      const originalCwd = process.cwd();
      const defaultDir = join(originalCwd, '.cache');
      const d = new FileDriver({ flushInterval: 0 });
      await d.connect();
      await d.set('test', 'value');
      await d.disconnect();
      await rm(defaultDir, { recursive: true, force: true });
    });
  });
});
