# OpenTranslateOffice

OpenTranslateOffice is a full-stack translation agency platform for customer intake, translator operations, document handling, and AI-assisted workflows.

It combines:

- a premium public landing page
- structured request intake by form, chat, and voice-ready architecture
- an employee translation workbench
- a customer portal for request tracking and file delivery
- local development storage with a Docker-managed LibreOffice conversion service

## Product Scope

The project is designed around two user groups:

- Customers: submit documents, define translation requirements, receive tracking credentials, and download delivered files
- Employees/Admins: manage intake, review source files, assign translators, translate and deliver documents, and manage integrations

## Tech Stack

### Frontend

- Vite
- React
- TypeScript
- React Router
- TanStack Query
- Tailwind CSS
- Lucide icons

### Backend

- Node.js
- Express
- TypeScript

### Data and Infrastructure

- SQLite
- Drizzle ORM
- Local file storage for development
- Docker-managed LibreOffice headless container for document conversion and preview support

### AI and Voice

- OpenRouter as the external LLM gateway
- Default model: `google/gemini-3.1-flash-lite-preview`
- ElevenLabs integration points for browser voice intake

## Current Feature Set

- Public marketing and intake landing page
- Customer request form with file upload
- AI-assisted intake chat with structured field extraction
- Customer request tracking portal using request number and password
- Employee dashboard and translation workbench
- Admin area for translators and integration settings
- Source document preview support
- Deliverable upload and customer download flow
- AI-assisted document translation pipeline
- Docker tooling for LibreOffice deployment, restart, stop, and cleanup
- English and Polish UI support

## Screenshots

### Landing Page

![Landing page](./screenshot/Screenshot%20From%202026-03-08%2015-40-31.png)

### Intake Flow

![AI intake flow](./screenshot/Screenshot%20From%202026-03-08%2015-40-42.png)

### Translator Workbench

![Translator workbench](./screenshot/Screenshot%20From%202026-03-08%2015-40-47.png)

### Document Viewer

![Document viewer](./screenshot/Screenshot%20From%202026-03-08%2015-41-19.png)

### Admin and Operations

![Admin console](./screenshot/Screenshot%20From%202026-03-08%2015-41-29.png)

## Monorepo Structure

```text
.
├── apps/
│   ├── api/            # Express API
│   └── web/            # React frontend
├── packages/
│   ├── db/             # Drizzle schema and database helpers
│   └── shared/         # Shared types and validation
├── docker_container/   # LibreOffice container assets and management script
├── screenshot/         # README screenshots
└── storage/            # Local development file storage (ignored)
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create local environment file

```bash
cp .env.example .env
```

Then fill in the values you actually need, especially:

- `JWT_SECRET`
- `OPENROUTER_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_WEBHOOK_SECRET`

### 3. Start the LibreOffice conversion container

```bash
./docker_container/manage-libreoffice.sh deploy
```

Useful container commands:

```bash
./docker_container/manage-libreoffice.sh status
./docker_container/manage-libreoffice.sh restart
./docker_container/manage-libreoffice.sh stop
./docker_container/manage-libreoffice.sh delete
```

### 4. Prepare the database

```bash
npm run db:generate
npm run db:push
```

### 5. Start the application

In separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Frontend:

- `http://localhost:5173`

API:

- `http://localhost:4000`

## Workspace Commands

```bash
npm run dev:web
npm run dev:api
npm run build
npm run typecheck
npm run db:generate
npm run db:push
```

## Default Local Login

On first API start, the application seeds a default admin account:

- Email: `admin@oto.local`
- Password: `change-this-admin-password`

This is for local development only. Change it immediately in any non-local environment.

## Document Handling Notes

The project includes a realistic but still evolving document pipeline.

- PDF preview works in-browser
- Word-family preview is generated server-side through LibreOffice conversion to PDF
- AI translation for `.docx` preserves structure better than raw text reconstruction
- Scanned PDF translation is best-effort and still requires human review
- Complex layouts, tables, stamps, signatures, and tightly designed resumes may still lose fidelity after OCR and reconstruction

That last point matters: this repository already contains the right architecture for document workflows, but high-fidelity legal/desktop-publishing translation is still a hard problem and should be treated as assisted automation, not blind final output.

## Security Notes

Before publishing this repository:

- keep `.env` out of version control
- never commit provider keys
- rotate any key that was ever exposed locally or in chat
- keep `storage/` and local SQLite files out of Git

This repository is now prepared so that:

- `.env` is ignored
- local storage is ignored
- local SQLite database is ignored
- `.env.example` remains safe to commit

## GitHub Upload Checklist

- Review `git diff` before first commit
- Confirm `.env` contains no real secrets
- Confirm `apps/api/dev.sqlite` is not tracked
- Confirm `storage/` is not tracked
- Confirm screenshots in `screenshot/` are intentional to publish

## Status

This is an active build, not a finished commercial release. The foundation is in place, but some advanced areas still need hardening:

- scanned-PDF translation fidelity
- background job orchestration
- production auth hardening
- audit and notification depth
- broader localization coverage
- deployment automation beyond local Docker tooling

## License

No license file is included yet. Add one before publishing if you want the repository to have explicit usage terms.
