export class FusionCacheError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FusionCacheError';
  }
}

export class InvalidTTLInputError extends FusionCacheError {
  constructor(input: string) {
    super(
      `Invalid TTL input: "${input}". Expected format: "5s", "30m", "2h", etc.`,
    );
    this.name = 'InvalidTTLInputError';
  }
}

export class DriverConnectionError extends FusionCacheError {
  constructor(driverName: string, cause?: unknown) {
    super(`Failed to connect ${driverName} driver`, { cause });
    this.name = 'DriverConnectionError';
  }
}

export class DriverNotSupportedError extends FusionCacheError {
  constructor(feature: string, driverName: string) {
    super(`Driver "${driverName}" does not support "${feature}"`);
    this.name = 'DriverNotSupportedError';
  }
}

export class FileDriverError extends FusionCacheError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FileDriverError';
  }
}
