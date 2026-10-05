-- Demo data, loaded once right after schema.sql on an empty database.
-- All demo accounts use the password: Password123

INSERT INTO "user" (id, email, password_hash, full_name, student_code, role_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@aives.test',    '$2a$10$mTY2yyF3cBGT/T0ox6bWB.nkDy8OX.6EQ1fO16gTlaL5TRVVvy2zq', 'Admin AIVES',   NULL,       1),
  ('a0000000-0000-0000-0000-000000000002', 'teacher@aives.test',  '$2a$10$mTY2yyF3cBGT/T0ox6bWB.nkDy8OX.6EQ1fO16gTlaL5TRVVvy2zq', 'Nguyen Van An', NULL,       2),
  ('a0000000-0000-0000-0000-000000000003', 'student1@aives.test', '$2a$10$mTY2yyF3cBGT/T0ox6bWB.nkDy8OX.6EQ1fO16gTlaL5TRVVvy2zq', 'Tran Thi Binh', 'SE170001', 3),
  ('a0000000-0000-0000-0000-000000000004', 'student2@aives.test', '$2a$10$mTY2yyF3cBGT/T0ox6bWB.nkDy8OX.6EQ1fO16gTlaL5TRVVvy2zq', 'Le Van Cuong',  'SE170002', 3),
  ('a0000000-0000-0000-0000-000000000005', 'student3@aives.test', '$2a$10$mTY2yyF3cBGT/T0ox6bWB.nkDy8OX.6EQ1fO16gTlaL5TRVVvy2zq', 'Pham Thi Dung',  'SE170003', 3)
ON CONFLICT DO NOTHING;

INSERT INTO course (id, code, name, description) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'SWD392', 'Software Architecture and Design', 'Architecture styles, design patterns and documentation.'),
  ('c0000000-0000-0000-0000-000000000002', 'DBI202', 'Database Systems',                 'Relational model, SQL and normalization.')
ON CONFLICT DO NOTHING;

INSERT INTO course_assignment (course_id, teacher_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO enrollment (course_id, student_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

INSERT INTO rubric (id, course_id, name, description, created_by) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Oral viva rubric', 'Default rubric for oral questions.', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Oral viva rubric', 'Default rubric for oral questions.', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO rubric_criterion (id, rubric_id, name, description, max_points, weight, sort_order) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Accuracy',      'Is the answer technically correct?',        4, 1, 1),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Completeness',  'Does it cover the key points?',             3, 1, 2),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Clarity',       'Is the explanation clear and well ordered?', 3, 1, 3),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Accuracy',      'Is the answer technically correct?',        4, 1, 1),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Completeness',  'Does it cover the key points?',             3, 1, 2),
  ('d0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'Clarity',       'Is the explanation clear and well ordered?', 3, 1, 3)
ON CONFLICT DO NOTHING;

INSERT INTO question (id, course_id, rubric_id, topic, prompt, expected_answer, key_points, bloom_level, status, source, author_id, reviewed_by, reviewed_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Design patterns',
   'Explain the Singleton pattern and one risk of using it.',
   'Singleton ensures a class has a single instance with a global access point. Risks include hidden global state and harder unit testing.',
   'single instance, global access point, hidden state, testing difficulty', 'UNDERSTAND', 'APPROVED', 'MANUAL',
   'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now()),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Architecture styles',
   'Compare layered architecture with microservices.',
   'Layered is simpler to build and deploy as one unit. Microservices scale and deploy independently but add operational and network complexity.',
   'monolith vs distributed, independent deployment, complexity trade-off', 'ANALYZE', 'APPROVED', 'MANUAL',
   'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now()),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'SOLID',
   'What does the Dependency Inversion Principle say?',
   'High-level modules should not depend on low-level modules. Both should depend on abstractions.',
   'abstractions, high-level vs low-level, decoupling', 'REMEMBER', 'PENDING_REVIEW', 'AI',
   'a0000000-0000-0000-0000-000000000002', NULL, NULL),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Normalization',
   'Why do we normalize a database to third normal form?',
   'To reduce redundancy and avoid update, insert and delete anomalies by removing partial and transitive dependencies.',
   'redundancy, anomalies, transitive dependency', 'UNDERSTAND', 'APPROVED', 'MANUAL',
   'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now()),
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'SQL',
   'When would you choose a LEFT JOIN instead of an INNER JOIN?',
   'Use LEFT JOIN when rows from the left table must be kept even without a match in the right table.',
   'keep unmatched rows, null values, reporting', 'APPLY', 'APPROVED', 'IMPORT',
   'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now())
ON CONFLICT DO NOTHING;

INSERT INTO exam_session (id, course_id, teacher_id, language_config_id, title, status, format, scheduled_at, duration_minutes, main_question_count, max_follow_ups, answer_time_limit_sec) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
   'SWD392 Midterm Viva', 'PUBLISHED', 'ORAL', now() + interval '7 days', 30, 2, 2, 120),
  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'DBI202 Practice Viva', 'DRAFT', 'ORAL', NULL, 20, 2, 1, 90)
ON CONFLICT DO NOTHING;

INSERT INTO exam_session_question (session_id, question_id, sort_order) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1),
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 2),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 1),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005', 2)
ON CONFLICT DO NOTHING;

INSERT INTO exam_attempt (id, session_id, student_id, status, started_at, submitted_at, score) VALUES
  ('90000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'SUBMITTED', now() - interval '1 day', now() - interval '1 day' + interval '12 minutes', 8)
ON CONFLICT DO NOTHING;

INSERT INTO question_turn (id, attempt_id, question_id, parent_turn_id, turn_no, turn_type, follow_up_no, question_text) VALUES
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', NULL, 1, 'MAIN', NULL,
   'Explain the Singleton pattern and one risk of using it.'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 2, 'FOLLOW_UP', 1,
   'How would you make a Singleton easier to test?')
ON CONFLICT DO NOTHING;

INSERT INTO answer (id, turn_id, status, transcript, stt_confidence, duration_ms, needs_follow_up, follow_up_reason) VALUES
  ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'ANSWERED',
   'Singleton keeps only one instance of a class and gives a global access point. The risk is that it hides global state.', 0.940, 21000, true, 'MISSING_POINT'),
  ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'ANSWERED',
   'I would inject the instance through an interface so a test can replace it with a fake.', 0.910, 14000, false, NULL)
ON CONFLICT DO NOTHING;
