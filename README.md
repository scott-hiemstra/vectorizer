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

- ⚡ **High Performance**: ~78 RPS sustained throughput with ~129ms response times
- 🐳 **Docker Ready**: Containerized with Docker Compose
- 🔄 **Auto-restart**: Production-ready with automatic container restart and health checks
- 📊 **Consistent Latency**: 95% of requests complete within 162ms
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

Based on load testing with Apache Bench on Intel i7-1165G7 (4 cores, 8 threads) with 32GB RAM:

### **Short Text Performance (typical log messages)**

| Concurrency | RPS | Avg Response Time | 95th Percentile | Test Size | Notes |
|-------------|-----|-------------------|-----------------|-----------|-------|
| 10          | 94  | 106ms            | 124ms           | 1,000 req | Optimal for short text |
| 20          | 102 | 195ms            | 276ms           | 5,000 req | Sustained performance |

### **Long Text Performance (detailed logs, stack traces)**

| Concurrency | RPS | Avg Response Time | 95th Percentile | Text Length | Notes |
|-------------|-----|-------------------|-----------------|-------------|-------|
| 20          | 32  | 634ms            | 930ms           | ~532 chars  | Lorem paragraph test |

### **Performance Characteristics**

- ⚡ **Short logs** (< 100 chars): ~90+ RPS sustained
- 📄 **Medium logs** (100-300 chars): ~50-60 RPS estimated  
- 📋 **Long logs** (300+ chars): ~30 RPS sustained
- 🎯 **Optimal concurrency**: 10-20 depending on text length

**Key Insight:** Performance scales non-linearly with text length. Text 13x longer results in 6x latency increase, making the service ideal for typical log processing where most messages are short.

**Test Environment:**
- CPU: Intel i7-1165G7 (Tiger Lake, 4 cores, 8 threads, 2.8-4.7 GHz)
- RAM: 32GB
- Platform: Linux (Docker containerized)

### Load Testing

Test the service performance:

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test
ab -n 1000 -c 10 -p payload.json -T application/json http://localhost:8000/vectorize
```

Sample `payload.json`:
```json
{"text": "2024-10-10 14:32:15 ERROR Database connection timeout after 30 seconds"}
```

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

1. **Multiple Workers:**
```bash
uvicorn main:app --workers 4 --host 0.0.0.0 --port 8000
```

2. **Load Balancer:** Use nginx or similar for distributing requests

3. **GPU Acceleration:** Modify to use CUDA if GPUs available

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