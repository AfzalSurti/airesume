# AI Recruitment & Resume Screening System

AI-powered recruitment and resume screening platform.

```text
ai-recruitment-system/
├── frontend/     React (Vite) - HR/admin UI
├── backend/      Node.js + Express - main API, auth, DB orchestration
├── ai-service/   Python + FastAPI - resume parsing, embeddings, LLM evaluation
└── storage/      (placeholder, not used - files go to object storage)
```

## Status: Phase 1 - Foundation

Project scaffolding, service health checks, and DB migration setup only.
No auth, AI, or matching logic yet.

## Prerequisites

- Node.js 18+
- Python 3.11+
- A Neon PostgreSQL database (with the `vector` extension available)

## 1. Backend (Node.js + Express)

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, etc.
npm run migrate         # applies SQL migrations (enables pgvector)
npm run dev              # starts on http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health`

## 2. AI Service (Python + FastAPI)

```bash
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements.txt
cp .env.example .env            # fill in OPENAI_API_KEY, etc.
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

The home page calls the backend's `/api/health` endpoint to confirm
frontend → backend connectivity.

## Environment files

Each service has a `.env.example`. Copy it to `.env` and fill in real
values. `.env` files are gitignored and must never be committed.

## Next phase

Phase 2 - Authentication (users, organizations, JWT access/refresh tokens, RBAC).
