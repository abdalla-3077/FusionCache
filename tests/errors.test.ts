import { describe, expect, it } from 'vitest';
import {
  DriverConnectionError,
  DriverNotSupportedError,
  FileDriverError,
  FusionCacheError,
  InvalidTTLInputError,
} from '../src/errors.js';

describe('errors', () => {
  it('FusionCacheError has correct name and message', () => {
    const err = new FusionCacheError('test error');
    expect(err.name).toBe('FusionCacheError');
    expect(err.message).toBe('test error');
    expect(err instanceof Error).toBe(true);
  });

  it('InvalidTTLInputError has correct name', () => {
    const err = new InvalidTTLInputError('bad');
    expect(err.name).toBe('InvalidTTLInputError');
    expect(err.message).toContain('bad');
    expect(err instanceof FusionCacheError).toBe(true);
  });

  it('DriverConnectionError has correct name and preserves cause', () => {
    const cause = new Error('connection refused');
    const err = new DriverConnectionError('redis', cause);
    expect(err.name).toBe('DriverConnectionError');
    expect(err.message).toContain('redis');
    expect(err.cause).toBe(cause);
    expect(err instanceof FusionCacheError).toBe(true);
  });

  it('DriverNotSupportedError has correct name', () => {
    const err = new DriverNotSupportedError('keys', 'memory');
    expect(err.name).toBe('DriverNotSupportedError');
    expect(err.message).toContain('keys');
    expect(err.message).toContain('memory');
    expect(err instanceof FusionCacheError).toBe(true);
  });

  it('FileDriverError has correct name', () => {
    const err = new FileDriverError('file error');
    expect(err.name).toBe('FileDriverError');
    expect(err.message).toBe('file error');
    expect(err instanceof FusionCacheError).toBe(true);
  });
});
