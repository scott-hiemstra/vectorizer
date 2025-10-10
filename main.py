from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

class LogRequest(BaseModel):
    text: str

model: SentenceTransformer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global model
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Sentence-Transformer model loaded successfully.")
    yield
    # Shutdown (cleanup if needed)
    pass

app = FastAPI(lifespan=lifespan)

@app.get("/healthz")
async def health_check():
    if not model:
        raise HTTPException(status_code=503, detail={"status": "unhealthy", "reason": "Model not loaded"})
    return {"status": "healthy", "model": "all-MiniLM-L6-v2"}

@app.post("/vectorize")
async def vectorize_log(log_request: LogRequest):
    if not model:
        raise HTTPException(status_code=503, detail={"error": "Model not yet loaded"})

    embedding = model.encode(log_request.text).tolist()
    
    return {"vector": embedding}