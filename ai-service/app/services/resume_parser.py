import json

from app.config import CHAT_MODEL
from app.services.openai_client import client

SYSTEM_PROMPT = """You are an expert resume parser. Extract structured information from the resume text provided.

Rules:
- Only extract information explicitly present in the text. Never invent, guess, or infer information that is not there.
- If a field cannot be found, use null (for single values) or an empty array (for lists).
- Dates should be kept as they appear in the resume (e.g. "Jan 2020", "2020", "Present").
- total_experience_years should be your best numeric estimate of total professional experience \
in years, based only on the dated work history in the resume. Use null if it cannot be determined.
- Do not extract or infer age, gender, marital status, religion, ethnicity, or any other \
protected characteristic, even if mentioned in the text.

Respond with ONLY valid JSON matching exactly this shape, no extra commentary:
{
  "name": string or null,
  "email": string or null,
  "phone": string or null,
  "location": string or null,
  "total_experience_years": number or null,
  "skills": array of strings,
  "experience": array of { "company": string, "title": string, "start_date": string or null, "end_date": string or null, "description": string or null },
  "education": array of { "institution": string, "degree": string or null, "field": string or null, "year": string or null },
  "projects": array of { "name": string, "description": string or null },
  "certifications": array of strings,
  "links": array of strings
}
"""

REQUIRED_KEYS = {
    "name",
    "email",
    "phone",
    "location",
    "total_experience_years",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
    "links",
}

LIST_FIELDS = ["skills", "experience", "education", "projects", "certifications", "links"]
STRING_FIELDS = ["name", "email", "phone", "location"]


def _sanitize_profile(profile: dict) -> dict:
    sanitized = dict(profile)
    for field in LIST_FIELDS:
        value = sanitized.get(field)
        sanitized[field] = value if isinstance(value, list) else []
    for field in STRING_FIELDS:
        value = sanitized.get(field)
        sanitized[field] = value if isinstance(value, str) and value.strip() else None
    years = sanitized.get("total_experience_years")
    sanitized["total_experience_years"] = years if isinstance(years, (int, float)) else None
    return sanitized


def parse_resume_text(resume_text: str) -> dict:
    response = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": resume_text},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )

    content = response.choices[0].message.content

    try:
        profile = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {exc}") from exc

    if not isinstance(profile, dict):
        raise ValueError("Model response was not a JSON object")

    missing = REQUIRED_KEYS - profile.keys()
    if missing:
        raise ValueError(f"Model response missing required keys: {sorted(missing)}")

    return _sanitize_profile(profile)
