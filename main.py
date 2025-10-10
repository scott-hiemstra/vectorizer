import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

class LogRequest(BaseModel):
    text: str

# Prometheus metrics
REQUEST_COUNT = Counter('vectorizer_requests_total', 'Total requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('vectorizer_request_duration_seconds', 'Request duration', ['method', 'endpoint'])
VECTORIZE_DURATION = Histogram('vectorizer_encode_duration_seconds', 'Time spent encoding text')
ACTIVE_REQUESTS = Gauge('vectorizer_active_requests', 'Number of active requests')
MODEL_LOADED = Gauge('vectorizer_model_loaded', 'Whether the model is loaded (1=loaded, 0=not loaded)')
TEXT_LENGTH = Histogram('vectorizer_text_length_chars', 'Length of input text in characters')

model: SentenceTransformer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global model
    model = SentenceTransformer('all-MiniLM-L6-v2')
    MODEL_LOADED.set(1)
    print("Sentence-Transformer model loaded successfully.")
    yield
    # Shutdown (cleanup if needed)
    MODEL_LOADED.set(0)

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    ACTIVE_REQUESTS.inc()
    
    try:
        response = await call_next(request)
        
        # Record metrics
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
    if not model:
        raise HTTPException(status_code=503, detail={"status": "unhealthy", "reason": "Model not loaded"})
    return {"status": "healthy", "model": "all-MiniLM-L6-v2"}

@app.post("/vectorize")
async def vectorize_log(log_request: LogRequest):
    if not model:
        raise HTTPException(status_code=503, detail={"error": "Model not yet loaded"})

    # Record input text length
    TEXT_LENGTH.observe(len(log_request.text))
    
    # Time the encoding operation
    with VECTORIZE_DURATION.time():
        embedding = model.encode(log_request.text).tolist()
    
    return {"vector": embedding}