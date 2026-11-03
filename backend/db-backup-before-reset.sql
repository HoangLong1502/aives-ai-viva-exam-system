--
-- PostgreSQL database dump
--

\restrict 7rJOSMDMivuWsyhsVcknF1s3d6lBWufVsITnf0VtHpWrQTs7Od11UTmWTd52lov

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg12+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: Role; Type: TYPE; Schema: public; Owner: aives
--

CREATE TYPE public."Role" AS ENUM (
    'STUDENT',
    'EXAMINER',
    'ADMIN'
);


ALTER TYPE public."Role" OWNER TO aives;

--
-- Name: exam_format; Type: TYPE; Schema: public; Owner: aives
--

CREATE TYPE public.exam_format AS ENUM (
    'MULTIPLE_CHOICE',
    'ORAL'
);


ALTER TYPE public.exam_format OWNER TO aives;

--
-- Name: exam_status; Type: TYPE; Schema: public; Owner: aives
--

CREATE TYPE public.exam_status AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED'
);


ALTER TYPE public.exam_status OWNER TO aives;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: User; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text,
    name text NOT NULL,
    role public."Role" DEFAULT 'STUDENT'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    google_sub text
);


ALTER TABLE public."User" OWNER TO aives;

--
-- Name: app_meta; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.app_meta (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_meta OWNER TO aives;

--
-- Name: app_setting; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.app_setting (
    key text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.app_setting OWNER TO aives;

--
-- Name: bank_question; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.bank_question (
    id uuid NOT NULL,
    subject_id uuid NOT NULL,
    topic text NOT NULL,
    prompt text NOT NULL,
    bloom text NOT NULL,
    rubric_id uuid NOT NULL,
    status text NOT NULL,
    source text NOT NULL,
    author_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_ref text
);


ALTER TABLE public.bank_question OWNER TO aives;

--
-- Name: course; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.course (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.course OWNER TO aives;

--
-- Name: course_assignment; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.course_assignment (
    course_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.course_assignment OWNER TO aives;

--
-- Name: course_document; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.course_document (
    id uuid NOT NULL,
    teacher_id text NOT NULL,
    subject_id uuid NOT NULL,
    original_name text NOT NULL,
    content_type text NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.course_document OWNER TO aives;

--
-- Name: enrollment; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.enrollment (
    course_id uuid NOT NULL,
    student_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.enrollment OWNER TO aives;

--
-- Name: exam; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.exam (
    id uuid NOT NULL,
    title text NOT NULL,
    format public.exam_format NOT NULL,
    status public.exam_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_id uuid,
    teacher_id text
);


ALTER TABLE public.exam OWNER TO aives;

--
-- Name: exam_attempt; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.exam_attempt (
    id uuid NOT NULL,
    exam_id uuid NOT NULL,
    student_id text NOT NULL,
    score integer,
    entered_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exam_attempt OWNER TO aives;

--
-- Name: exam_question; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.exam_question (
    exam_id uuid NOT NULL,
    question_id uuid NOT NULL
);


ALTER TABLE public.exam_question OWNER TO aives;

--
-- Name: flyway_schema_history; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


ALTER TABLE public.flyway_schema_history OWNER TO aives;

--
-- Name: knowledge_chunk; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.knowledge_chunk (
    id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    embedding public.vector(384) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    document_id uuid,
    source_label text,
    chunk_index integer
);


ALTER TABLE public.knowledge_chunk OWNER TO aives;

--
-- Name: language_config; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.language_config (
    id uuid NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    stt_language character varying(20) NOT NULL,
    tts_language character varying(20) NOT NULL,
    tts_voice character varying(100),
    is_default boolean DEFAULT false NOT NULL
);


ALTER TABLE public.language_config OWNER TO aives;

--
-- Name: role; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.role (
    id smallint NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.role OWNER TO aives;

--
-- Name: rubric; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.rubric (
    id uuid NOT NULL,
    name text NOT NULL,
    criteria text NOT NULL,
    max_score integer NOT NULL
);


ALTER TABLE public.rubric OWNER TO aives;

--
-- Name: subject; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.subject (
    id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.subject OWNER TO aives;

--
-- Name: subject_teacher; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public.subject_teacher (
    subject_id uuid NOT NULL,
    teacher_id text NOT NULL
);


ALTER TABLE public.subject_teacher OWNER TO aives;

--
-- Name: user; Type: TABLE; Schema: public; Owner: aives
--

CREATE TABLE public."user" (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text,
    google_sub character varying(255),
    full_name character varying(255) NOT NULL,
    student_code character varying(50),
    role_id smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone character varying(20)
);


ALTER TABLE public."user" OWNER TO aives;

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public."User" (id, email, password, name, role, "createdAt", "updatedAt", google_sub) FROM stdin;
6cc1b644-baf6-4a4e-aa98-d727c0e1ba39	nhatnmse182812@fpt.edu.vn	$2a$10$yEkUQVYY1EllHUNQ/mPm1elg4d2EI0wg6W1tOv/ov6o6qWfJr3UHy	NHAT DEP TRAI	EXAMINER	2026-10-03 16:00:57.461	2026-10-03 16:00:57.461	\N
\.


--
-- Data for Name: app_meta; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.app_meta (key, value, updated_at) FROM stdin;
\.


--
-- Data for Name: app_setting; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.app_setting (key, value) FROM stdin;
stt_language	vi
tts_language	vi
\.


--
-- Data for Name: bank_question; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.bank_question (id, subject_id, topic, prompt, bloom, rubric_id, status, source, author_id, created_at, source_ref) FROM stdin;
\.


--
-- Data for Name: course; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.course (id, code, name, description, is_active, created_at) FROM stdin;
c0000000-0000-0000-0000-000000000001	SWD392	Software Architecture and Design	Architecture styles, design patterns and documentation.	t	2026-10-05 12:18:27.133002+00
c0000000-0000-0000-0000-000000000002	DBI202	Database Systems	Relational model, SQL and normalization.	t	2026-10-05 12:18:27.133002+00
29c39f28-4606-47fd-b66c-4a72db569105	csd	giải thuật	\N	t	2026-10-05 18:40:21.999281+00
912ac598-8abb-4329-8e9c-ea6471a68b21	se	it	\N	t	2026-10-06 04:44:31.629028+00
b001316e-4fbd-4d7e-9108-9c27e12675a1	NWC201	Networking	\N	t	2026-10-06 07:36:39.59181+00
4ec21e82-592f-4cba-b40f-2e02d797f3cc	DBI222	Database	\N	t	2026-10-06 08:11:15.563925+00
\.


--
-- Data for Name: course_assignment; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.course_assignment (course_id, teacher_id, assigned_at) FROM stdin;
\.


--
-- Data for Name: course_document; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.course_document (id, teacher_id, subject_id, original_name, content_type, storage_path, created_at) FROM stdin;
\.


--
-- Data for Name: enrollment; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.enrollment (course_id, student_id, enrolled_at) FROM stdin;
\.


--
-- Data for Name: exam; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.exam (id, title, format, status, created_at, subject_id, teacher_id) FROM stdin;
\.


--
-- Data for Name: exam_attempt; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.exam_attempt (id, exam_id, student_id, score, entered_at) FROM stdin;
\.


--
-- Data for Name: exam_question; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.exam_question (exam_id, question_id) FROM stdin;
\.


--
-- Data for Name: flyway_schema_history; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) FROM stdin;
1	1	<< Flyway Baseline >>	BASELINE	<< Flyway Baseline >>	\N	aives	2026-10-15 12:44:12.201572	0	t
2	2	student profile columns	SQL	V2__student_profile_columns.sql	-477324818	aives	2026-10-15 12:44:12.305452	45	t
\.


--
-- Data for Name: knowledge_chunk; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.knowledge_chunk (id, title, content, embedding, created_at, document_id, source_label, chunk_index) FROM stdin;
\.


--
-- Data for Name: language_config; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.language_config (id, code, name, stt_language, tts_language, tts_voice, is_default) FROM stdin;
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.role (id, code, name) FROM stdin;
\.


--
-- Data for Name: rubric; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.rubric (id, name, criteria, max_score) FROM stdin;
\.


--
-- Data for Name: subject; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.subject (id, code, name) FROM stdin;
\.


--
-- Data for Name: subject_teacher; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public.subject_teacher (subject_id, teacher_id) FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: aives
--

COPY public."user" (id, email, password_hash, google_sub, full_name, student_code, role_id, is_active, last_login_at, created_at, updated_at, phone) FROM stdin;
\.


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: app_meta app_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.app_meta
    ADD CONSTRAINT app_meta_pkey PRIMARY KEY (key);


--
-- Name: app_setting app_setting_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.app_setting
    ADD CONSTRAINT app_setting_pkey PRIMARY KEY (key);


--
-- Name: bank_question bank_question_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.bank_question
    ADD CONSTRAINT bank_question_pkey PRIMARY KEY (id);


--
-- Name: course_assignment course_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.course_assignment
    ADD CONSTRAINT course_assignment_pkey PRIMARY KEY (course_id, teacher_id);


--
-- Name: course course_code_key; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_code_key UNIQUE (code);


--
-- Name: course_document course_document_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.course_document
    ADD CONSTRAINT course_document_pkey PRIMARY KEY (id);


--
-- Name: course course_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.course
    ADD CONSTRAINT course_pkey PRIMARY KEY (id);


--
-- Name: enrollment enrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.enrollment
    ADD CONSTRAINT enrollment_pkey PRIMARY KEY (course_id, student_id);


--
-- Name: exam_attempt exam_attempt_exam_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam_attempt
    ADD CONSTRAINT exam_attempt_exam_id_student_id_key UNIQUE (exam_id, student_id);


--
-- Name: exam_attempt exam_attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam_attempt
    ADD CONSTRAINT exam_attempt_pkey PRIMARY KEY (id);


--
-- Name: exam exam_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam
    ADD CONSTRAINT exam_pkey PRIMARY KEY (id);


--
-- Name: exam_question exam_question_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam_question
    ADD CONSTRAINT exam_question_pkey PRIMARY KEY (exam_id, question_id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: knowledge_chunk knowledge_chunk_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.knowledge_chunk
    ADD CONSTRAINT knowledge_chunk_pkey PRIMARY KEY (id);


--
-- Name: language_config language_config_code_key; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.language_config
    ADD CONSTRAINT language_config_code_key UNIQUE (code);


--
-- Name: language_config language_config_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.language_config
    ADD CONSTRAINT language_config_pkey PRIMARY KEY (id);


--
-- Name: role role_code_key; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_code_key UNIQUE (code);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: rubric rubric_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.rubric
    ADD CONSTRAINT rubric_pkey PRIMARY KEY (id);


--
-- Name: subject subject_code_key; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.subject
    ADD CONSTRAINT subject_code_key UNIQUE (code);


--
-- Name: subject subject_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.subject
    ADD CONSTRAINT subject_pkey PRIMARY KEY (id);


--
-- Name: subject_teacher subject_teacher_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.subject_teacher
    ADD CONSTRAINT subject_teacher_pkey PRIMARY KEY (subject_id, teacher_id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_google_sub_key; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_google_sub_key UNIQUE (google_sub);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: aives
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_google_sub_key; Type: INDEX; Schema: public; Owner: aives
--

CREATE UNIQUE INDEX "User_google_sub_key" ON public."User" USING btree (google_sub);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: aives
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_user_full_name; Type: INDEX; Schema: public; Owner: aives
--

CREATE INDEX idx_user_full_name ON public."user" USING btree (lower((full_name)::text));


--
-- Name: knowledge_chunk_embedding_idx; Type: INDEX; Schema: public; Owner: aives
--

CREATE INDEX knowledge_chunk_embedding_idx ON public.knowledge_chunk USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: uq_user_student_code; Type: INDEX; Schema: public; Owner: aives
--

CREATE UNIQUE INDEX uq_user_student_code ON public."user" USING btree (student_code) WHERE (student_code IS NOT NULL);


--
-- Name: bank_question bank_question_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.bank_question
    ADD CONSTRAINT bank_question_author_id_fkey FOREIGN KEY (author_id) REFERENCES public."User"(id);


--
-- Name: bank_question bank_question_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.bank_question
    ADD CONSTRAINT bank_question_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric(id);


--
-- Name: bank_question bank_question_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.bank_question
    ADD CONSTRAINT bank_question_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: course_document course_document_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.course_document
    ADD CONSTRAINT course_document_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: course_document course_document_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.course_document
    ADD CONSTRAINT course_document_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public."User"(id);


--
-- Name: exam_attempt exam_attempt_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam_attempt
    ADD CONSTRAINT exam_attempt_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exam(id);


--
-- Name: exam_attempt exam_attempt_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam_attempt
    ADD CONSTRAINT exam_attempt_student_id_fkey FOREIGN KEY (student_id) REFERENCES public."User"(id);


--
-- Name: exam_question exam_question_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam_question
    ADD CONSTRAINT exam_question_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exam(id);


--
-- Name: exam_question exam_question_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.exam_question
    ADD CONSTRAINT exam_question_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.bank_question(id);


--
-- Name: subject_teacher subject_teacher_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.subject_teacher
    ADD CONSTRAINT subject_teacher_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: subject_teacher subject_teacher_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: aives
--

ALTER TABLE ONLY public.subject_teacher
    ADD CONSTRAINT subject_teacher_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public."User"(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 7rJOSMDMivuWsyhsVcknF1s3d6lBWufVsITnf0VtHpWrQTs7Od11UTmWTd52lov

