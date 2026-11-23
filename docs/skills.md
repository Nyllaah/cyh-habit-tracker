# Repository skills

Project-local copies of three skills from the [Tech Leads Club catalog](https://github.com/tech-leads-club/agent-skills) are stored in `.agents/skills/`. These are development instructions, not application dependencies. They are eligible for version control so another checkout carries the same guidance.

All skill files were installed unchanged from revision `d0c46bfad8b1a428035beb91c1ee70a6d7356536` using the Codex skill-installer GitHub helper on 2026-11-22. [The manifest](skills-manifest.json) records every upstream file's Git blob hash. This was a direct source installation, not an execution of the TLC npm CLI; no npm dependency or CLI lockfile was added.

| Skill | Version | Attribution | Role in this project |
| --- | --- | --- | --- |
| [TLC spec lean](../.agents/skills/tlc-spec-lean/SKILL.md) | 3.2.0 | Tech Leads Club; CC BY 4.0 | Planning structure, behavioral criteria, incremental vertical delivery; planning phase only so far |
| [Frontend design](../.agents/skills/frontend-design/SKILL.md) | 1.0.0 | Impeccable / Paul Bakaus, based on Anthropic frontend-design; upstream Apache 2.0 | Playful journey design, hierarchy, concise labels, typography, motion guidance |
| [Best practices](../.agents/skills/best-practices/SKILL.md) | 1.0 | web-quality-skills / Addy Osmani; MIT | Installed and inspected for future implementation and quality checks; no application audit has been completed |

The catalog directory for `best-practices` is `(quality)/web-best-practices`; the skill's declared name remains `best-practices`. The local directory follows that declared name. The frontend skill includes all seven references; TLC includes all references, scripts, and its validation fixture.

## Applying the guidance

The challenge constraints in `AGENTS.md` and the project requirements take precedence over generic examples. Use the repository-local frontend skill for this project when another installed skill has the same name. Skills guide judgment; their examples are not application requirements.

Keep the specification in [plan.md](plan.md) focused on technical requirements and decisions. The current design is a review proposal. Installation does not constitute a completed implementation or quality audit.

During implementation, verify framework guidance against the installed Next.js docs. In particular, do not copy the best-practices skill's third-party polyfill loader, fixed sample CSP nonce, or blanket geolocation-denial policy into this app. Use needed browser capabilities directly, preserve the explicit location action, and evaluate any headers in the actual framework context. Do not add authentication, analytics, or an error-tracking service just because an example uses one.

## Credits and licenses

- Tech Leads Club curates the installed catalog. Its [license notice](skill-licenses/tlc-catalog-license.txt) distinguishes MIT software tooling from CC BY 4.0 maintainer-authored skill content and third-party licenses.
- TLC spec lean is credited to Tech Leads Club under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its planning structure is adapted in `docs/plan.md`; the installed skill itself is unchanged.
- Frontend design credits [Impeccable](https://github.com/pbakaus/impeccable), Paul Bakaus, and the Anthropic frontend-design foundation. The upstream [Apache 2.0 license](skill-licenses/impeccable-LICENSE.txt) is included because the catalog copy has no separate license file.
- Best practices credits [web-quality-skills](https://github.com/addyosmani/web-quality-skills). Its upstream [MIT license](skill-licenses/web-quality-LICENSE.txt) is included.

License copies were retrieved from the credited upstream projects on the installation date. Only the three skill directories are pinned by the catalog manifest. There are no local modifications inside those directories.
