from fastapi import FastAPI

app = FastAPI(title="AI Recruitment - AI Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
