# Agentic Workflow Framework

A Next.js app that operationalizes a 4-phase methodology for turning legacy business
processes into AI-agent-driven workflows, backed entirely by Notion:

1. **Process Deconstruction** — log a process's steps and see an auto-computed baseline
   (cycle time, cost, bottlenecks).
2. **Agentic Feasibility Analysis** — score each step on data complexity, decision logic,
   and context volatility; get a weighted suitability score, a classification
   (Algorithmic / Agentic / Human-required), and a scatter chart.
3. **Agentic Orchestration Design** — define an agent blueprint (name, role, trigger,
   upstream agent, human-in-the-loop exception rule) and see it as a flow diagram.
4. **Value Realization** — track baseline → current → target for named metrics
   (cycle time, cost, quality, human hours reallocated), with KPI cards and a
   comparison chart.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Notion API (`@notionhq/client`) ·
Recharts · Vitest

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations), create a new
   internal integration, and copy its **Internal Integration Secret**.
2. In Notion, create a page to hold this app's data (leave it empty — the setup script
   creates the databases inside it).
3. On that page, click **"•••"** → **"Connections"** → add your integration.
4. Copy the page's ID from its URL — the 32-character string right before any `?` in the
   URL (with or without dashes).

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NOTION_TOKEN` (the integration secret from step 2) and `NOTION_PARENT_PAGE_ID`
(the page ID from step 2).

### 4. Provision the Notion databases

```bash
npm run setup:notion
```

This creates (or, on re-run, reuses) five databases under your parent page: Processes,
Process Steps, Suitability Scores, Agent Blueprint, and Value Metrics. It prints the
resulting database IDs — add each one to `.env.local`.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm run test
```

## Deploying

This is a standard Next.js app with no Vercel-specific features — it deploys the same
way to any platform.

### Option A: Vercel (or another git-integrated Next.js host)

1. Import this repository into [Vercel](https://vercel.com/new) (or your host of choice).
2. Set the seven environment variables from `.env.local` (`NOTION_TOKEN`,
   `NOTION_PARENT_PAGE_ID`, `NOTION_PROCESSES_DB_ID`, `NOTION_STEPS_DB_ID`,
   `NOTION_SUITABILITY_DB_ID`, `NOTION_AGENT_BLUEPRINT_DB_ID`,
   `NOTION_VALUE_METRICS_DB_ID`) in the host's project settings.
3. Deploy. No build configuration changes are needed.

### Option B: Docker (any hyperscaler — AWS, Azure, GCP, or self-hosted)

The included `Dockerfile` produces a self-contained image using Next.js's `standalone`
output — no host-specific configuration required.

```bash
docker build -t agentic-workflow-app .
docker run -p 3000:3000 --env-file .env.local agentic-workflow-app
```

This image runs identically on:

- **AWS**: ECS/Fargate, App Runner, or EC2 with Docker
- **Azure**: Container Apps or App Service (container deployment)
- **GCP**: Cloud Run or GKE
- Any VM or Kubernetes cluster with a container runtime

Push the built image to your registry of choice (ECR, ACR, Artifact Registry, Docker
Hub) and point your platform's container service at it, passing the same seven
environment variables at deploy time.

### Access control

There is no user authentication in this version — anyone with the deployed URL can use
the app. Restrict access at the hosting layer (e.g. Vercel's password protection, a
cloud load balancer's IP allowlist, or a sidecar auth proxy) if needed.

## Project structure

- `app/` — Next.js App Router pages and API routes
- `components/` — React components (phase tabs, forms, charts, cards)
- `lib/notion/` — Notion data-access layer, one file per database
- `lib/scoring.ts`, `lib/orchestration.ts` — pure business logic (scoring formulas,
  orchestration chain ordering)
- `scripts/setup-notion.ts` — one-time (idempotent) Notion database provisioning script
- `docs/superpowers/` — design spec and implementation plans for each phase
