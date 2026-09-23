# TableFlow – Frontend

React Native app for iOS, Android and Web, built with [Expo](https://expo.dev) (SDK 57), Expo Router, NativeWind (Tailwind for React Native), Reanimated and Moti.

## What is here

- **Design system** in `src/components/ui` and `src/theme`: dark-slate and light themes as CSS variables, Bricolage Grotesque + DM Sans, text variants, buttons, inputs, filter chips, badges, cards, bottom sheet, confirm dialog, table tiles.
- **Navigation** (Expo Router): guest tabs (Explore, Reservations, Profile — a persistent top bar on the web, the native bottom tabs on iOS/Android), a sign-in modal, the booking screen, reservation details, a confirmation screen, and a staff console that only staff and admins can reach. Staff never see the guest tabs at all: signing in, or opening any guest URL, sends them straight to the console.
- **API layer** in `src/lib/api`: typed client generated from the backend's OpenAPI schema, error mapping, token storage (keychain on device, `localStorage` on web).
- **Discovery:** search, city filter, "open now", and a date / party-size chip pair that carries over to the booking screen.
- **Booking:** pick a day and a time from the restaurant's real slots (`/availability/slots`), see the free tables for that time with the best fit preselected, reserve. If someone takes the table in the meantime the screen says so, marks it and preselects the next best one.
- **My reservations:** upcoming / past, details with the status lifecycle, reschedule (bottom sheet) and cancel (confirm dialog). Times are always shown in the restaurant's timezone.
- **Motion:** animated confirmation (ring draw + spring check), staggered reveal; everything falls back to short fades with reduced motion.
- **Staff console** (staff and admins; staff are bound to their restaurant, admins work on the first one). A persistent shell — a side rail (wide) or a bottom tab bar (phone), Today / Floor / Account — mounts once in `(staff)/_layout.tsx`; switching between them only swaps the content, so the nav never remounts or jumps.
  - **Floor plan** (`/floor`, desktop layout with a side rail and a details column): every table as it is at the chosen moment (free, pending, confirmed, seated, done, no-show), a time scrubber in 30-minute steps, day navigation, guest search. Colour changes tween in 220 ms and a change of state gives the tile a small spring pulse. A day-at-a-glance strip (reservations today, awaiting reply, seated now, free now) and a table-size filter (the console has no notion of "zones", so tables are grouped by capacity) sit above the plan. The data refreshes itself every 15 seconds while the screen is open.
  - **Reservation panel:** the lifecycle actions the backend allows (confirm, seat, complete, no-show once started, cancel or decline behind a confirm dialog), move to another free table that fits the party, reschedule, and a new reservation for a walk-in (staff may start right now or up to an hour back).
  - **Today** (`/today`, the phone layout): the day as a list with All / Upcoming / Seated filters. Confirmed reservations can be swiped: right to seat, left to cancel (96 px threshold, a haptic tick when it is crossed). The same actions are exposed to assistive technology and reachable from the row's details, so nothing depends on the gesture.
  - **Account** (`/account`): the same profile screen a guest sees, minus the redundant "open console" button, since the console's own nav is already on screen.
  - **Keyboard on the web:** `N` new reservation, `/` search, `S` seat, `C` complete, `←` `→` step the time, `Esc` close the panel, `Enter` confirm a move. Shortcuts do not fire while typing or with Ctrl/Meta/Alt held.
- **Web keyboard shortcuts everywhere**, not just the staff console: `/` or `Ctrl`/`⌘`+`K` focuses search on Explore, `1`/`2` switch tabs on Reservations, `Esc` closes whatever sheet or dialog is open, and `?` opens a shortcuts overlay listing exactly what that screen binds (`components/ui/ShortcutsSheet`, driven by the same list each screen passes to it, so it cannot drift from the real bindings).

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

## Running on a phone

The gestures, haptics and safe areas can only really be judged on a device. The web build does not vibrate and a mouse is not a thumb.

1. **Backend reachable from the phone.** It must listen on the network, not just on localhost, and the phone must be on the same Wi-Fi:
   ```bash
   cd backend && uvicorn src.main:app --host 0.0.0.0 --port 8000
   ```
   Allow Python through the Windows firewall for private networks when it asks. CORS only concerns the web build, native apps are not affected.
2. **Point the app at your computer.** Find its LAN address (`ipconfig` on Windows, `ifconfig` / `ip a` elsewhere) and put it in `frontend/.env`:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:8000
   ```
   Restart the dev server with a clean cache after changing it: `npx expo start -c`.
3. **Open the app.** Scan the QR code with [Expo Go](https://expo.dev/go) (Android: the app; iOS: the camera). Everything the app uses (Reanimated, Gesture Handler, Haptics, SVG, secure store) ships with Expo Go. If Expo Go does not support this SDK yet, use a development build instead: `npx expo install expo-dev-client`, then `npx expo run:android` (Android Studio) or an EAS development build.
4. **Get a staff account.** Register in the app, then as an admin make that user staff of a restaurant (`backend/openapi.json` documents `PATCH /api/v1/users/{id}`; the `/docs` page of the backend is the quickest way):
   ```json
   { "role": "staff", "restaurant_id": 1 }
   ```
   Sign out and in again, then Profile → _Open staff console_.
5. **What to check on the device:**
   - Today list: swipe a confirmed reservation right past the threshold (you should feel one tick when it arms, and the row springs back); swipe left and confirm the dialog; a short swipe does nothing; vertical scrolling is not stolen by the row.
   - Floor plan: drag the time scrubber; tiles change colour smoothly and pulse once; tap a table and use the bottom sheet.
   - New reservation: the keyboard does not cover the name field or the button.
   - Switch the OS to _reduce motion_ and check that movement turns into fades.
   - Dark and light theme, and a small phone in landscape.

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
│   ├── (tabs)/           guest tabs (redirects staff to the console before rendering)
│   ├── (auth)/sign-in    modal, only while signed out
│   ├── (staff)/          only staff and admins: today, floor, account (persistent shell + nav)
│   ├── restaurant/[id]   booking screen
│   ├── reservation/[id]  reservation details
│   └── confirmed         booking confirmation
├── features/             screens and logic per domain (auth, restaurants, reservations, staff)
├── features/navigation/  GuestTopNav (the web-only top bar for the guest tabs)
├── components/ui/        design-system components (incl. ConfirmDialog, SwipeRow)
├── components/floor-plan/ FloorTile, FloorPlan, TimeScrubber
├── components/motion/    Reveal, SuccessMark
├── theme/                tokens, ThemeProvider (dark / light / system)
└── lib/                  api client, generated schema, token storage
```

## Conventions

- **Styling:** NativeWind classes with theme tokens (`bg-surface`, `text-fg`), never hard-coded colours. Text goes through `AppText`; a variant owns size and font, a tone owns colour. Do not override either with `className`: NativeWind does not resolve conflicting utilities by their order.
- **Modals render outside the themed root** (a portal on web). Wrap their content in the theme variables, as `BottomSheet` does.
- **API contract:** the backend exports `backend/openapi.json`; run `npm run api:types` after an API change. CI fails when the generated types are stale.
- **Accessibility:** roles, labels and states on every control; contrast of every text/surface pair is unit-tested; reduced motion turns movement into short fades. Express state with `aria-selected` / `aria-checked` / `aria-disabled` / `aria-busy`, not `accessibilityState`: react-native-web does not put the latter in the DOM, so screen readers on the web would never hear it.
- **No pressable inside a pressable.** A card that is a button and also holds buttons is invalid HTML on web (and confusing for screen readers); make the summary the pressable and the actions its siblings.
- **Signing in from another screen:** pass `next` (an in-app path) to `/sign-in`; only paths starting with a single `/` are honoured. `SignInScreen` checks the just-signed-in user's role and ignores `next` for staff, sending them to `/` instead — the tabs layout's redirect takes it from there, so a staff account never lands on a customer screen (e.g. a booking link followed before switching accounts).
- **Role-based redirects live in the layout, not the screen.** `(tabs)/_layout.tsx` renders `<Redirect>` to the console for staff before anything else mounts; a screen that only makes sense for guests never has to check `isStaff` itself.
- **A screen embedded in another shell** (e.g. `ProfileScreen` reused at `/account` inside the staff console) **takes an `embedded` prop**, not a route check, so it can drop what its host already provides — the top safe-area inset (`Screen`'s `topInset` prop) and any redundant call-to-action. Prefer this over duplicating a screen for a second host.
- **Staff console rules live in `features/staff/floor.ts`** (pure, unit-tested): which state a table is in at a moment, which tables a reservation can move to, which lifecycle actions are allowed, the day-at-a-glance numbers. The screens only render them. The polling interval is `POLL_MS` in `features/staff/hooks.ts`.
- **The console's nav (`StaffNav`) lives once in `(staff)/_layout.tsx`**, wrapping a `Slot`, and reads the active tab from the route itself (`usePathname`) rather than a prop passed down by each screen — the bug this replaced was exactly that: every screen rendering its own copy of the nav, so switching screens remounted it. A screen added under `(staff)/` gets the nav for free; it must not render its own.
- **Gestures run on the JS thread** (`.runOnJS(true)`) so they can call React state and haptics directly; a drag is a few events per frame, which is fine here. Anything a gesture does must also be reachable without it.
- **A press right after a drag is the browser's `click` on release, not a tap.** `SwipeRow` exposes `useJustSwiped()` so the row's own pressables can ignore that spurious press; wire it into every `onPress` inside a swipeable row (see `TodayScreen`'s `RowCard`).
- **The splash stays up until the session is known**, not just until the fonts load (`app/_layout.tsx`, `SESSION_WAIT_MS`). Route guards (`Stack.Protected`) read the auth state; hiding the splash while it is still `loading` bounces a reloaded deep link (`/floor`, `/sign-in`) to `/` before the stored token has been checked.
- **Web quirks worth knowing:** `tslib` is pinned to its CommonJS build in `metro.config.js` (Moti's dependencies crash web rendering with the ESM build), and `jest.config.js` lets Jest transform `moti`.
- **Tests** exercise behaviour through roles and labels, with the API layer mocked at `@/lib/api`.
