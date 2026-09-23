CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'HIRED', 'ARCHIVED')),
  source TEXT NOT NULL DEFAULT 'PUBLIC_FORM',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_applications_job_candidate ON applications (job_id, candidate_id);
CREATE INDEX idx_applications_job_id ON applications (job_id);
CREATE INDEX idx_applications_candidate_id ON applications (candidate_id);

CREATE TABLE application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  job_question_id UUID NOT NULL REFERENCES job_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_answers_application_id ON application_answers (application_id);

CREATE TABLE screening_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  vector_similarity NUMERIC(6,5),
  overall_score INTEGER,
  skills_score INTEGER,
  experience_score INTEGER,
  education_score INTEGER,
  matched_skills JSONB,
  missing_skills JSONB,
  strengths JSONB,
  concerns JSONB,
  experience_analysis TEXT,
  evidence JSONB,
  recommendation TEXT,
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_screening_results_job_candidate ON screening_results (job_id, candidate_id);
CREATE INDEX idx_screening_results_job_id ON screening_results (job_id);
