from fastapi import FastAPI

from app.routers import matching, resume

app = FastAPI(title="AI Recruitment - AI Service")

app.include_router(resume.router)
app.include_router(matching.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
