from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()

class LogRequest(BaseModel):
    text: str

model: SentenceTransformer = None

@app.on_event("startup")
async def startup_event():
    global model
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Sentence-Transformer model loaded successfully.")

@app.get("/healthz")
async def health_check():
    if not model:
        return {"status": "unhealthy", "reason": "Model not loaded"}, 503
    return {"status": "healthy", "model": "all-MiniLM-L6-v2"}

@app.post("/vectorize")
async def vectorize_log(log_request: LogRequest):
    if not model:
        return {"error": "Model not yet loaded"}, 503

    embedding = model.encode(log_request.text).tolist()
    
    return {"vector": embedding}