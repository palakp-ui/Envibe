# Envibe Relational Assessment MVP

Envibe is a Pymetrics-like behavioral assessment platform concept for developing
an explainable profile of a person's relational style. This implementation is
original: it does not copy Pymetrics' proprietary games, scoring, or product
flows.

## What is implemented

- Candidate intake with optional fairness-monitoring consent.
- Two browser-based behavioral tasks:
  - **Balloon Pop**: a visual risk-reward mini-game that maps pumping,
    banking, popping, and learning-after-loss behavior to psychological trait
    signals.
  - **Auditory Screen**: target-tone detection, response timing, and false-alarm
    restraint.
- Backend telemetry capture through Next.js API routes.
- Server-side scoring pipeline that produces:
  - task metrics,
  - relational trait scores,
  - system-assigned relational style profile matches,
  - explainable report evidence and caveats.
- Developer dashboard for candidate/profile comparison and cognitive trait
  breakdowns.
- Admin governance console with audit logs, cognitive-task governance notes, and
  fairness monitoring hooks.
- File-backed MVP persistence in `.relational-data/store.json`.

## Getting started

```bash
npm install
npm run dev
```

Open:

- `/assessment` to complete a candidate flow.
- `/developer` to compare completed reports.
- `/admin` to review audit and fairness hooks.

## Verification

```bash
npm run lint
npm run build
```

## Architecture

- **Next.js App Router** renders candidate, developer, admin, and report views.
- **Client task runner** uses React state and Web Audio for browser-based
  interaction tasks.
- **API routes** persist sessions, telemetry, and score reports.
- **Scoring module** maps task metrics to relational traits using transparent
  weighted formulas.
- **Storage module** writes an auditable JSON store suitable for MVP demos.

## Interpretation guardrails

The report is descriptive and should not be treated as a clinical diagnosis, a
standalone hiring recommendation, or a deterministic measure of relationship
quality. Device setup, language context, browser audio behavior, and task
completion quality can influence scores. Fairness monitoring is aggregate-only
and requires stronger governance before consequential deployment.
