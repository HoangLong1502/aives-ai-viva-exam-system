# AIVES API

Spring Boot service for login, roles, and knowledge embeddings.

## Run

From this directory, with Postgres already running from the repo root:

```bash
mvn spring-boot:run
```

`GET /api/health` answers on port 4000.

`POST /api/knowledge` (body `courseId`, `title`, `content`) embeds `title` and `content` with all-MiniLM-L6-v2 (384 dimensions) and stores the vector in the `knowledge_chunk` table. `GET /api/knowledge?q=...` ranks those rows by cosine similarity. Creating knowledge requires an examiner or administrator token.
