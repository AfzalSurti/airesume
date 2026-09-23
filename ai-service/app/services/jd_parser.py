import json

from app.config import CHAT_MODEL
from app.services.openai_client import client

SYSTEM_PROMPT = """You are an expert technical recruiter. Extract structured requirements \
from the job description text provided.

Rules:
- Only extract information explicitly present or clearly implied by the text.
- If a field cannot be determined, use null (for single values) or an empty array (for lists).
- required_skills are skills explicitly stated as required/must-have. preferred_skills are \
skills stated as nice-to-have/preferred/bonus.

Respond with ONLY valid JSON matching exactly this shape, no extra commentary:
{
  "job_title": string or null,
  "required_experience_years": number or null,
  "required_skills": array of strings,
  "preferred_skills": array of strings,
  "education": array of strings,
  "location": string or null,
  "other_requirements": array of strings
}
"""

REQUIRED_KEYS = {
    "job_title",
    "required_experience_years",
    "required_skills",
    "preferred_skills",
    "education",
    "location",
    "other_requirements",
}

LIST_FIELDS = ["required_skills", "preferred_skills", "education", "other_requirements"]


def _sanitize(jd: dict) -> dict:
    sanitized = dict(jd)
    for field in LIST_FIELDS:
        value = sanitized.get(field)
        sanitized[field] = value if isinstance(value, list) else []
    job_title = sanitized.get("job_title")
    sanitized["job_title"] = job_title if isinstance(job_title, str) and job_title.strip() else None
    location = sanitized.get("location")
    sanitized["location"] = location if isinstance(location, str) and location.strip() else None
    years = sanitized.get("required_experience_years")
    sanitized["required_experience_years"] = years if isinstance(years, (int, float)) else None
    return sanitized


def parse_jd_text(jd_text: str) -> dict:
    response = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": jd_text},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )

    content = response.choices[0].message.content
    try:
        jd = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {exc}") from exc

    if not isinstance(jd, dict):
        raise ValueError("Model response was not a JSON object")

    missing = REQUIRED_KEYS - jd.keys()
    if missing:
        raise ValueError(f"Model response missing required keys: {sorted(missing)}")

    return _sanitize(jd)
