# Golden Topper Website

Golden Topper's public website and custom Admin CMS, built with Next.js. The
application presents property developments and company content, collects customer
inquiries and loan referrals, and provides content management tools.

## Capabilities

- Public project pages with unit layouts, amenities, maps and panoramic tours.
- Company story, news and updates, promotions, partner banks and a buyer's guide.
- Contact, property inquiry and loan pre-application forms.
- A payment information wizard and configurable property showcase. Payment
  gateway processing is not yet configured.
- Cookie preferences, optional-media controls and form notice dialogs. These
  controls do not implement a privacy-management CMS or server-side consent ledger.
- A custom CMS for website content, project navigation, users and permissions,
  customer messages and activity history.

## Technology

- Next.js 16, React 19 and TypeScript.
- Tailwind CSS 4 and Poppins through `next/font/google`.
- Supabase database, Storage and Realtime integrations.
- React Hook Form and Zod for form handling and validation.
- Tiptap for rich-text editing.
- Leaflet and React Photo Sphere Viewer for maps and panoramic tours.
- GSAP, Lenis and Framer Motion for animation.
- Cloudflare Turnstile for verification in selected workflows.

Exact dependency versions are recorded in `package-lock.json`.

## Repository structure

```text
app/        Public routes, CMS, Server Actions, components and local data
lib/        Shared validation, rendering and application helpers
utils/      Client utilities
public/     Static images and media
supabase/   Database migrations and supporting SQL
tests/      Node regression tests and local browser fixtures
scripts/    Diagnostic and verification utilities
```

## Local development

Prerequisites:

- Node.js and npm compatible with the locked dependencies. The local verification
  environment used Node.js 24 and npm 11; runtime versions are not pinned here.
- An appropriately configured development Supabase environment and its authorized
  development credentials. The migrations are incremental changes, not a complete
  database bootstrap.
- Development Turnstile configuration for workflows that require verification.
- Chrome, Chromium or Edge for browser fixtures. Set `CHROME_PATH` to the browser
  executable if it is not detected automatically; those tests skip without one.

Install dependencies from the committed lockfile:

```sh
npm ci
```

The existing `.npmrc` supplies the repository's `legacy-peer-deps` setting. Keep
the lockfile and this setting together when reproducing the dependency install.

Copy `.env.example` to `.env.local` and replace its placeholders with approved
development values. Do not use production credentials for local development.
The example contains configuration names and placeholders only; it is not a
working service configuration.

Variables prefixed with `NEXT_PUBLIC_` are browser-visible. Keep server-only keys
server-side and never commit actual credentials or local environment files.

Start the application:

```sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). The development script uses Webpack.
Database-backed features require the corresponding development schema and data.

## Commands and checks

Run these from the repository root after installation:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with Webpack |
| `npm run build` | Create an optimized Next.js build |
| `npm start` | Serve a previously successful build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the regression suite, including available browser fixtures |
| `npm run typecheck` | Run TypeScript checking independently |

Tests use local fixtures and mocked services; passing them does not establish
live database or deployment behavior. Run lint and TypeScript checks separately
from the build and review any reported failures. Font fetching during a build
requires network access.

Deployment requires separately configured hosting, environment variables and
database prerequisites. This repository does not include a configured CI
pipeline or a verified one-command production deployment workflow.
