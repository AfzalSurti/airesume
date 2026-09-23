from pydantic import BaseModel


class EmbeddingRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]


class ParseResumeResponse(BaseModel):
    raw_text: str
    profile: dict
