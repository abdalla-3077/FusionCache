import { describe, expect, it } from 'vitest';
import {
  DriverConnectionError,
  DriverNotSupportedError,
  FileDriver,
  FileDriverError,
  FusionCache,
  FusionCacheError,
  InvalidTTLInputError,
  MemoryDriver,
  parseTTL,
} from '../src/index.js';

describe('index exports', () => {
  it('exports FusionCache class', () => {
    expect(FusionCache).toBeDefined();
    expect(typeof FusionCache).toBe('function');
  });

  it('exports MemoryDriver class', () => {
    expect(MemoryDriver).toBeDefined();
    expect(typeof MemoryDriver).toBe('function');
  });

  it('exports FileDriver class', () => {
    expect(FileDriver).toBeDefined();
    expect(typeof FileDriver).toBe('function');
  });

  it('exports parseTTL function', () => {
    expect(parseTTL).toBeDefined();
    expect(typeof parseTTL).toBe('function');
    expect(parseTTL('5s')).toBe(5000);
  });

  it('exports error classes', () => {
    expect(FusionCacheError).toBeDefined();
    expect(InvalidTTLInputError).toBeDefined();
    expect(DriverConnectionError).toBeDefined();
    expect(DriverNotSupportedError).toBeDefined();
    expect(FileDriverError).toBeDefined();
  });
});
