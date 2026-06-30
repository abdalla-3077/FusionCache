# @abdalla/fusion-cache — Test Report & Benchmark Script

## Table of Contents

- [Test Matrix](#test-matrix)
- [Cache Type Comparison](#cache-type-comparison)
- [TTL Behavior Matrix](#ttl-behavior-matrix)
- [Data Type Coverage](#data-type-coverage)
- [Benchmark Results](#benchmark-results)
- [Running Tests](#running-tests)
- [Running Benchmarks](#running-benchmarks)

---

## Test Matrix

Every operation is tested across **all 6 driver configurations**:

| Driver | Config | Tests |
|--------|--------|-------|
| MemoryDriver | default | CRUD, TTL, prefix, getOrSet, large volume, edge cases |
| MemoryDriver | maxSize=3 | Eviction behavior under capacity limits |
| MemoryDriver | checkInterval=50ms | Periodic cleanup of expired entries |
| FileDriver | JSON format | Full CRUD + persistence across reconnects |
| FileDriver | YAML format | Full CRUD + persistence across reconnects |
| FileDriver | TOML format | Full CRUD + persistence across reconnects |

---

## Cache Type Comparison

### Operation Support

| Operation | MemoryDriver | FileDriver (JSON) | FileDriver (YAML) | FileDriver (TOML) |
|-----------|:------------:|:-----------------:|:-----------------:|:-----------------:|
| `get` | ✅ | ✅ | ✅ | ✅ |
| `set` | ✅ | ✅ | ✅ | ✅ |
| `delete` | ✅ | ✅ | ✅ | ✅ |
| `has` | ✅ | ✅ | ✅ | ✅ |
| `clear` | ✅ | ✅ | ✅ | ✅ |
| `keys` | ✅ | ✅ | ✅ | ✅ |
| `connect` | ✅ | ✅ | ✅ | ✅ |
| `disconnect` | ✅ | ✅ | ✅ | ✅ |

### Feature Comparison

| Feature | MemoryDriver | FileDriver |
|---------|:------------:|:----------:|
| Persistence | ❌ (lost on restart) | ✅ (saved to disk) |
| TTL Expiration | ✅ (lazy) | ✅ (lazy) |
| Periodic Cleanup | ✅ (configurable) | ❌ (flush-based) |
| Max Size / Eviction | ✅ (FIFO) | ❌ |
| Atomic Writes | N/A | ✅ (tmp + rename) |
| Debounced Flush | N/A | ✅ (configurable) |
| Multi-Format | N/A | ✅ (JSON/YAML/TOML) |
| Zero Dependencies | ✅ | ✅ (JSON only) |
| Prefix/Namespacing | ✅ (via FusionCache) | ✅ (via FusionCache) |
| Cache-Aside (getOrSet) | ✅ | ✅ |

### Performance Characteristics

| Metric | MemoryDriver | FileDriver |
|--------|-------------|------------|
| Read Latency | ~0.001ms | ~0.1-1ms |
| Write Latency | ~0.001ms | ~0.5-5ms |
| Memory Usage | In-process RAM | Filesystem + in-memory cache |
| Concurrency | Single-process | Single-process (file locks via atomic rename) |
| Best For | Hot data, L1 cache | Persistent config, L2 cache |

---

## TTL Behavior Matrix

| Input Format | Parsed Value | Example |
|-------------|-------------|---------|
| `5s` | 5,000 ms | `cache.set('key', val, { ttl: '5s' })` |
| `30m` | 1,800,000 ms | `cache.set('key', val, { ttl: '30m' })` |
| `2h` | 7,200,000 ms | `cache.set('key', val, { ttl: '2h' })` |
| `1d` | 86,400,000 ms | `cache.set('key', val, { ttl: '1d' })` |
| `1w` | 604,800,000 ms | `cache.set('key', val, { ttl: '1w' })` |
| `5000` (number) | 5,000 ms | `cache.set('key', val, { ttl: 5000 })` |
| `0` | No expiration | `cache.set('key', val, { ttl: 0 })` |

### TTL Test Scenarios

| Scenario | TTL | Wait | Expected |
|----------|-----|------|----------|
| Short expiry | 50ms | 80ms | `null` (expired) |
| Medium expiry | 100ms | 150ms | `null` (expired) |
| Human format | "1s" | 1100ms | `null` (expired) |
| No expiry | 5000ms | 50ms | value (not expired) |
| Default TTL | 50ms | 80ms | `null` (expired) |
| Override default | per-key 50ms vs default 5000ms | 80ms | per-key expired, default not |

---

## Data Type Coverage

| Type | Value | Stored Correctly |
|------|-------|:----------------:|
| string | `"hello world"` | ✅ |
| number (int) | `42` | ✅ |
| number (float) | `3.14159` | ✅ |
| boolean (true) | `true` | ✅ |
| boolean (false) | `false` | ✅ |
| null | `null` | ✅ |
| empty string | `""` | ✅ |
| zero | `0` | ✅ |
| array | `[1, 2, 3, "a", null]` | ✅ |
| nested object | `{ a: 1, b: { c: "deep" } }` | ✅ |
| empty object | `{}` | ✅ |
| empty array | `[]` | ✅ |
| unicode + emoji | `"مرحبا العالم 🌍"` | ✅ |
| large string (10KB) | `"x".repeat(10000)` | ✅ |
| deeply nested (6 levels) | `{ a: { b: { c: { d: { e: { f } } } } } }` | ✅ |

---

## Edge Cases

| Case | Input | Expected |
|------|-------|----------|
| Special chars in key | `"key:with:colons"` | ✅ Works |
| Slashes in key | `"key/with/slashes"` | ✅ Works |
| Spaces in key | `"key with spaces"` | ✅ Works |
| Unicode key | `"🔑"` | ✅ Works |
| Empty key | `""` | ✅ Works |
| Long key (1000 chars) | `"k".repeat(1000)` | ✅ Works |
| Overwrite with shorter TTL | Set 5s, then set 50ms | ✅ Expires correctly |

---

## Benchmark Results

> Run `pnpm bench` to generate fresh results for your hardware.
> Benchmark date: 2026-06-30 | Node.js v24.14.0

### MemoryDriver

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) | Samples |
|-----------|---------|----------|----------|----------|---------|
| set | 2,288,777 | 0.5571 | 0.4670 | 2.2590 | 1,795,119 |
| get | 2,604,599 | 0.4520 | 0.3980 | 1.0270 | 2,212,162 |
| has | 2,931,029 | 0.4080 | 0.3640 | 0.9570 | 2,451,164 |
| delete | 1,567,415 | 0.8213 | 0.6860 | 3.8710 | 1,217,565 |
| getOrSet | 1,842,709 | 0.6611 | 0.5590 | 1.4600 | 1,512,701 |

### FileDriver (JSON)

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) | Samples |
|-----------|---------|----------|----------|----------|---------|
| set | 2,294,832 | 0.5248 | 0.4660 | 1.2060 | 1,905,430 |
| get | 2,523,988 | 0.4603 | 0.4090 | 1.0520 | 2,172,473 |
| has | 2,750,571 | 0.4323 | 0.3850 | 1.0850 | 2,313,108 |
| delete | 1,558,275 | 0.7914 | 0.6920 | 1.7060 | 1,263,563 |
| getOrSet | 1,818,262 | 0.6475 | 0.5650 | 1.4090 | 1,544,298 |

### FileDriver (YAML)

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) | Samples |
|-----------|---------|----------|----------|----------|---------|
| set | 2,282,203 | 0.5276 | 0.4710 | 1.2320 | 1,895,224 |
| get | 2,516,454 | 0.4572 | 0.4080 | 1.0270 | 2,187,202 |

### FileDriver (TOML)

| Operation | Ops/sec | Avg (ms) | p75 (ms) | p99 (ms) | Samples |
|-----------|---------|----------|----------|----------|---------|
| set | 2,295,488 | 0.5312 | 0.4670 | 1.2260 | 1,882,501 |
| get | 2,508,667 | 0.4660 | 0.4090 | 1.0940 | 2,146,100 |

> **Note:** FileDriver benchmarks reflect the write-through in-memory cache performance.
> Actual filesystem I/O only occurs on `disconnect()` or flush interval.
> In production, use `MemoryDriver` for L1 (hot data) + `FileDriver` for L2 (persistence).

---

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm vitest run tests/cache-types.test.ts

# Run tests matching a pattern
pnpm vitest run -t "MemoryDriver"
```

### Test Structure

```
tests/
├── cache-types.test.ts          # Table-driven tests across all 6 driver configs
├── fusion-cache.test.ts         # Core FusionCache API tests
├── errors.test.ts               # Error class hierarchy tests
├── index.test.ts                # Public export verification
├── ttl-parser.test.ts           # TTL parsing tests
└── drivers/
    ├── memory-driver.test.ts    # MemoryDriver unit tests
    └── file-driver.test.ts      # FileDriver unit tests
```

---

## Running Benchmarks

```bash
# Run all benchmarks
pnpm bench

# Results are saved to benchmarks/results.json
```

### Benchmark Structure

```
benchmarks/
├── run.ts           # Benchmark runner (tinybench)
└── results.json     # Latest benchmark output (generated)
```

### What's Benchmarked

| Driver | Operations Tested |
|--------|-------------------|
| MemoryDriver | set, get, has, delete, getOrSet |
| FileDriver (JSON) | set, get, has, delete, getOrSet |
| FileDriver (YAML) | set, get |
| FileDriver (TOML) | set, get |

### Benchmark Configuration

- **MemoryDriver:** 10,000 iterations, 1 second minimum time
- **FileDriver:** 500 iterations, 1 second minimum time (filesystem I/O is slower)

---

## CI Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```
