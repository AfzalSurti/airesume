from fastapi import FastAPI

from app.routers import resume

app = FastAPI(title="AI Recruitment - AI Service")

app.include_router(resume.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
