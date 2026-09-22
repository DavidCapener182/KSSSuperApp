# Inactive Codex configuration examples

These are not installed or enabled. Verify client support and available models, then merge `project-config.toml` into the intended repository’s `.codex/config.toml`. Place appropriate individual role files in `.codex/agents/` only after checking existing definitions. Never replace global settings, secret values, permission/sandbox choices or managed configuration.

The lead remains responsible for choosing the active parent model. A supported project default does not prove a running session has changed model. Custom agent model/effort fields can take precedence over generic spawn defaults; select the correct role when delegating and verify observed runtime details.

The supplied concurrency setting caps concurrently open spawned threads where supported. No nested spawning, total launches, escalation permission and financial budget are behavioural rules, not hard enforcement supplied by these templates. Keep the effective sandbox/approval policy intact; runtime overrides may take precedence over role defaults.

Schemas/model IDs checked against official references on 22 September 2026; TOML parsing is not a test of your actual Codex account or client. Sources O1–O3 are in the playbook.
