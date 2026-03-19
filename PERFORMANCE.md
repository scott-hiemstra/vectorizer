# Performance

Benchmark results from load testing with [k6](https://k6.io/) and [Apache Bench](https://httpd.apache.org/docs/2.4/programs/ab.html).

## CPU Performance (single worker, default)

### Short Text (typical log messages, ~90 chars)

| Concurrency | RPS | Avg Response Time | 95th Percentile | Test Size | Notes |
|-------------|-----|-------------------|-----------------|-----------|-------|
| 10          | 82  | 122ms            | 132ms           | 1,000 req | Low latency |
| 20          | 88  | 227ms            | 252ms           | 5,000 req | Sustained performance |
| 50          | 88  | 560ms            | 636ms           | 2,000 req | RPS plateaus, latency rises |

### Long Text (stack traces, ~670 chars)

| Concurrency | RPS | Avg Response Time | 95th Percentile | Test Size | Notes |
|-------------|-----|-------------------|-----------------|-----------|-------|
| 20          | 39  | 513ms            | 583ms           | 1,000 req | Realistic stack trace payload |

### Single Request Latency

| Scenario | Latency |
|----------|---------|
| Warm (short text) | ~10ms |

## GPU Performance (NVIDIA GTX 1050 Ti, 4GB VRAM)

| Test | VUs | RPS | Avg Latency | p95 Latency | Iterations | Notes |
|------|-----|-----|-------------|-------------|------------|-------|
| Load | 10 | 82 | 21ms | 33ms | 4,904 | **2.7x faster** latency vs CPU |
| Stress | 10→100 | 164 | 230ms | 571ms | 19,653 | **2.3x more** throughput vs CPU |

## CPU vs GPU Comparison

| Config | RPS (load) | Avg Latency (load) | RPS (stress) | Avg Latency (stress) |
|--------|------------|--------------------|--------------|-----------------------|
| **CPU (1 worker)** | 82 | 122ms | 88 | 560ms |
| **GPU (GTX 1050 Ti)** | 82 | **21ms** | **164** | 230ms |

## Key Insights

- On CPU, RPS maxes out around 88 req/s — increasing concurrency beyond 20 only adds latency.
- GPU provides the biggest gains under high concurrency (164 vs 88 RPS at stress) and dramatically reduces per-request latency (21ms vs 56ms avg).
- Even a modest GPU (GTX 1050 Ti) provides meaningful acceleration for this workload.
- Performance scales non-linearly with text length (7x longer text → ~2x slower).

### At a Glance

- ⚡ **CPU short logs** (< 100 chars): ~82-88 RPS, ~10ms single request
- 🚀 **GPU short logs** (< 100 chars): ~82-164 RPS, ~21ms avg under load
- 📋 **CPU long logs** (600+ chars): ~39 RPS
- 🎯 **CPU optimal concurrency**: 10-20 (RPS plateaus beyond ~20)
- 📈 **GPU advantage**: 2-3x lower latency, 2x+ throughput at high concurrency

## Test Environment

- **CPU:** AMD Ryzen 5 3600 (6 cores, 12 threads, 3.6-4.2 GHz)
- **GPU:** NVIDIA GeForce GTX 1050 Ti (4GB VRAM, CUDA sm_61)
- **RAM:** 78GB
- **Platform:** Linux (Docker containerized)

## Load Testing

### k6 (Recommended)

The `k6/` directory contains a full test plan with multiple scenarios:

```bash
# Install k6 — https://grafana.com/docs/k6/latest/set-up/install-k6/
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Run scenarios
k6 run k6/load-test.js                          # default: sustained load (10 VUs, 60s)
k6 run --env SCENARIO=smoke k6/load-test.js      # quick sanity check
k6 run --env SCENARIO=stress k6/load-test.js     # ramp 10→20→50→100 VUs
k6 run --env SCENARIO=spike k6/load-test.js      # sudden burst to 80 VUs
k6 run --env SCENARIO=soak k6/load-test.js       # 5 min sustained for leak detection

# Custom target
k6 run --env SCENARIO=load --env BASE_URL=http://your-host:8000 k6/load-test.js
```

### Available Scenarios

| Scenario | VUs | Duration | Purpose |
|----------|-----|----------|---------|
| `smoke` | 1 | 10 iterations | Sanity check |
| `load` | 10 | 60s | Baseline performance |
| `stress` | 10→100 ramp | 2 min | Find throughput ceiling |
| `spike` | 5→80→5 | ~70s | Burst recovery |
| `soak` | 15 | 5 min | Memory leak detection |

### Apache Bench (Quick)

```bash
sudo apt-get install apache2-utils
ab -n 1000 -c 10 -p payload.json -T application/json http://localhost:8000/vectorize
```

Sample `payload.json`:
```json
{"text": "2024-10-10 14:32:15 ERROR Database connection timeout after 30 seconds"}
```
