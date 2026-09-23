from typing import Optional

from pydantic import BaseModel


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]


class ParseResumeResponse(BaseModel):
    raw_text: str
    profile: dict


class ParseJdRequest(BaseModel):
    text: str


class ParseJdResponse(BaseModel):
    jd: dict


class EvaluateCandidateRequest(BaseModel):
    jd: dict
    jd_text: Optional[str] = None
    candidate_profile: Optional[dict] = None
    resume_text: Optional[str] = None


class EvaluateCandidateResponse(BaseModel):
    evaluation: dict
