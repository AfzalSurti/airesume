from openai import OpenAI

from app.config import OPENAI_API_KEY, OPENAI_BASE_URL

client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
