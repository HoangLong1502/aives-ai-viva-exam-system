# AIVES — AI Viva Exam System

Login and home pages for an oral-exam workspace.

| Layer | Stack |
| --- | --- |
| Frontend | Next.js + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Java 21 + Spring Boot |
| Database | PostgreSQL + pgvector |

## Run locally

You need **JDK 21+**, **Maven**, **Node.js 22+**, **npm**, and **Docker** (for Postgres with pgvector).

```bash
docker compose up -d
cd backend
mvn spring-boot:run
```

The API applies Flyway migrations from `backend/src/main/resources/db/migration` on startup, including `knowledge_chunk.embedding` (`vector(384)`). Text is embedded locally with all-MiniLM-L6-v2 and stored in pgvector. If Postgres was created from the previous image, recreate it once:

```bash
docker compose down -v
docker compose up -d
```

In another terminal:

```bash
cd frontend
npm run dev
```

From the repo root you can also run both apps together after Postgres is up:

```bash
npm install
npm run dev
```

- App: [http://localhost:3001](http://localhost:3001)
- API: [http://localhost:4000/api/health](http://localhost:4000/api/health)

Postgres is mapped to **5433** so it does not collide with other local databases on 5432. The Next.js app uses **3001** for the same reason.

## Accounts

The API does not seed users, subjects, exams, or course material. Create an administrator, then assign teachers and students. Login returns a JWT that includes `sub`, `email`, and `role`.

## Knowledge embeddings

Passages are embedded with all-MiniLM-L6-v2 and stored as `vector(384)` in Postgres.

- `POST /api/knowledge` with `{ "courseId", "title", "content" }` — examiner or administrator
- `GET /api/knowledge` — list stored passages
- `GET /api/knowledge?q=strong oral answer` — nearest passages by cosine similarity

## Layout

```
frontend/   Next.js app (login + home)
backend/    Spring Boot API (auth, users, embeddings)
docker-compose.yml   PostgreSQL 16 + pgvector
```
