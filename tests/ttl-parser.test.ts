import { describe, expect, it } from 'vitest';
import { InvalidTTLInputError } from '../src/errors.js';
import { parseTTL } from '../src/ttl-parser.js';

describe('parseTTL', () => {
  it('returns number input directly', () => {
    expect(parseTTL(5000)).toBe(5000);
    expect(parseTTL(0)).toBe(0);
  });

  it('parses seconds', () => {
    expect(parseTTL('5s')).toBe(5000);
    expect(parseTTL('30s')).toBe(30000);
    expect(parseTTL('1s')).toBe(1000);
  });

  it('parses minutes', () => {
    expect(parseTTL('5m')).toBe(300000);
    expect(parseTTL('30m')).toBe(1800000);
    expect(parseTTL('1m')).toBe(60000);
  });

  it('parses hours', () => {
    expect(parseTTL('2h')).toBe(7200000);
    expect(parseTTL('12h')).toBe(43200000);
    expect(parseTTL('1h')).toBe(3600000);
  });

  it('parses days', () => {
    expect(parseTTL('1d')).toBe(86400000);
    expect(parseTTL('7d')).toBe(604800000);
  });

  it('parses weeks', () => {
    expect(parseTTL('1w')).toBe(604800000);
    expect(parseTTL('2w')).toBe(1209600000);
  });

  it('throws on invalid input', () => {
    expect(() => parseTTL('invalid')).toThrow(InvalidTTLInputError);
    expect(() => parseTTL('5x')).toThrow(InvalidTTLInputError);
    expect(() => parseTTL('')).toThrow(InvalidTTLInputError);
    expect(() => parseTTL('abc')).toThrow(InvalidTTLInputError);
    expect(() => parseTTL('5.5s')).toThrow(InvalidTTLInputError);
    expect(() => parseTTL('-5s')).toThrow(InvalidTTLInputError);
  });

  it('throws on negative numbers', () => {
    expect(() => parseTTL(-1)).toThrow(InvalidTTLInputError);
  });
});
