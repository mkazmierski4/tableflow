# TableFlow – Frontend

React Native app for iOS, Android and Web, built with [Expo](https://expo.dev) (SDK 57), Expo Router, NativeWind (Tailwind for React Native), Reanimated and Moti.

## What is here (Phase 4A: guest reservations)

- **Design system** in `src/components/ui` and `src/theme`: dark-slate and light themes as CSS variables, Bricolage Grotesque + DM Sans, text variants, buttons, inputs, filter chips, badges, cards, bottom sheet, confirm dialog, table tiles.
- **Navigation** (Expo Router): guest tabs (Explore, Reservations, Profile), a sign-in modal, the booking screen, reservation details, a confirmation screen, and a staff area that only staff and admins can reach.
- **API layer** in `src/lib/api`: typed client generated from the backend's OpenAPI schema, error mapping, token storage (keychain on device, `localStorage` on web).
- **Discovery:** search, city filter, "open now", and a date / party-size chip pair that carries over to the booking screen.
- **Booking:** pick a day and a time from the restaurant's real slots (`/availability/slots`), see the free tables for that time with the best fit preselected, reserve. If someone takes the table in the meantime the screen says so, marks it and preselects the next best one.
- **My reservations:** upcoming / past, details with the status lifecycle, reschedule (bottom sheet) and cancel (confirm dialog). Times are always shown in the restaurant's timezone.
- **Motion:** animated confirmation (ring draw + spring check), staggered reveal; everything falls back to short fades with reduced motion.

The staff floor plan and the day list arrive in Phase 4B.

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
│   ├── restaurant/[id]   booking screen
│   ├── reservation/[id]  reservation details
│   └── confirmed         booking confirmation
├── features/             screens and logic per domain (auth, restaurants, reservations)
├── components/ui/        design-system components
├── theme/                tokens, ThemeProvider (dark / light / system)
└── lib/                  api client, generated schema, token storage
```

## Conventions

- **Styling:** NativeWind classes with theme tokens (`bg-surface`, `text-fg`), never hard-coded colours. Text goes through `AppText`; a variant owns size and font, a tone owns colour. Do not override either with `className`: NativeWind does not resolve conflicting utilities by their order.
- **Modals render outside the themed root** (a portal on web). Wrap their content in the theme variables, as `BottomSheet` does.
- **API contract:** the backend exports `backend/openapi.json`; run `npm run api:types` after an API change. CI fails when the generated types are stale.
- **Accessibility:** roles, labels and states on every control; contrast of every text/surface pair is unit-tested; reduced motion turns movement into short fades. Express state with `aria-selected` / `aria-checked` / `aria-disabled` / `aria-busy`, not `accessibilityState`: react-native-web does not put the latter in the DOM, so screen readers on the web would never hear it.
- **No pressable inside a pressable.** A card that is a button and also holds buttons is invalid HTML on web (and confusing for screen readers); make the summary the pressable and the actions its siblings.
- **Signing in from another screen:** pass `next` (an in-app path) to `/sign-in`; only paths starting with a single `/` are honoured. The route guard would otherwise send a freshly signed-in guest to `/`.
- **Web quirks worth knowing:** `tslib` is pinned to its CommonJS build in `metro.config.js` (Moti's dependencies crash web rendering with the ESM build), and `jest.config.js` lets Jest transform `moti`.
- **Tests** exercise behaviour through roles and labels, with the API layer mocked at `@/lib/api`.
