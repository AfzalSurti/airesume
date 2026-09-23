from app.config import EMBEDDING_MODEL
from app.services.openai_client import client

MAX_INPUT_CHARS = 20000


def create_embedding(text: str) -> list:
    truncated = text[:MAX_INPUT_CHARS]
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=truncated)
    return response.data[0].embedding
