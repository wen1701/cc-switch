# Goal
Keep provider-discovered Codex models without manual name mapping in this personal fork.

# Constraints
- Reuse upstream provider persistence and transactional catalog projection.
- Native Responses Codex providers only; leave Claude, OAuth, and protocol conversion unchanged.
- Store model IDs per provider, separately from manually configured rows. Never store credentials in discovery data.
- Empty/failed/stale refreshes preserve the last successful list; edits to credentials/address invalidate it.
- Reuse exact local Codex metadata when available; unknown models get conservative capabilities, never another model's identity.

# Success criteria
- Fetch/save/reopen preserves discovered IDs. Switching A/B projects only that provider's models.
- Manual rows win and survive refresh; removed discovered IDs disappear after a successful nonempty refresh.
- Known GPT entries retain tools/reasoning/context metadata; original model IDs are sent unchanged.
- Frontend tests/typecheck/build and backend catalog tests pass. Report any desktop build limitations.

# Steps
1. Inspect upstream persistence, discovery and catalog generation.
2. Connect discovered IDs to provider storage and native catalog generation.
3. Add regression tests and usage notes; validate and push to wen1701/cc-switch.

# Progress
- Upstream and fork at 74f4614; SSH access works. Frontend dependencies installed.
- Existing modelCatalog.models already persists manual rows and projects catalogs on switch.
- Implemented modelCatalog.discoveredModels per provider, separate from manual rows; native Responses only.
- Frontend fetch/save/reopen, failure/empty refresh, identity invalidation and stale-response regressions pass (39 relevant tests). Typecheck and renderer build pass.
- Four isolated Rust tests pass; generated output parsed by installed Codex 0.159.0 model/list in a temporary profile (gpt-6.1-sol + unknown ID, no inference).
- Added fork-only Linux test/package workflow and usage/migration notes; complete backend integration and Tauri build remain pending GitHub Actions.

# Blockers / changed assumptions
- Host Rust 1.75 and missing GTK/WebKit development libraries prevent a full local Tauri build. Upstream pins Rust 1.95; use fork CI for full integration checks if available.
