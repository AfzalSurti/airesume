# AI Recruitment & Resume Screening System

AI-powered recruitment platform: resume pool + AI matching, job postings with public
applications, AI screening, and a full post-shortlist hiring pipeline (document
collection, HOD review, interview scheduling, offer letters).

```text
airesume/
├── frontend/     React (Vite) - HR/HOD web app + public candidate-facing pages
├── backend/      Node.js + Express - main API, auth, DB orchestration, email
├── ai-service/   Python + FastAPI - resume/JD parsing, embeddings, LLM evaluation
└── storage/      Local disk file storage (dev + VPS; gitignored)
```

## Status: all 10 planned phases complete, plus a full hiring pipeline extension

- Auth (JWT access/refresh, RBAC: ADMIN/HR/RECRUITER/HOD/VIEWER, org multi-tenancy)
- Candidate pool: resume upload (single + bulk), AI parsing (GPT-4o Mini via
  OpenRouter), pgvector embeddings, versioning, archive/restore
- Jobs: CRUD, AI-structured requirements, custom application questions, public apply
  page, applicant management, AI screening with evidence-based scoring
- JD search: paste a JD, get ranked candidates from the existing pool
- Hiring pipeline: HR requests documents from a shortlisted candidate → candidate
  uploads via a public link (configurable checklist + repeatable work-experience
  entries) → HR reviews → forwards to a HOD → HOD schedules an interview → HOD records
  a decision → HR sends the offer letter → HR marks hired
- Email notifications (nodemailer/Gmail) at every pipeline step, with graceful
  fallback: if email isn't configured or fails, the link/status is shown in the UI
  instead of being silently lost
- Light/dark theme

**Not done:** Phase 10 production deployment (VPS/Docker/Nginx) - intentionally on
hold, no deployment artifacts written yet.

## Prerequisites

- Node.js 18+
- Python 3.11+
- A Neon (or any) PostgreSQL database with the `vector` extension available
- (Optional, for real email) a Gmail account + [app password](https://myaccount.google.com/apppasswords)

## 1. Backend (Node.js + Express)

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, GMAIL_USER/APP_PASSWORD, etc.
npm run migrate         # applies all SQL migrations (pgvector, auth, jobs, pipeline...)
npm run dev              # starts on http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health`

## 2. AI Service (Python + FastAPI)

```bash
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements.txt
cp .env.example .env            # fill in OPENAI_API_KEY (or OpenRouter key) etc.
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

## 3. Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL if backend isn't on localhost:5000
npm run dev              # starts on http://localhost:5173
```

Log in, or register a new organization from `/register` (the first user of an
organization is always ADMIN).

## Environment files

Each service has a `.env.example`. Copy it to `.env` and fill in real values. `.env`
files are gitignored and must never be committed.

Key backend variables beyond the basics:
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` - enables real email sending for the hiring
  pipeline (document requests, interview notices, offer letters). If left blank, the
  app still works - every email attempt is logged and the relevant link/status is shown
  directly in the UI instead of being sent.
- `STORAGE_PROVIDER` / `STORAGE_ROOT` - file storage backend (`local` by default,
  writing under `storage/`).

## Key workflows

- **Build a resume pool:** Candidates → Upload Resumes (bulk, AI extracts each
  person's name/skills automatically) or add one via a candidate's profile.
- **Search the pool:** JD Search → paste a job description → ranked, AI-scored matches.
- **Hire for a job:** Jobs → New Job → publish it → share the public apply link, or
  shortlist from the pool. In the job's Applicants tab, click Request Documents to
  start the hiring pipeline for a candidate; follow it under the Pipeline nav item.
- **Manage the team:** Settings → Team (create HR/RECRUITER/HOD/VIEWER users) and
  Document Checklist (the standard documents candidates are asked to upload).
