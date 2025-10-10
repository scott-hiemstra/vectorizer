# Vectorizer API

A high-performance FastAPI service for converting text (especially log messages) into vector embeddings using the Sentence Transformers library.

## Overview

This service provides a REST API endpoint that transforms text into dense vector representations using the `all-MiniLM-L6-v2` model. It's optimized for log processing and analysis workflows where semantic similarity and clustering of text data is needed.

## Features

- ⚡ **High Performance**: ~150 RPS with sub-70ms response times
- 🐳 **Docker Ready**: Containerized with Docker Compose
- 🔄 **Auto-restart**: Production-ready with automatic container restart
- 📊 **Consistent Latency**: 95% of requests complete within 73ms
- 🛡️ **Reliable**: Zero failed requests in load testing

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and start the service:**
```bash
git clone <your-repo>
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
```

## Performance

Based on load testing with Apache Bench on Intel i7-1165G7 (4 cores, 8 threads) with 32GB RAM:

| Concurrency | RPS | Avg Response Time | 95th Percentile | Test Size | Notes |
|-------------|-----|-------------------|-----------------|-----------|-------|
| 10          | 150 | 66ms             | 73ms            | 1,000 req | Burst performance |
| 10          | 78  | 129ms            | 162ms           | 5,000 req | Sustained performance |
| 15          | 77  | 194ms            | 234ms           | 5,000 req | Sustained performance |
| 20          | 102 | 195ms            | 276ms           | 5,000 req | Sustained performance |
| 50          | 152 | 329ms            | 343ms           | 1,000 req | Burst performance |

**Optimal Configuration:** Concurrency level 10 for best sustained performance (~78 RPS).

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
- 📋 **Log Analysis**: Semantic clustering of log messages
- 🔍 **Similarity Search**: Finding similar text entries
- 📊 **Text Classification**: Feature extraction for ML pipelines
- 🏷️ **Content Recommendation**: Semantic matching systems

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

Consider adding:
- Health check endpoint (`/health`)
- Metrics collection (Prometheus)
- Request logging
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

[Your License Here]

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request