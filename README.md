# Vectorizer API

A high-performance FastAPI service for converting text (especially log messages) into vector embeddings using the Sentence Transformers library.

## Overview

This service provides a REST API endpoint that transforms text into dense vector representations using the `all-MiniLM-L6-v2` model. It's optimized for log processing and analysis workflows where semantic similarity and clustering of text data is needed.

## Purpose & Use Case

This vectorizer is designed to support **log anomaly detection and similarity analysis** workflows by:

🔍 **Anomaly Detection Pipeline:**
1. **Vectorize logs** → Convert log messages into 384-dimensional embeddings
2. **Store in Elasticsearch** → Index vectors using Elasticsearch's dense vector fields
3. **Detect anomalies** → Use vector similarity to identify unusual log patterns
4. **Find similar logs** → Query for logs with similar semantic meaning

🎯 **Key Benefits:**
- **Semantic Understanding**: Goes beyond keyword matching to understand log meaning
- **Pattern Recognition**: Identifies anomalous behavior even with different wording
- **Similarity Search**: Find related issues across different log formats
- **Scalable Processing**: High-throughput vectorization for large log volumes

📊 **Integration with Elasticsearch:**
```json
PUT /logs
{
  "mappings": {
    "properties": {
      "message": {"type": "text"},
      "vector": {"type": "dense_vector", "dims": 384},
      "timestamp": {"type": "date"}
    }
  }
}
```

## Features

- ⚡ **High Performance**: ~82 RPS sustained throughput with ~122ms response times
- 🐳 **Docker Ready**: Containerized with Docker Compose
- 🔄 **Auto-restart**: Production-ready with automatic container restart and health checks
- 📊 **Consistent Latency**: 95% of requests complete within 132ms
- 🛡️ **Reliable**: Zero failed requests in extensive load testing
- 🏥 **Health Monitoring**: Built-in `/healthz` endpoint for load balancers

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and start the service:**
```bash
git clone https://github.com/scott-hiemstra/vectorizer.git
cd vectorizer
docker compose up -d
```

2. **Test the API:**
```bash
curl -X POST "http://localhost:8000/vectorize" \
     -H "Content-Type: application/json" \
     -d '{"text": "Database connection timeout - retrying"}'
```

### GPU Deployment

For GPU-accelerated inference (2-3x faster, see [Performance](#performance)):

1. **Prerequisites:**
   - NVIDIA GPU with [CUDA support](https://developer.nvidia.com/cuda-gpus)
   - [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) installed
   - Verify with: `nvidia-smi` and `docker run --rm --gpus all nvidia/cuda:12.6.3-base-ubuntu24.04 nvidia-smi`

2. **Start the GPU service:**
```bash
docker compose -f docker-compose.gpu.yml up -d
```

3. **Verify GPU is active:**
```bash
curl -s http://localhost:8000/healthz | python3 -m json.tool
# Check container logs for: "Using device: cuda"
docker compose -f docker-compose.gpu.yml logs vectorizer-gpu | grep device
```

> **Note:** The default `Dockerfile.gpu` uses PyTorch with CUDA 12.4 (cu124), which supports
> RTX 20xx and newer GPUs. For older GPUs (GTX 10xx / Pascal), see
> [GPU Compatibility](#gpu-compatibility) to switch to cu118.

### Manual Setup

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Run the service:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Reference

### POST `/vectorize`

Converts input text into a vector embedding.

**Request Body:**
```json
{
  "text": "Your text to vectorize here"
}
```

**Response:**
```json
{
  "vector": [0.1234, -0.5678, 0.9012, ...]
}
```

### GET `/healthz`

Health check endpoint for monitoring and load balancers.

**Response (Healthy):**
```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2"
}
```

**Response (Unhealthy):**
```json
{
  "status": "unhealthy",
  "reason": "Model not loaded"
}
```
*Returns HTTP 503 when unhealthy*

### GET `/metrics`

Prometheus metrics endpoint for monitoring and observability.

**Response:** Prometheus-formatted metrics including:
- `vectorizer_requests_total` - Total request count by method, endpoint, and status
- `vectorizer_request_duration_seconds` - Request latency histogram
- `vectorizer_encode_duration_seconds` - Time spent in model encoding
- `vectorizer_active_requests` - Current number of active requests
- `vectorizer_model_loaded` - Model status (1=loaded, 0=not loaded)
- `vectorizer_text_length_chars` - Input text length distribution

**Example Usage:**
```bash
# Error log
curl -X POST "http://localhost:8000/vectorize" \
     -H "Content-Type: application/json" \
     -d '{"text": "2024-10-10 14:32:15 ERROR Database connection timeout"}'

# Info log  
curl -X POST "http://localhost:8000/vectorize" \
     -H "Content-Type: application/json" \
     -d '{"text": "2024-10-10 14:33:01 INFO User login successful"}'

# Health check
curl http://localhost:8000/healthz

# Prometheus metrics
curl http://localhost:8000/metrics
```

## Performance

| Config | RPS | Avg Latency | p95 Latency |
|--------|-----|-------------|-------------|
| **CPU** (1 worker) | 82-88 | 122ms | 132ms |
| **GPU** (GTX 1050 Ti) | 82-164 | 21ms | 33ms |

GPU provides **2-3x lower latency** and **2x+ throughput** at high concurrency. Full benchmark results, methodology, and load testing instructions are in [PERFORMANCE.md](PERFORMANCE.md).

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8000 | Service port |
| `HOST` | 0.0.0.0 | Service host |

### Docker Configuration

The service is configured to:
- Run on port 8000 (mapped from host)
- Auto-restart on failure
- Use minimal resource footprint

To modify resource limits, uncomment the deploy section in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 8G
```

## Model Information

- **Model**: `all-MiniLM-L6-v2`
- **Embedding Dimension**: 384
- **Max Sequence Length**: 256 tokens
- **Performance**: Optimized for speed while maintaining quality

## Use Cases

Perfect for:

### � **Anomaly Detection in Logs**
- **Elasticsearch Integration**: Store vectors in dense_vector fields for fast similarity search
- **Pattern Detection**: Identify unusual log patterns that deviate from normal behavior
- **Incident Response**: Quickly find logs similar to known issues
- **Baseline Establishment**: Create vector baselines for normal system behavior

### 🔍 **Log Analysis & Operations**
- **Semantic Clustering**: Group logs by meaning, not just keywords
- **Cross-System Correlation**: Find related issues across different applications
- **Error Classification**: Automatically categorize errors by semantic similarity
- **Troubleshooting**: Search for logs with similar context or meaning

### 📊 **Advanced Analytics**
- **Feature Extraction**: Use vectors as input for downstream ML models
- **Time-Series Analysis**: Track semantic drift in log patterns over time
- **Root Cause Analysis**: Identify common patterns in incident logs

## Development

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Testing

```bash
# Basic functionality test
python -c "
import requests
response = requests.post('http://localhost:8000/vectorize', 
                        json={'text': 'test message'})
print(f'Status: {response.status_code}')
print(f'Vector length: {len(response.json()[\"vector\"])}')
"
```

## Production Considerations

### Scaling

For higher throughput:

1. **GPU Acceleration** (recommended — see [GPU Deployment](#gpu-deployment)):
   - 2-3x lower latency, 2x+ throughput at high concurrency
   - Even modest GPUs (GTX 1050 Ti) provide meaningful gains

2. **Load Balancer:** Use nginx or similar for distributing requests across multiple instances

3. **Multiple Workers** (CPU only — not recommended for most cases):
```bash
uvicorn main:app --workers 4 --host 0.0.0.0 --port 8000
```
> ⚠️ Each worker loads its own copy of the model (~90MB each). At low-to-moderate
> concurrency, multi-worker adds overhead without throughput gains. Prefer GPU or
> horizontal scaling with separate containers behind a load balancer.

### GPU Compatibility

The GPU Docker image uses PyTorch with a specific CUDA toolkit version. The default
(`cu124`) supports RTX 20xx and newer. For older GPUs, switch to `cu118`.

| GPU Family | Architecture | Compute Capability | CUDA | PyTorch Index URL |
|------------|-------------|-------------------|------|-------------------|
| RTX 40xx (4070, 4090, etc.) | Ada Lovelace | sm_89 | **cu124** (default) | `https://download.pytorch.org/whl/cu124` |
| RTX 30xx (3060, 3090, etc.) | Ampere | sm_86 | **cu124** (default) | `https://download.pytorch.org/whl/cu124` |
| RTX 20xx (2070, 2080, etc.) | Turing | sm_75 | **cu124** (default) | `https://download.pytorch.org/whl/cu124` |
| A100, H100 (data center) | Ampere/Hopper | sm_80 / sm_90 | **cu124** (default) | `https://download.pytorch.org/whl/cu124` |
| GTX 10xx (1050 Ti, 1080, etc.) | Pascal | sm_61 | cu118 | `https://download.pytorch.org/whl/cu118` |

**For older GPUs (Pascal / GTX 10xx)**, edit `Dockerfile.gpu`:

```dockerfile
# Change base image:
FROM nvidia/cuda:11.8.0-runtime-ubuntu22.04

# Change PyTorch index:
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cu118
```

**How to check your GPU's compute capability:**
```bash
nvidia-smi --query-gpu=name,compute_cap --format=csv
```

### Monitoring

Built-in observability features:
- ✅ **Health check endpoint** (`/healthz`) - Ready for load balancers
- ✅ **Prometheus metrics** (`/metrics`) - Comprehensive performance monitoring
- ✅ **Request logging** - Structured logging with uvicorn

**Key Metrics to Monitor:**
- `vectorizer_requests_total` - Request volume and error rates
- `vectorizer_request_duration_seconds` - API latency percentiles
- `vectorizer_encode_duration_seconds` - Model performance
- `vectorizer_active_requests` - Concurrent load
- `vectorizer_text_length_chars` - Input size distribution

**Sample Prometheus Query:**
```promql
# 95th percentile latency
histogram_quantile(0.95, rate(vectorizer_request_duration_seconds_bucket[5m]))

# Error rate
rate(vectorizer_requests_total{status!="200"}[5m]) / rate(vectorizer_requests_total[5m])

# Requests per second
rate(vectorizer_requests_total[5m])
```

**Grafana Dashboard:**
Monitor throughput, latency, error rates, and model performance in real-time.
- Error tracking

## Troubleshooting

### Common Issues

**Model loading fails:**
- Ensure sufficient memory (>2GB recommended)
- Check internet connectivity for initial model download

**Performance degradation:**
- Monitor CPU usage
- Consider reducing concurrency
- Check for memory leaks in long-running deployments

**Container startup issues:**
- Verify port 8000 is available
- Check Docker daemon is running
- Review container logs: `docker compose logs vectorizer`

## License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request