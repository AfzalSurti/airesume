from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import EmbeddingRequest, EmbeddingResponse, ParseResumeResponse
from app.services.embeddings import create_embedding
from app.services.pdf_extractor import extract_text
from app.services.resume_parser import parse_resume_text

router = APIRouter(prefix="/ai", tags=["ai"])

MIN_TEXT_LENGTH = 50


@router.post("/parse-resume", response_model=ParseResumeResponse)
async def parse_resume(file: UploadFile = File(...)):
    file_bytes = await file.read()

    try:
        raw_text = extract_text(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {exc}") from exc

    if len(raw_text) < MIN_TEXT_LENGTH:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough text from this PDF "
            "(it may be a scanned image without OCR).",
        )

    try:
        profile = parse_resume_text(raw_text)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service call failed: {exc}") from exc

    return ParseResumeResponse(raw_text=raw_text, profile=profile)


@router.post("/create-embedding", response_model=EmbeddingResponse)
async def create_embedding_endpoint(payload: EmbeddingRequest):
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    try:
        embedding = create_embedding(payload.text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service call failed: {exc}") from exc

    return EmbeddingResponse(embedding=embedding)
