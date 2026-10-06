-- AIVES schema: features 1 (question bank + rubric), 3 (AI viva core), 7 (administration).
-- Compatibility columns kept for existing screens: question.source_ref, exam_session.format, exam_attempt.score.
-- Applied once per Postgres volume by SchemaInitializer (see app_meta.seed_applied).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE role (
  id smallint PRIMARY KEY,
  code varchar(20) NOT NULL UNIQUE,
  name varchar(50) NOT NULL
);

CREATE TABLE "user" (
  id uuid PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text,
  google_sub varchar(255) UNIQUE,
  full_name varchar(255) NOT NULL,
  student_code varchar(50),
  role_id smallint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course (
  id uuid PRIMARY KEY,
  code varchar(50) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_assignment (
  course_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, teacher_id)
);

CREATE TABLE enrollment (
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, student_id)
);

CREATE TABLE language_config (
  id uuid PRIMARY KEY,
  code varchar(10) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  stt_language varchar(20) NOT NULL,
  tts_language varchar(20) NOT NULL,
  tts_voice varchar(100),
  is_default boolean NOT NULL DEFAULT false
);

CREATE TABLE rubric (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rubric_criterion (
  id uuid PRIMARY KEY,
  rubric_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  max_points numeric(5,2) NOT NULL,
  weight numeric(4,2) NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE course_document (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  topic varchar(255) NOT NULL,
  original_name varchar(255) NOT NULL,
  content_type varchar(100) NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  extraction_status varchar(20) NOT NULL DEFAULT 'PENDING',
  extraction_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_chunk (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  document_id uuid,
  topic varchar(255) NOT NULL,
  title varchar(255) NOT NULL,
  source_label varchar(100),
  chunk_index int,
  content text NOT NULL,
  embedding vector(384) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_generation_request (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  topic varchar(255) NOT NULL,
  keywords text,
  bloom_level varchar(20),
  question_count int NOT NULL,
  model_name varchar(100),
  status varchar(20) NOT NULL DEFAULT 'RUNNING',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE question (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  rubric_id uuid NOT NULL,
  generation_id uuid,
  topic varchar(255) NOT NULL,
  prompt text NOT NULL,
  expected_answer text,
  source_ref text,
  key_points text,
  bloom_level varchar(20) NOT NULL, -- REMEMBER | UNDERSTAND | APPLY | ANALYZE
  status varchar(20) NOT NULL DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW | APPROVED | REJECTED
  source varchar(20) NOT NULL, -- MANUAL | IMPORT | AI
  author_id uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE question_source_chunk (
  question_id uuid NOT NULL,
  chunk_id uuid NOT NULL,
  PRIMARY KEY (question_id, chunk_id)
);

CREATE TABLE exam_session (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  language_config_id uuid NOT NULL,
  title varchar(255) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  format varchar(20) NOT NULL DEFAULT 'ORAL',
  scheduled_at timestamptz,
  duration_minutes int,
  main_question_count int NOT NULL DEFAULT 3,
  max_follow_ups int NOT NULL DEFAULT 2,
  answer_time_limit_sec int NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exam_session_question (
  session_id uuid NOT NULL,
  question_id uuid NOT NULL,
  sort_order int,
  PRIMARY KEY (session_id, question_id)
);

CREATE TABLE exam_attempt (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'IN_PROGRESS',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score int,
  UNIQUE (session_id, student_id)
);

CREATE TABLE question_turn (
  id uuid PRIMARY KEY,
  attempt_id uuid NOT NULL,
  question_id uuid,
  parent_turn_id uuid,
  turn_no int NOT NULL,
  turn_type varchar(20) NOT NULL DEFAULT 'MAIN', -- MAIN | FOLLOW_UP
  follow_up_no int,
  question_text text NOT NULL,
  asked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, turn_no)
);

CREATE TABLE answer (
  id uuid PRIMARY KEY,
  turn_id uuid NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'ANSWERED', -- ANSWERED | TIMEOUT | SKIPPED
  transcript text,
  stt_confidence numeric(4,3),
  duration_ms int,
  needs_follow_up boolean NOT NULL DEFAULT false,
  follow_up_reason varchar(20), -- VAGUE | MISSING_POINT | CONTRADICTION
  stt_latency_ms int,
  llm_latency_ms int,
  answered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "user" ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES role(id);
ALTER TABLE course_assignment ADD CONSTRAINT fk_ca_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE course_assignment ADD CONSTRAINT fk_ca_teacher FOREIGN KEY (teacher_id) REFERENCES "user"(id);
ALTER TABLE enrollment ADD CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE enrollment ADD CONSTRAINT fk_enr_student FOREIGN KEY (student_id) REFERENCES "user"(id);
ALTER TABLE rubric ADD CONSTRAINT fk_rubric_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE rubric ADD CONSTRAINT fk_rubric_creator FOREIGN KEY (created_by) REFERENCES "user"(id);
ALTER TABLE rubric_criterion ADD CONSTRAINT fk_rc_rubric FOREIGN KEY (rubric_id) REFERENCES rubric(id);
ALTER TABLE course_document ADD CONSTRAINT fk_cd_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE course_document ADD CONSTRAINT fk_cd_uploader FOREIGN KEY (uploaded_by) REFERENCES "user"(id);
ALTER TABLE knowledge_chunk ADD CONSTRAINT fk_kc_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE knowledge_chunk ADD CONSTRAINT fk_kc_document FOREIGN KEY (document_id) REFERENCES course_document(id);
ALTER TABLE ai_generation_request ADD CONSTRAINT fk_agr_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE ai_generation_request ADD CONSTRAINT fk_agr_user FOREIGN KEY (requested_by) REFERENCES "user"(id);
ALTER TABLE question ADD CONSTRAINT fk_q_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE question ADD CONSTRAINT fk_q_rubric FOREIGN KEY (rubric_id) REFERENCES rubric(id);
ALTER TABLE question ADD CONSTRAINT fk_q_generation FOREIGN KEY (generation_id) REFERENCES ai_generation_request(id);
ALTER TABLE question ADD CONSTRAINT fk_q_author FOREIGN KEY (author_id) REFERENCES "user"(id);
ALTER TABLE question ADD CONSTRAINT fk_q_reviewer FOREIGN KEY (reviewed_by) REFERENCES "user"(id);
ALTER TABLE question_source_chunk ADD CONSTRAINT fk_qsc_question FOREIGN KEY (question_id) REFERENCES question(id);
ALTER TABLE question_source_chunk ADD CONSTRAINT fk_qsc_chunk FOREIGN KEY (chunk_id) REFERENCES knowledge_chunk(id);
ALTER TABLE exam_session ADD CONSTRAINT fk_es_course FOREIGN KEY (course_id) REFERENCES course(id);
ALTER TABLE exam_session ADD CONSTRAINT fk_es_teacher FOREIGN KEY (teacher_id) REFERENCES "user"(id);
ALTER TABLE exam_session ADD CONSTRAINT fk_es_language FOREIGN KEY (language_config_id) REFERENCES language_config(id);
ALTER TABLE exam_session_question ADD CONSTRAINT fk_esq_session FOREIGN KEY (session_id) REFERENCES exam_session(id);
ALTER TABLE exam_session_question ADD CONSTRAINT fk_esq_question FOREIGN KEY (question_id) REFERENCES question(id);
ALTER TABLE exam_attempt ADD CONSTRAINT fk_ea_session FOREIGN KEY (session_id) REFERENCES exam_session(id);
ALTER TABLE exam_attempt ADD CONSTRAINT fk_ea_student FOREIGN KEY (student_id) REFERENCES "user"(id);
ALTER TABLE question_turn ADD CONSTRAINT fk_qt_attempt FOREIGN KEY (attempt_id) REFERENCES exam_attempt(id);
ALTER TABLE question_turn ADD CONSTRAINT fk_qt_question FOREIGN KEY (question_id) REFERENCES question(id);
ALTER TABLE question_turn ADD CONSTRAINT fk_qt_parent FOREIGN KEY (parent_turn_id) REFERENCES question_turn(id);
ALTER TABLE answer ADD CONSTRAINT fk_ans_turn FOREIGN KEY (turn_id) REFERENCES question_turn(id);

CREATE INDEX knowledge_chunk_embedding_idx ON knowledge_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_question_course_status ON question (course_id, status);
CREATE INDEX idx_chunk_course ON knowledge_chunk (course_id);
CREATE INDEX idx_chunk_document ON knowledge_chunk (document_id);
CREATE INDEX idx_attempt_student ON exam_attempt (student_id);
CREATE INDEX idx_session_teacher ON exam_session (teacher_id);

ALTER TABLE question ADD CONSTRAINT ck_q_bloom CHECK (bloom_level IN ('REMEMBER','UNDERSTAND','APPLY','ANALYZE'));
ALTER TABLE question ADD CONSTRAINT ck_q_status CHECK (status IN ('PENDING_REVIEW','APPROVED','REJECTED'));
ALTER TABLE question ADD CONSTRAINT ck_q_source CHECK (source IN ('MANUAL','IMPORT','AI'));
ALTER TABLE exam_session ADD CONSTRAINT ck_es_format CHECK (format IN ('MULTIPLE_CHOICE','ORAL'));
ALTER TABLE question_turn ADD CONSTRAINT ck_qt_type CHECK (turn_type IN ('MAIN','FOLLOW_UP'));
ALTER TABLE question_turn ADD CONSTRAINT ck_qt_parent CHECK (turn_type = 'MAIN' OR parent_turn_id IS NOT NULL);
ALTER TABLE answer ADD CONSTRAINT ck_ans_status CHECK (status IN ('ANSWERED','TIMEOUT','SKIPPED'));

INSERT INTO role (id, code, name) VALUES (1, 'ADMIN', 'Administrator'), (2, 'EXAMINER', 'Teacher'), (3, 'STUDENT', 'Student');
INSERT INTO language_config (id, code, name, stt_language, tts_language, is_default) VALUES
  ('00000000-0000-0000-0000-000000000001', 'vi', 'Vietnamese', 'vi-VN', 'vi-VN', true),
  ('00000000-0000-0000-0000-000000000002', 'en', 'English', 'en-US', 'en-US', false);
