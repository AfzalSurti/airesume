import os

from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
CHAT_MODEL = os.environ.get("AI_CHAT_MODEL", "openai/gpt-4o-mini")
EMBEDDING_MODEL = os.environ.get("AI_EMBEDDING_MODEL", "openai/text-embedding-3-small")
