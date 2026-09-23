import json

from app.config import CHAT_MODEL
from app.services.openai_client import client

SYSTEM_PROMPT = """You are an expert technical recruiter evaluating a candidate against a \
job's requirements.

Rules:
- Base your evaluation ONLY on the job requirements and candidate information provided \
below. Never invent skills, experience, or qualifications the candidate does not have \
evidence for in their profile or resume text.
- For every skill you say the candidate has, include a short evidence note quoting or \
paraphrasing where in their resume/profile that comes from. If you cannot find evidence, \
do not claim the skill as matched.
- Do not consider or mention age, gender, religion, ethnicity, marital status, or any \
other protected characteristic.
- Scores are 0-100 integers.
- recommendation must be exactly one of: "shortlist", "maybe", "reject".

Respond with ONLY valid JSON matching exactly this shape, no extra commentary:
{
  "overall_score": number,
  "skills_score": number,
  "experience_score": number,
  "education_score": number,
  "matched_skills": array of strings,
  "missing_required_skills": array of strings,
  "preferred_skills_matched": array of strings,
  "strengths": array of strings,
  "concerns": array of strings,
  "experience_analysis": string,
  "recommendation": "shortlist" | "maybe" | "reject",
  "evidence": array of { "skill": string, "matched": boolean, "evidence": string }
}
"""

REQUIRED_KEYS = {
    "overall_score",
    "skills_score",
    "experience_score",
    "education_score",
    "matched_skills",
    "missing_required_skills",
    "preferred_skills_matched",
    "strengths",
    "concerns",
    "experience_analysis",
    "recommendation",
    "evidence",
}

SCORE_FIELDS = ["overall_score", "skills_score", "experience_score", "education_score"]
LIST_FIELDS = [
    "matched_skills",
    "missing_required_skills",
    "preferred_skills_matched",
    "strengths",
    "concerns",
]
ALLOWED_RECOMMENDATIONS = {"shortlist", "maybe", "reject"}


def _clamp_score(value) -> int:
    if not isinstance(value, (int, float)):
        return 0
    return max(0, min(100, round(value)))


def _sanitize(evaluation: dict) -> dict:
    sanitized = dict(evaluation)
    for field in SCORE_FIELDS:
        sanitized[field] = _clamp_score(sanitized.get(field))
    for field in LIST_FIELDS:
        value = sanitized.get(field)
        sanitized[field] = value if isinstance(value, list) else []
    analysis = sanitized.get("experience_analysis")
    sanitized["experience_analysis"] = analysis if isinstance(analysis, str) else ""
    recommendation = sanitized.get("recommendation")
    sanitized["recommendation"] = (
        recommendation if recommendation in ALLOWED_RECOMMENDATIONS else "maybe"
    )
    evidence = sanitized.get("evidence")
    sanitized["evidence"] = evidence if isinstance(evidence, list) else []
    return sanitized


def evaluate_candidate(jd: dict, jd_text: str, candidate_profile: dict, resume_text: str) -> dict:
    user_content = json.dumps(
        {
            "job_requirements": jd,
            "job_description_text": (jd_text or "")[:6000],
            "candidate_profile": candidate_profile or {},
            "candidate_resume_text": (resume_text or "")[:6000],
        }
    )

    response = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )

    content = response.choices[0].message.content
    try:
        evaluation = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model did not return valid JSON: {exc}") from exc

    if not isinstance(evaluation, dict):
        raise ValueError("Model response was not a JSON object")

    missing = REQUIRED_KEYS - evaluation.keys()
    if missing:
        raise ValueError(f"Model response missing required keys: {sorted(missing)}")

    return _sanitize(evaluation)
