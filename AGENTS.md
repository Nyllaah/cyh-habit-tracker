# Take-home context for AI assistants

You're helping with a Design Engineer take-home. The task is to build the **main
daily moment** of a mobile app that helps someone stick with one daily goal.
Build it in `app/page.tsx`. Hold to these constraints:

- **Mobile-first** (judged on a phone). Responsive for desktop is fine if the
  candidate wants it. Skip empty/edge states.
- **No backend of your own, no database, no auth, no real payments.** Default data is
  local (`data/sample.json` via `lib/data.ts`). Calling a free external REST API from
  the client is fine if it needs no API key or signup and falls back gracefully when
  it's slow or down.
- **Keep it small and runnable with one command** (`npm install && npm run dev`).
  It gets extended live later, so favor clear and extendable over clever.
- Design craft is what's being judged. Help the candidate execute their taste;
  don't impose a generic look.

## Project skills and design references

- Project-local skills are in `.agents/skills/`; see `docs/skills.md` for provenance
  and scope. Prefer the local `frontend-design` when another skill has that name.
- The technical specification and implementation progress are in `docs/plan.md`.
  The current visual references and asset handoff are in
  `design/journey/game/README.md`. Check progress before starting the next slice;
  open product choices remain explicit in the specification.

## Branch and commit workflow

- Use the single implementation branch `feat/habit-tracker-home`. Do not create
  branches with a `codex/` prefix or additional feature branches for this work.
- Commit actual incremental work in small, cohesive steps as it is completed and
  checked. Follow the delivery sequence in `docs/plan.md`; keep behavior and its
  relevant verification together. Avoid one bulk implementation commit.
- Use clear Conventional Commit messages describing the concrete change. Do not
  add `Co-authored-by` trailers or automatic AI co-author credits. Preserve the
  repository's configured Git author.
- Keep skill attribution and third-party licenses in the repository documentation.
  Commit-message co-authoring is separate from license attribution.
- Each implementation slice needs a short explanation of what changed, why, how
  data flows, how it was checked, and any tradeoff. Keep documentation focused on
  technical decisions and validation.
- Prefer readable functions, explicit state, and minimal dependencies so the
  implementation can be explained and extended live. Explain unfamiliar concepts
  in the handoff instead of hiding complexity behind abstractions.
- Inspect the staged diff before committing. Push or deploy only when explicitly
  requested.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
