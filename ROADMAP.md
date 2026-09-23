# Roadmap

TableFlow was built strictly iteratively: one phase at a time, a short plan agreed before each
one, small Conventional Commits along the way. This file tracks phase status; see the root
[README.md](README.md) for what the app actually does today.

- [x] **Phase 0** – Project structure and documentation
- [x] **Phase 1** – FastAPI + database setup, reservation validation and anti-double-booking
- [x] **Phase 2** – Authentication (JWT), restaurants and tables management
- [x] **Phase 3** – Expo + NativeWind app shell, navigation, theming, API layer
- [x] **Phase 4** – Booking flow (4A); staff floor plan and day list with Reanimated/Moti
      animations and keyboard shortcuts (4B); role-based routing, a persistent staff console shell
      and a web-only top bar for the guest tabs (4C)
- [x] **Phase 5** – Polish, keyboard shortcuts, CI, deployment:
  - Calmer modal/dialog motion on mobile (`BottomSheet`, `ConfirmDialog`), matching the web feel
  - Expanded web keyboard shortcuts (quick search, view/status switching, a `?` shortcuts overlay)
    across the guest screens and the staff console
  - `.github/workflows/ci.yml`: a single CI pipeline (merged from the earlier separate backend/
    frontend workflows) that lints and tests both sides on every push and pull request, gated by
    which part of the repo changed
  - Production-shaped deployment files: a multi-stage, non-root `backend/Dockerfile` with a
    healthcheck, `docker-compose.prod.yml`, and `frontend/vercel.json` / `frontend/netlify.toml`
    for the static web export
  - A polish pass over the app (visual inconsistencies, TypeScript gaps, console warnings)
