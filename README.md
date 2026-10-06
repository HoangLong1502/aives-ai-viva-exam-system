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

On first boot against an **empty** Postgres volume the API applies `schema.sql` and `seed.sql` once, then records that in `app_meta`. Later restarts keep every account and row you created.

**Do not** run `docker compose down -v` unless you intentionally want a blank database. The `-v` flag deletes the `aives_pgdata` volume (all users, exams, questions). Prefer:

```bash
docker compose down      # stop containers, keep data
docker compose up -d     # start again with the same data
```

Only recreate the volume when the SQL schema itself must be rebuilt (rare):

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

## Accounts & demo data

Demo rows live in `backend/src/main/resources/seed.sql` (admin / teacher / students, courses, rubrics, sample questions and exam sessions). Default demo password: `Password123` for `admin@aives.test`, `teacher@aives.test`, `student1@aives.test`, `student2@aives.test`, `student3@aives.test`.

Accounts you **register** in the UI are stored only in your local Docker volume. They are **not** in Git. Restarting the API does not delete them; wiping the volume does.

### Share your DB content with teammates (pull and see the same exams)

Git never copies Docker volumes. To ship the data you created (users, courses, questions, exam sessions):

1. Keep Postgres running with your data.
2. Export into the seed file and commit it:

```bash
npm run db:export-seed
# or: bash scripts/export-seed.sh
git add backend/src/main/resources/seed.sql
git commit -m "Update shared demo seed from local database"
git push
```

3. Teammates pull, then on a **fresh** volume (first time, or after `down -v`):

```bash
docker compose up -d
cd backend && mvn spring-boot:run
```

They get the same seed rows. Uploaded PDF/DOCX files and `knowledge_chunk` embeddings are **not** exported (re-upload materials on each machine if needed).

## Knowledge embeddings

Passages are embedded with all-MiniLM-L6-v2 and stored as `vector(384)` in Postgres.

- `POST /api/knowledge` with `{ "courseId", "title", "content" }` — examiner or administrator
- `GET /api/knowledge` — list stored passages
- `GET /api/knowledge?q=strong oral answer` — nearest passages by cosine similarity

## Layout

```
frontend/   Next.js app (login + home)
backend/    Spring Boot API (auth, users, embeddings)
scripts/    db seed export helpers
docker-compose.yml   PostgreSQL 16 + pgvector
```
