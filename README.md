# fusion-cache

Modern, extensible, driver-based caching framework for Node.js and Bun.

TypeScript-first. Zero runtime dependencies. Beautiful developer experience.

## Features

- **TypeScript First** — Full type safety with generics and IntelliSense
- **Zero Runtime Dependencies** — Optional peer deps for YAML/TOML formats only
- **Driver-Based Architecture** — Pluggable cache backends
- **Human-Readable TTL** — `"5s"`, `"30m"`, `"2h"`, `"1d"`, `"1w"`
- **ESM + CJS** — Dual module support
- **Tree-Shakable** — Only import what you use
- **Async-First API** — Promise-based throughout

## Install

```bash
npm install fusion-cache
# or
pnpm add fusion-cache
# or
yarn add fusion-cache
```

## Quick Start

```typescript
import { FusionCache, MemoryDriver } from 'fusion-cache';

const cache = new FusionCache({
  driver: new MemoryDriver(),
});

// Store with human-readable TTL
await cache.set('user:1', { id: 1, name: 'Alice' }, { ttl: '30m' });

// Retrieve typed values
const user = await cache.get<{ id: number; name: string }>('user:1');

// Check existence
if (await cache.has('user:1')) {
  console.log('User cached');
}

// Delete
await cache.delete('user:1');

// Clear all
await cache.clear();
```

## Drivers

### Memory Driver

In-memory cache using `Map`. Zero configuration.

```typescript
import { MemoryDriver } from 'fusion-cache';

const driver = new MemoryDriver({
  maxSize: 1000,       // Max entries (0 = unlimited)
  checkInterval: 60000 // Cleanup interval in ms (0 = no periodic cleanup)
});
```

### File Driver

Persists cache to the filesystem. Supports JSON (built-in), YAML, and TOML.

```typescript
import { FileDriver } from 'fusion-cache';

const driver = new FileDriver({
  path: '.cache',           // Directory path (default: '.cache')
  format: 'json',           // 'json' | 'yaml' | 'toml'
  flushInterval: 1000       // Debounce interval in ms
});

await driver.connect(); // Creates directory and loads existing cache
```

For YAML or TOML support, install the optional peer dependency:

```bash
pnpm add yaml      # For YAML format
pnpm add smol-toml # For TOML format
```

## API

### `FusionCache`

```typescript
const cache = new FusionCache({
  driver: memoryDriver,
  prefix: 'app',         // Key prefix for namespacing
  defaultTTL: '1h',      // Default TTL for all entries
});
```

#### Methods

| Method | Description |
|--------|-------------|
| `get<T>(key)` | Retrieve a cached value |
| `set<T>(key, value, options?)` | Store a value |
| `delete(key)` | Remove a key |
| `has(key)` | Check if key exists |
| `clear()` | Remove all entries |
| `keys(pattern?)` | List keys (supports `*` wildcard) |
| `getOrSet<T>(key, factory, options?)` | Cache-aside pattern |
| `connect()` | Initialize driver |
| `disconnect()` | Clean up driver |

### TTL

Human-readable durations:

| Format | Meaning |
|--------|---------|
| `"5s"` | 5 seconds |
| `"30m"` | 30 minutes |
| `"2h"` | 2 hours |
| `"1d"` | 1 day |
| `"1w"` | 1 week |

Or pass milliseconds directly: `5000`.

### Cache-Aside Pattern

```typescript
const user = await cache.getOrSet(
  `user:${id}`,
  async () => await db.users.findById(id),
  { ttl: '5m' }
);
```

### Namespacing

```typescript
const userCache = new FusionCache({ driver, prefix: 'users' });
const postCache = new FusionCache({ driver, prefix: 'posts' });

await userCache.set('1', userData);    // Stored as "users:1"
await postCache.set('1', postData);    // Stored as "posts:1"
```

## Custom Drivers

Implement the `CacheDriver` interface:

```typescript
import type { CacheDriver, CacheSetOptions } from 'fusion-cache';

class RedisDriver implements CacheDriver {
  async get<T>(key: string): Promise<T | null> {
    // Your implementation
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    // Your implementation
  }

  async delete(key: string): Promise<boolean> {
    // Your implementation
  }

  async has(key: string): Promise<boolean> {
    // Your implementation
  }

  async clear(): Promise<void> {
    // Your implementation
  }

  // Optional
  async keys(pattern?: string): Promise<string[]> {
    // Your implementation
  }
}
```

## Error Handling

```typescript
import {
  FusionCacheError,
  InvalidTTLInputError,
  DriverConnectionError,
  FileDriverError,
} from 'fusion-cache';

try {
  await cache.set('key', 'value', { ttl: 'invalid' });
} catch (error) {
  if (error instanceof InvalidTTLInputError) {
    console.error('Bad TTL format');
  }
}
```

## Benchmarks

> Run `pnpm bench` to generate fresh results for your hardware.

### MemoryDriver

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) |
|-----------|---------|----------|----------|----------|
| set | 2,288,777 | 0.5571 | 0.4670 | 2.2590 |
| get | 2,604,599 | 0.4520 | 0.3980 | 1.0270 |
| has | 2,931,029 | 0.4080 | 0.3640 | 0.9570 |
| delete | 1,567,415 | 0.8213 | 0.6860 | 3.8710 |
| getOrSet | 1,842,709 | 0.6611 | 0.5590 | 1.4600 |

### FileDriver (JSON)

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) |
|-----------|---------|----------|----------|----------|
| set | 2,294,832 | 0.5248 | 0.4660 | 1.2060 |
| get | 2,523,988 | 0.4603 | 0.4090 | 1.0520 |
| has | 2,750,571 | 0.4323 | 0.3850 | 1.0850 |
| delete | 1,558,275 | 0.7914 | 0.6920 | 1.7060 |
| getOrSet | 1,818,262 | 0.6475 | 0.5650 | 1.4090 |

### FileDriver (YAML)

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) |
|-----------|---------|----------|----------|----------|
| set | 2,282,203 | 0.5276 | 0.4710 | 1.2320 |
| get | 2,516,454 | 0.4572 | 0.4080 | 1.0270 |

### FileDriver (TOML)

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) |
|-----------|---------|----------|----------|----------|
| set | 2,295,488 | 0.5312 | 0.4670 | 1.2260 |
| get | 2,508,667 | 0.4660 | 0.4090 | 1.0940 |

> **Note:** FileDriver benchmarks reflect the write-through in-memory cache performance.
> Actual filesystem I/O only occurs on `disconnect()` or flush interval.
> In production, use `MemoryDriver` for L1 (hot data) + `FileDriver` for L2 (persistence).

### Driver Comparison

| Feature | MemoryDriver | FileDriver |
|---------|:------------:|:----------:|
| Persistence | No | Yes |
| Read Speed | ~2.6M ops/sec | ~2.5M ops/sec |
| Write Speed | ~2.3M ops/sec | ~2.3M ops/sec |
| Max Size / Eviction | Yes (FIFO) | No |
| Periodic Cleanup | Yes | No |
| Multi-Format | N/A | JSON/YAML/TOML |
| Zero Dependencies | Yes | Yes (JSON) |

## License

MIT
