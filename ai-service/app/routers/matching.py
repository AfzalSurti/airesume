from fastapi import APIRouter, HTTPException

from app.schemas import (
    EvaluateCandidateRequest,
    EvaluateCandidateResponse,
    ParseJdRequest,
    ParseJdResponse,
)
from app.services.candidate_evaluator import evaluate_candidate
from app.services.jd_parser import parse_jd_text

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/parse-jd", response_model=ParseJdResponse)
async def parse_jd(payload: ParseJdRequest):
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    try:
        jd = parse_jd_text(payload.text)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI parsing failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service call failed: {exc}") from exc

    return ParseJdResponse(jd=jd)


@router.post("/evaluate-candidate", response_model=EvaluateCandidateResponse)
async def evaluate_candidate_endpoint(payload: EvaluateCandidateRequest):
    try:
        evaluation = evaluate_candidate(
            payload.jd, payload.jd_text, payload.candidate_profile, payload.resume_text
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI evaluation failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service call failed: {exc}") from exc

    return EvaluateCandidateResponse(evaluation=evaluation)
