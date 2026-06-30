import { InvalidTTLInputError } from './errors.js';

const MULTIPLIERS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

const TTL_PATTERN = /^(\d+)([smhdw])$/;

export function parseTTL(input: number | string): number {
  if (typeof input === 'number') {
    if (input < 0) throw new InvalidTTLInputError(String(input));
    return input;
  }

  const match = TTL_PATTERN.exec(input);
  if (!match) throw new InvalidTTLInputError(input);

  const value = match[1];
  const unit = match[2];

  if (!value || !unit) throw new InvalidTTLInputError(input);

  const multiplier = MULTIPLIERS[unit];
  if (!multiplier) throw new InvalidTTLInputError(input);

  return Number(value) * multiplier;
}
