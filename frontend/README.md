# TableFlow – Frontend

React Native app for iOS, Android and Web, built with [Expo](https://expo.dev) (SDK 57), Expo Router, NativeWind (Tailwind for React Native), Reanimated and Moti.

## What is here (Phase 3)

- **Design system** in `src/components/ui` and `src/theme`: dark-slate and light themes as CSS variables, Bricolage Grotesque + DM Sans, text variants, buttons, inputs, filter chips, badges, cards, bottom sheet, table tiles.
- **Navigation** (Expo Router): guest tabs (Explore, Reservations, Profile), a sign-in modal, a restaurant screen, and a staff area that only staff and admins can reach.
- **API layer** in `src/lib/api`: typed client generated from the backend's OpenAPI schema, error mapping, token storage (keychain on device, `localStorage` on web).
- **Working screens** against the real backend: sign in / create account, explore restaurants with search, **city filter** and "open now", restaurant details, profile with theme switch.

Booking, the floor plan and the reservation list arrive in the next phase.

## Run it

```bash
# 1. backend (from the repo root) – see the main README
cd backend && uvicorn src.main:app --reload         # http://localhost:8000

# 2. app
cd frontend
npm install
cp .env.example .env        # optional, see the file for device setups
npx expo start              # press w for web, i for iOS, a for Android
```

## Commands

| Command                           | What it does                                                      |
| --------------------------------- | ----------------------------------------------------------------- |
| `npm run typecheck`               | TypeScript (`strict`)                                             |
| `npm run lint` / `npx eslint .`   | ESLint (`eslint-config-expo`)                                     |
| `npm run format` / `format:check` | Prettier (with the Tailwind class sorter)                         |
| `npm test`                        | Jest + React Native Testing Library                               |
| `npm run api:types`               | Regenerate `src/lib/api/schema.ts` from `../backend/openapi.json` |
| `npx expo export --platform web`  | Production web build into `dist/`                                 |

## Structure

```
src/
├── app/                  Expo Router routes (thin: they only render a screen)
│   ├── (tabs)/           guest tabs
│   ├── (auth)/sign-in    modal, only while signed out
│   ├── (staff)/          only staff and admins
│   └── restaurant/[id]
├── features/             screens and logic per domain (auth, restaurants)
├── components/ui/        design-system components
├── theme/                tokens, ThemeProvider (dark / light / system)
└── lib/                  api client, generated schema, token storage
```

## Conventions

- **Styling:** NativeWind classes with theme tokens (`bg-surface`, `text-fg`), never hard-coded colours. Text goes through `AppText`; a variant owns size and font, a tone owns colour. Do not override either with `className`: NativeWind does not resolve conflicting utilities by their order.
- **Modals render outside the themed root** (a portal on web). Wrap their content in the theme variables, as `BottomSheet` does.
- **API contract:** the backend exports `backend/openapi.json`; run `npm run api:types` after an API change. CI fails when the generated types are stale.
- **Accessibility:** roles, labels and states on every control; contrast of every text/surface pair is unit-tested; reduced motion turns movement into short fades.
- **Tests** exercise behaviour through roles and labels, with the API layer mocked at `@/lib/api`.
