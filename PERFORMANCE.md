# Performance

Benchmark results from load testing with [k6](https://k6.io/) using mixed payload sizes (60% short, 30% medium, 10% long) with 100ms think time between requests.

## k6 Results

### CPU — Single Worker (default)

| Test | VUs | RPS | Avg Latency | p95 Latency | Iterations | Errors |
|------|-----|-----|-------------|-------------|------------|--------|
| Load | 10 | 67 | 49ms | 90ms | 3,999 | 0% |
| Stress | 10→100 | 70 | 539ms | 1.32s | 8,458 | 0% |

### CPU — 4 Workers

| Test | VUs | RPS | Avg Latency | p95 Latency | Iterations | Errors |
|------|-----|-----|-------------|-------------|------------|--------|
| Load | 10 | 72 | 36ms | 75ms | 4,356 | 0% |
| Stress | 10→100 | 98 | 386ms | 1.02s | 11,743 | 0% |

### GPU (NVIDIA GTX 1050 Ti, 4GB VRAM)

| Test | VUs | RPS | Avg Latency | p95 Latency | Iterations | Errors |
|------|-----|-----|-------------|-------------|------------|--------|
| Load | 10 | 76 | 29ms | 59ms | 4,594 | 0% |
| Stress | 10→100 | 120 | 315ms | 791ms | 14,424 | 0% |

## Comparison

| Config | RPS (load) | Avg Latency (load) | RPS (stress) | Avg Latency (stress) |
|--------|------------|--------------------|--------------|-----------------------|
| **CPU (1 worker)** | 67 | 49ms | 70 | 539ms |
| **CPU (4 workers)** | 72 | 36ms | **98** | 386ms |
| **GPU (GTX 1050 Ti)** | **76** | **29ms** | **120** | **315ms** |

## Key Insights

- **GPU wins across the board**: 1.7x throughput and 1.7x lower latency at stress vs single-worker CPU.
- **Multi-worker helps under stress**: 4 workers reach 98 RPS vs 70 for single-worker (40% more), but adds ~360MB memory for 4 model copies.
- **Single worker is fine at low concurrency**: At 10 VUs, all three configs deliver similar RPS (~67-76) — the difference is mainly latency.
- GPU shines most at high concurrency where it keeps p95 under 800ms while CPU single-worker hits 1.3s.
- `asyncio.to_thread()` unblocks the event loop, improving concurrent request handling across all configs.

### At a Glance

- ⚡ **CPU (1 worker)**: 67 RPS, 49ms avg, 90ms p95
- 🔄 **CPU (4 workers)**: 72 RPS, 36ms avg, 75ms p95
- 🚀 **GPU (GTX 1050 Ti)**: 76 RPS load / 120 RPS stress, 29ms avg
- 📈 **GPU advantage**: ~1.7x throughput, ~1.7x lower latency at stress
- 🎯 **Multi-worker advantage**: 40% more throughput at stress, negligible at low concurrency

## Batch Throughput (`/vectorize/batch`)

Batching encodes multiple texts in a single request. On GPU, this dramatically increases total texts/second because CUDA cores process the whole batch in parallel.

### CPU (single worker)

| Batch Size | Requests/s | **Texts/s** | Avg Latency | p95 Latency |
|-----------|-----------|------------|-------------|-------------|
| 1 | 75 | 75 | 132ms | 184ms |
| 8 | 10 | 83 | 942ms | 1.36s |
| 16 | 4 | 64 | 2.45s | 3.23s |

### GPU (GTX 1050 Ti)

| Batch Size | Requests/s | **Texts/s** | Avg Latency | p95 Latency |
|-----------|-----------|------------|-------------|-------------|
| 1 | 121 | 121 | 82ms | 91ms |
| 8 | 33 | **264** | 295ms | 374ms |
| 16 | 14 | 216 | 723ms | 863ms |
| 32 | 6 | 206 | 1.51s | 1.76s |
| 64 | 5 | **346** | 1.79s | 2.01s |

### Batch Throughput Comparison

| Batch Size | CPU Texts/s | GPU Texts/s | GPU Speedup |
|-----------|------------|------------|-------------|
| 1 | 75 | 121 | 1.6x |
| 8 | 83 | **264** | **3.2x** |
| 16 | 64 | 216 | **3.4x** |

**Key findings:**
- **GPU batch=8 is the sweet spot**: 264 texts/s with sub-400ms p95 — **3.2x faster** than CPU and still responsive.
- **CPU batching doesn't help**: Texts/s stays flat (64-83) regardless of batch size, while latency skyrockets.
- **GPU scales with batch size**: Texts/s increases from 121 → 346 as batch grows, because CUDA cores parallelize the work.
- **batch=64 on GPU peaks at 346 texts/s** but with ~2s latency — best for offline/bulk processing.
- For latency-sensitive workloads, **GPU batch=8** gives the best throughput-to-latency ratio.

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

### Batch Throughput Test

```bash
# Test batch endpoint with different batch sizes
k6 run --env BATCH_SIZE=8 k6/batch-test.js       # sweet spot for GPU
k6 run --env BATCH_SIZE=16 k6/batch-test.js
k6 run --env BATCH_SIZE=64 k6/batch-test.js      # max throughput (higher latency)
```

### Apache Bench (Quick)

```bash
sudo apt-get install apache2-utils
ab -n 1000 -c 10 -p payload.json -T application/json http://localhost:8000/vectorize
```

Sample `payload.json`:
```json
{"text": "2024-10-10 14:32:15 ERROR Database connection timeout after 30 seconds"}
```
