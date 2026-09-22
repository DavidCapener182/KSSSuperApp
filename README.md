# KSS Enterprise Platform

This repository contains the development foundation for the KSS Enterprise Platform. The current screen is a minimal application shell. It has no authentication, business records, operational data or external integrations.

## Local setup

Use Node.js 24 and npm 11 (verified with Node.js 24.18.0 and npm 11.16.0).

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Checks

```bash
npm run lint
npm run build
npm run smoke
```

The smoke test starts the production build locally and checks the served page. Run `npm run build` before `npm run smoke`.

For delivery scope and decisions, see [status](docs/delivery/STATUS.md), [architecture](docs/delivery/ARCHITECTURE.md) and [TASK-01A](docs/delivery/TASK-01A.md).
