# OpenTranslateOffice

OpenTranslateOffice is a full-stack translation agency platform for customer intake, translator operations, document handling, callback management, and AI-assisted workflows.

It combines:

- a polished public website for request intake and callback requests
- structured intake by form, AI chat, and ElevenLabs voice collection
- a translator workbench with previews, notes, delivery, and AI document tools
- an admin console for staff management, integrations, and scheduling
- a callback queue that keeps website and ElevenLabs-originated requests separate
- local development storage with a Docker-managed LibreOffice conversion service

## Product Scope

The project is designed around two user groups:

- Customers: submit documents, define translation requirements, request callbacks, receive tracking credentials, and download delivered files
- Employees/Admins: manage intake, callbacks, schedules, review source files, assign translators, translate and deliver documents, and manage integrations

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
- ElevenLabs ConvAI widget for browser voice intake and callback capture

## Current Feature Set

- Public landing page with request intake, callback intake, and embedded ElevenLabs voice assistant
- Standard request submission with multi-file upload and customer portal credential generation
- AI-assisted intake chat that asks for missing details progressively instead of dumping a full checklist
- Customer callback request flow with preferred call time and project summary
- Callback queue for staff with:
  - source tracking (`WEB` vs `ELEVENLABS`)
  - status management (`PENDING`, `SCHEDULED`, `COMPLETED`, `CANCELLED`)
  - import of all new ElevenLabs conversations since the last successful sync
  - delete/filter controls for queue cleanup
- Customer portal with request login, delivered-file downloads, and cancelled/deleted request lifecycle handling
- Translator workbench with:
  - status transitions
  - assignment and reassignment
  - internal notes
  - final deliverable upload
  - source document preview
  - AI translation actions
  - translated-file conversion via LibreOffice-supported formats
- Admin console with:
  - user creation
  - role management
  - account deactivation and guarded deletion
  - reset-password modal flow
  - integration settings for OpenRouter and ElevenLabs
- Dedicated work calendar page for scheduled employee workload
- Scheduling engine that:
  - estimates work from page count
  - uses 20 minutes per page
  - avoids assigning automated work to admin users
  - allocates work to employees on a rota
  - respects urgency windows for standard, next-day, and same-day jobs
- Verified or inferred page-count support for scheduling and intake review
- Docker tooling for LibreOffice deployment, restart, stop, and cleanup
- English and Polish UI support

## Screenshots

### Landing Page

![Landing page](./screenshot/Screenshot%20From%202026-03-10%2005-09-31.png)

### AI Intake Assistant

![AI intake flow](./screenshot/Screenshot%20From%202026-03-10%2005-09-48.png)

### Translator Workbench

![Translator workbench](./screenshot/Screenshot%20From%202026-03-10%2005-09-55.png)

### Work Calendar

![Work calendar](./screenshot/Screenshot%20From%202026-03-10%2005-10-44.png)

### Callback Request Form

![Callback request form](./screenshot/Screenshot%20From%202026-03-10%2005-10-56.png)

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

The API dev server runs in watch mode and reloads route changes automatically.

## Workspace Commands

```bash
npm run dev:web
npm run dev:api
npm run build
npm run typecheck
npm run db:generate
npm run db:push
```

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

## Status

This is an active build, not a finished commercial release. The foundation is in place, but some advanced areas still need hardening:

- deeper ElevenLabs automation beyond queue sync
- background job orchestration
- production auth hardening
- notification depth
- broader localization coverage
- deployment automation beyond local Docker tooling

## License

No license file is included yet. Add one before publishing if you want the repository to have explicit usage terms.
