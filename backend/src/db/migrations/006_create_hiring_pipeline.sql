ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'HR', 'RECRUITER', 'HOD', 'VIEWER'));

CREATE TABLE document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_requirements_org ON document_requirements (organization_id);

CREATE TABLE hiring_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'DOCS_REQUESTED' CHECK (stage IN (
    'DOCS_REQUESTED', 'DOCS_SUBMITTED', 'FORWARDED_TO_HOD', 'INTERVIEW_SCHEDULED',
    'HOD_SELECTED', 'HOD_REJECTED', 'OFFER_SENT', 'COMPLETED'
  )),
  document_token TEXT NOT NULL,
  hod_id UUID REFERENCES users(id) ON DELETE SET NULL,
  interview_date DATE,
  interview_time TEXT,
  interview_location TEXT,
  hod_decision_notes TEXT,
  offer_letter_storage_key TEXT,
  offer_letter_file_name TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hiring_pipelines_org ON hiring_pipelines (organization_id);
CREATE INDEX idx_hiring_pipelines_hod ON hiring_pipelines (hod_id);
CREATE UNIQUE INDEX idx_hiring_pipelines_token ON hiring_pipelines (document_token);

CREATE TABLE pipeline_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_pipeline_id UUID NOT NULL REFERENCES hiring_pipelines(id) ON DELETE CASCADE,
  document_requirement_id UUID REFERENCES document_requirements(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_documents_pipeline ON pipeline_documents (hiring_pipeline_id);

CREATE TABLE pipeline_experience_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_pipeline_id UUID NOT NULL REFERENCES hiring_pipelines(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_location TEXT,
  date_of_joining DATE,
  date_of_exit DATE,
  experience_letter_key TEXT,
  experience_letter_file_name TEXT,
  offer_letter_key TEXT,
  offer_letter_file_name TEXT,
  appointment_letter_key TEXT,
  appointment_letter_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_experience_pipeline ON pipeline_experience_entries (hiring_pipeline_id);

CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  hiring_pipeline_id UUID REFERENCES hiring_pipelines(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'FAILED')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_pipeline ON email_log (hiring_pipeline_id);
