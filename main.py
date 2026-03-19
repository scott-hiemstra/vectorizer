import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

logger = logging.getLogger("uvicorn.error")

# Configuration
MODEL_NAME = os.getenv("MODEL_NAME", "all-MiniLM-L6-v2")
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "10000"))
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "64"))


class LogRequest(BaseModel):
    text: str


class BatchRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=MAX_BATCH_SIZE)


# Prometheus metrics
REQUEST_COUNT = Counter('vectorizer_requests_total', 'Total requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('vectorizer_request_duration_seconds', 'Request duration', ['method', 'endpoint'])
VECTORIZE_DURATION = Histogram('vectorizer_encode_duration_seconds', 'Time spent encoding text')
ACTIVE_REQUESTS = Gauge('vectorizer_active_requests', 'Number of active requests')
MODEL_LOADED = Gauge('vectorizer_model_loaded', 'Whether the model is loaded (1=loaded, 0=not loaded)')
TEXT_LENGTH = Histogram('vectorizer_text_length_chars', 'Length of input text in characters')
TEXTS_TRUNCATED = Counter('vectorizer_texts_truncated_total', 'Number of texts truncated to max length')


def _truncate(text: str) -> str:
    """Truncate text to MAX_TEXT_LENGTH, incrementing the metric if needed."""
    if len(text) > MAX_TEXT_LENGTH:
        TEXTS_TRUNCATED.inc()
        return text[:MAX_TEXT_LENGTH]
    return text


@asynccontextmanager
async def lifespan(app: FastAPI):
    model = SentenceTransformer(MODEL_NAME)
    app.state.model = model
    MODEL_LOADED.set(1)
    logger.info("Model '%s' loaded on device: %s", MODEL_NAME, model.device)
    logger.info("System has %d CPU cores available.", os.cpu_count())
    yield
    MODEL_LOADED.set(0)


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    ACTIVE_REQUESTS.inc()

    try:
        response = await call_next(request)

        duration = time.time() - start_time
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)

        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()

        return response
    finally:
        ACTIVE_REQUESTS.dec()


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/healthz")
async def health_check():
    model = app.state.model
    if not model:
        raise HTTPException(status_code=503, detail={"status": "unhealthy", "reason": "Model not loaded"})
    return {"status": "healthy", "model": MODEL_NAME}


@app.post("/vectorize")
async def vectorize_log(log_request: LogRequest):
    model: SentenceTransformer = app.state.model
    if not model:
        raise HTTPException(status_code=503, detail={"error": "Model not yet loaded"})

    text = _truncate(log_request.text)
    TEXT_LENGTH.observe(len(text))

    with VECTORIZE_DURATION.time():
        embedding = await asyncio.to_thread(model.encode, text)

    return {"vector": embedding.tolist()}


@app.post("/vectorize/batch")
async def vectorize_batch(batch_request: BatchRequest):
    model: SentenceTransformer = app.state.model
    if not model:
        raise HTTPException(status_code=503, detail={"error": "Model not yet loaded"})

    texts = [_truncate(t) for t in batch_request.texts]
    for t in texts:
        TEXT_LENGTH.observe(len(t))

    with VECTORIZE_DURATION.time():
        embeddings = await asyncio.to_thread(model.encode, texts)

    return {"vectors": embeddings.tolist()}