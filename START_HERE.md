# Start here — KSS Codex build

## Using this pack

Extract the pack into the KSS project folder, or a clearly named planning subfolder of an existing repository. Do not overwrite existing application files. Open that project in Codex. The pack is documentation and inactive configuration templates, not a built application.

For the initial planning task choose **GPT-5.6 Sol Medium**, when available. After that, **GPT-5.6 Terra Medium** is the proposed everyday lead. Model availability and effective settings must be checked in your client. This instruction does not itself switch an already running model. [O1]

Paste the instruction below. It starts Phase 00 only. You do not need to paste the entire master into the message.

---

Act as the technical lead for the KSS Enterprise Platform. The master specification is the complete product reference, not an instruction to build the entire product in one run.

Locate this pack and any existing application repository. Read `docs/specification/KSS_Enterprise_Platform_Master_Codex_Prompt_v2_1.md`, `KSS_Codex_Build_Playbook.md` and `prompts/PHASE-00.md`. Inspect the current code, instructions, dependencies and tests. Preserve uncommitted work and do not overwrite existing configuration.

**Execute Phase 00 only: technical discovery and build preparation. Do not build the application yet.**

Produce a repository-aware architecture recommendation, permission/data-boundary map, requirements-to-phase map, unresolved dependency log and the first bounded implementation task. Preserve the baseline; research proposals remain proposed until accepted. Do not invent the LMS, payroll provider, APIs or legal/financial rules.

You may delegate useful, tightly scoped discovery/review work. Check the actual available models and subagent/configuration controls first. Use Luna for explicit read-only lookups, Terra for normal work, and Sol for difficult architecture/security review. Do not use GPT-6 Astra without my approval. Set worker model and effort explicitly where supported so they do not silently inherit an expensive parent. Report requested versus actually observable settings; if mixed-model delegation is unavailable, say so and use a supported economical fallback.

Use a maximum of two concurrent subagents in addition to the lead, no nested agents and no unnecessary parallelism. Give each a precise task and relevant files, not the entire master. Do not let multiple agents edit shared files. Allow no more than two repair cycles on the same failure before narrowing, escalating within the permitted models or reporting the blocker. Do not increase paid usage, switch billing routes, enable Fast/Max/Ultra by default or buy services.

Prepare a concise `AGENTS.md` and compatible project-scoped agent configuration by merging the supplied templates only where appropriate. Record actual model routing and limits. Do not change global configuration, sandbox rules or existing managed controls. Keep sensitive records/secrets out of prompts, fixtures and logs.

Update `docs/delivery/STATUS.md`, `DECISIONS.md`, `MODEL_ROUTING.md` and `USAGE_LEDGER.md` with facts. Show the first implementation task, its scope, dependencies, file ownership and acceptance checks. Record usage only when measurable; do not claim a guaranteed financial cap.

Finish with the decisions I genuinely need to make, your recommended first task and what will demonstrate that it works. Stop before Phase 01 or any product build, paid service, live-data import or deployment.

---

## After Phase 00

Review the decisions and first task, then use the relevant next phase brief. Within a phase, ask for the next ready bounded task. At the end of a phase, approve the demonstrated outcome before moving on. Apply the Phase 11 release gate to any early live pilot; do not wait until all optional modules are built.

**Source O1:** `https://developers.openai.com/codex/models`. Other official references and limitations are in the playbook. Checked 22 September 2026.
