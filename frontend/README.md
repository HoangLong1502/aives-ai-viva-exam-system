# AIVES frontend

Web client for the AI Viva Exam System. It serves the sign-in flow and the student, teacher, and administrator workspaces, and talks to the Spring Boot API over HTTP.

## Stack

| Area | Technology |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) App Router, React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, CSS variables, `tw-animate-css` |
| Components | [shadcn/ui](https://ui.shadcn.com) (Base UI, style `base-nova`), `class-variance-authority` |
| Icons | [Lucide](https://lucide.dev) |
| Feedback | Sonner toasts, `next-themes` |
| Typography | Be Vietnam Pro and Lora, loaded with `next/font` |
| Auth | JWT session cookie; Google Identity Services for Google sign-in |
| Speech | Browser Web Speech API for recognition; a small client for text-to-speech |
| Interface language | English and Vietnamese message catalogs |
| Lint | ESLint 9 with `eslint-config-next` |

The development server uses Turbopack. The app is a client of the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`). It does not host its own database.

## Run locally

Requires Node.js 22+ and npm. Start Postgres and the API from the repository root first; see the root [README](../README.md).

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API origin. Defaults to `http://localhost:4000`. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client id. Leave empty to hide a working Google button. |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
