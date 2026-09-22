# TableFlow – Modern Restaurant Reservation & Table Management System

System rezerwacji stolików dla restauracji: asynchroniczne REST API (FastAPI) + aplikacja Web/Mobile (Expo).
Projekt portfolio publikowany na GitHub – jakość kodu, historia commitów i dokumentacja mają znaczenie.

## Zasady pracy

- **Strictly-iterative**: wykonujemy wyłącznie ustaloną fazę. Nie wybiegamy w przód.
- **Plan przed kodem**: przed zmianami w kodzie krótko przedstawiamy plan i czekamy na potwierdzenie.
- **Commity**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), małe i atomowe. Gałąź główna: `main`.
- **Języki**: kod, komentarze, nazwy, README i commity – po angielsku. `CLAUDE.md` – po polsku.
- Nie commitujemy sekretów (`.env`), baz lokalnych ani `node_modules`.
- Każda nowa funkcjonalność backendu ma testy; każda zmiana kończy się uruchomieniem testów/lintu.

## Wytyczne – Backend (`backend/`)

- Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Alembic, Pytest.
- **Warstwy**: `api` (routery, zależności HTTP) → `services` (logika biznesowa) → `models` (ORM). Routery są cienkie – żadnej logiki biznesowej.
- **Pydantic v2**: modele dziedziczą po `BaseModel`, `ConfigDict(from_attributes=True)` w schematach `Read`;
  walidacja przez `@field_validator` / `@model_validator`; osobne schematy `Create` / `Update` / `Read`.
  Strict types stosujemy na poziomie pól (`Field(strict=True)`) dla ciał JSON. `strict=True` na całym modelu psuje daty i enumy
  w FastAPI (body trafia do walidacji jako obiekt Pythona) oraz parametry query (zawsze stringi).
- **SQLAlchemy 2.0**: styl `Mapped[...]` + `mapped_column`, `AsyncSession`, `select()`; bez lazy loadingu w async (używamy `selectinload`/`joinedload`).
- **Czas**: wszystkie daty jako timezone-aware UTC (`datetime` z `tzinfo`).
- **Type hints** obowiązkowe (mypy strict dla `src/`), formatowanie i lint: `ruff`.
- **Anti-double-booking** jest niepodlegające negocjacjom: walidacja w serwisie + blokada w transakcji + constraint w bazie (patrz README).
  Blokada (`services/locking.py::lock_table`) musi być pierwszym poleceniem transakcji; serwis sam robi `commit`/`rollback`.
  Każda operacja, która rezerwuje, przesuwa lub odbiera pojemność stolika, bierze tę blokadę (wiele stolików: rosnąco po id – bez deadlocków).
  Zmiany w tej logice wymagają testów współbieżności (`test_double_booking.py`, `test_reservation_changes.py`, `test_tables_api.py`).
- **Auth**: `CurrentUser` / `AdminUser` / `StaffUser` (`api/deps.py`). Użytkownik z tokenu jest ładowany w osobnej sesji, żeby sesja żądania
  zaczynała transakcję od blokady. Cudzy zasób zwracamy jako 404 (nie 403). Uprawnienia do rezerwacji: `services/access.py`.
- Maszyna stanów rezerwacji: `services/reservation_status.py` (czysta logika; żadne przejście nie wraca ze statusu końcowego do aktywnego).
- Testy uprawnień i współbieżności weryfikujemy testem mutacyjnym (wyłączamy blokadę/kontrolę i sprawdzamy, że testy padają).
- Testy działają domyślnie na plikowym SQLite; z `TEST_POSTGRES_URL` te same testy biegną także na PostgreSQL
  (wymagany osobny schemat testowy – fixture robi `drop_all`).
- Błędy domenowe jako własne wyjątki (`core/exceptions.py`) mapowane na HTTP w jednym miejscu.
- Konfiguracja wyłącznie przez `pydantic-settings` (`core/config.py`) i zmienne środowiskowe.

## Wytyczne – Frontend (`frontend/`)

- Expo (SDK 57) + **Expo Router** (file-based routing, trasy w `src/app` są cienkie – tylko renderują ekran z `features/`), TypeScript `strict: true`, bez `any`.
- **NativeWind v4** (Tailwind 3) do stylowania; kolory to zmienne CSS (`src/theme/tokens.ts`), klasy typu `bg-surface` / `text-fg` – nigdy kolory na sztywno. Motyw = podmiana zmiennych, bez wariantów `dark:`.
  Kolory z `tailwind.config.js` muszą odpowiadać planszy „Foundations” z zatwierdzonego designu; kontrast par tekst/tło jest testowany.
- **Tekst** tylko przez `AppText`: wariant odpowiada za rozmiar i font, `tone` za kolor. Nie nadpisujemy ich przez `className` (NativeWind nie rozstrzyga konfliktów wg kolejności klas) – brakujący wariant dodajemy.
- **Modal renderuje się poza korzeniem motywu** (portal na webie) – jego zawartość musi dostać zmienne motywu (jak w `BottomSheet`), inaczej klasy kolorów nic nie znaczą.
- **Kontrakt API**: backend eksportuje `backend/openapi.json`, frontend generuje z niego `src/lib/api/schema.ts` (`npm run api:types`). Zmiana API = regeneracja obu; CI to sprawdza.
- **Testy**: Jest + React Native Testing Library (v13, synchroniczne API), zachowanie przez role i etykiety, API mockowane na `@/lib/api`. Zmiany w wyglądzie weryfikujemy też w przeglądarce (zrzuty), bo testy jednostkowe nie zobaczą np. problemów z portalami.
- **Animacje**: React Native Reanimated + Moti (przejścia stanów stolika, otwieranie formularzy, potwierdzenia), Gesture Handler (gesty, bottom sheet).
- **Web**: skróty klawiszowe (np. `N` – nowa rezerwacja, `/` – szukaj, `Esc` – zamknij), focus states, dobre odstępy.
- Komponenty małe i typowane; logika w hookach (`hooks/`), wywołania API w `lib/api/`, brak `fetch` w komponentach.
- Stan serwerowy: TanStack Query; stan lokalny: React state / Zustand (tylko jeśli potrzebny).
- Dostępność: `accessibilityLabel`, kontrast, obsługa `prefers-reduced-motion`.
  Stany kontrolek przez `aria-selected` / `aria-checked` / `aria-disabled` / `aria-busy` – react-native-web nie mapuje `accessibilityState` na DOM.
- Nie zagnieżdżamy przycisków (Pressable w Pressable to nieprawidłowy HTML na webie): karta = pressable z podsumowaniem + rodzeństwo z akcjami.
- Logowanie z innego ekranu: `/sign-in?next=<ścieżka>`; honorujemy tylko ścieżki zaczynające się od pojedynczego `/`. Bramka `Stack.Protected` sama odsyła na `/`.
- Metro: `tslib` przypięty do wersji CommonJS (`metro.config.js`), inaczej zależności Moti wywracają render webowy; Jest transformuje `moti` (`jest.config.js`).
- Po zmianach w kodzie frontendu weryfikujemy przepływ w prawdziwej przeglądarce z prawdziwym backendem (Metro potrafi serwować starą paczkę – restart z `--clear`).
- **Konsola staffu**: reguły (stan stolika w danej chwili, dozwolone przeniesienia, dozwolone przejścia statusu) żyją w `features/staff/floor.ts` – czysta logika, testowana jednostkowo; ekrany tylko ją renderują. Odświeżanie co `POLL_MS` (`features/staff/hooks.ts`).
- **Gesty** (`SwipeRow`) działają na wątku JS (`.runOnJS(true)`), żeby wprost wołać stan Reacta i haptykę. Kliknięcie kończące przeciągnięcie (`click` po `mouseup`/dotknięciu) to nie jest tap – komponenty wewnątrz `SwipeRow` sprawdzają to przez `useJustSwiped()`. Każda akcja gestu musi być też osiągalna bez niego (przyciski, `accessibilityActions`).
- **Splash zostaje**, dopóki nie jest znany stan sesji (nie tylko czcionki) – `app/_layout.tsx`, `SESSION_WAIT_MS`. Bramki (`Stack.Protected`) czytają stan auth; schowanie splasha przed odpowiedzią odsyła przeładowany deep link (`/floor`, `/sign-in`) na `/`.

## Komendy

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env
uvicorn src.main:app --reload     # http://localhost:8000  (docs: /docs)
pytest                            # testy (SQLite)
TEST_POSTGRES_URL=postgresql+asyncpg://tableflow:tableflow@localhost:5432/tableflow_test pytest   # + PostgreSQL
ruff check . && ruff format .     # lint + format
mypy src                          # typy
alembic upgrade head              # migracje
alembic check                     # czy modele są zgodne z migracjami
python -m src.cli create-admin --email you@example.com --name "You"   # pierwszy admin (hasło: prompt lub TABLEFLOW_ADMIN_PASSWORD)
python -m src.cli export-openapi   # odśwież backend/openapi.json po zmianie API (potem: npm run api:types we frontendzie)
```

### CI
`.github/workflows/backend.yml`: ruff, mypy, migracje + `alembic check` na PostgreSQL oraz pytest na SQLite i PostgreSQL (Python 3.11 i 3.13), plus build obrazu Docker.
`.github/workflows/frontend.yml`: build web (Metro), `tsc`, ESLint, Prettier, Jest oraz sprawdzenie, że wygenerowane typy API zgadzają się z `backend/openapi.json`.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env              # EXPO_PUBLIC_API_URL (opcjonalnie)
npx expo start                    # dev server (i/a/w – iOS/Android/Web)
npx expo start --web              # tylko Web
npm run typecheck                 # tsc --noEmit
npx eslint .                      # lint
npm run format:check              # prettier
npm test                          # Jest
npm run api:types                 # typy z ../backend/openapi.json
npx expo export --platform web    # build produkcyjny web
```

### Docker
```bash
docker compose up --build         # backend (migracje + uvicorn) + PostgreSQL
docker compose down -v            # zatrzymaj i usuń wolumeny
```

## Struktura katalogów

```
tableflow/
├── CLAUDE.md
├── README.md
├── .gitignore
├── .gitattributes
├── docker-compose.yml
├── .github/
│   └── workflows/
│       ├── backend.yml              # CI: ruff, mypy, migracje, pytest (SQLite + PostgreSQL)
│       └── frontend.yml             # CI: build web, tsc, ESLint, Prettier, Jest, zgodność typów API
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── openapi.json                 # kontrakt API (python -m src.cli export-openapi) → typy frontendu
│   ├── pyproject.toml               # ruff, mypy, pytest
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/                     # migracje
│   │   └── versions/                # 0001 schemat + exclusion constraint (PG), 0002 users + user_id, 0003 restaurant city
│   ├── src/
│   │   ├── main.py                  # app factory, lifespan, CORS
│   │   ├── cli.py                   # python -m src.cli create-admin | export-openapi
│   │   ├── api/
│   │   │   ├── deps.py              # SessionDep, CurrentUser, AdminUser, StaffUser
│   │   │   ├── errors.py            # wyjątki domenowe → HTTP
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       ├── health.py
│   │   │       ├── auth.py          # register, login, me
│   │   │       ├── users.py         # role, przypisanie staffu, deaktywacja
│   │   │       ├── restaurants.py   # restauracje, stoliki, availability
│   │   │       ├── tables.py        # PATCH / DELETE stolika
│   │   │       └── reservations.py  # CRUD, lista, przekładanie, statusy
│   │   ├── core/
│   │   │   ├── config.py            # pydantic-settings
│   │   │   ├── database.py          # async engine + session (pragmy SQLite)
│   │   │   ├── exceptions.py        # wyjątki domenowe
│   │   │   └── security.py          # argon2, JWT
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── base.py              # Base, UTCDateTime, TimestampMixin
│   │   │   ├── user.py
│   │   │   ├── restaurant.py
│   │   │   ├── table.py             # DiningTable
│   │   │   └── reservation.py       # + exclusion constraint (PG)
│   │   ├── schemas/                 # Pydantic v2
│   │   │   ├── common.py            # Page, paginacja
│   │   │   ├── user.py
│   │   │   ├── restaurant.py
│   │   │   ├── table.py
│   │   │   ├── reservation.py
│   │   │   └── availability.py
│   │   └── services/                # logika biznesowa
│   │       ├── locking.py           # blokada stolika (FOR UPDATE / write lock SQLite)
│   │       ├── scheduling.py        # czyste reguły: overlap, godziny otwarcia
│   │       ├── reservation_status.py # czysta maszyna stanów rezerwacji
│   │       ├── access.py            # kto widzi/zarządza którą rezerwacją
│   │       ├── reservation_service.py
│   │       ├── availability_service.py
│   │       ├── restaurant_service.py
│   │       ├── table_service.py
│   │       └── user_service.py
│   └── tests/
│       ├── conftest.py              # fixtures: SQLite (+ PostgreSQL z TEST_POSTGRES_URL), użytkownicy
│       ├── unit/                    # scheduling, schematy, security, maszyna stanów
│       └── integration/             # API, uprawnienia, współbieżność (test_double_booking.py …)
└── frontend/
    ├── package.json
    ├── app.json                      # Expo: nazwa, schemat, pluginy, typed routes, React Compiler
    ├── tsconfig.json                 # strict, alias @/* → src/*
    ├── babel.config.js               # NativeWind (jsxImportSource)
    ├── metro.config.js               # NativeWind + global.css
    ├── tailwind.config.js            # tokeny jako zmienne CSS, fonty, promienie
    ├── eslint.config.js
    ├── .prettierrc.json              # + sortowanie klas Tailwind
    ├── jest.config.js
    ├── jest.setup.ts                 # mocki: async-storage, secure-store, worklets, reanimated
    ├── .env.example                  # EXPO_PUBLIC_API_URL
    ├── assets/
    └── src/
        ├── global.css                # wejście Tailwind (NativeWind)
        ├── test-utils.tsx            # renderWithProviders, fabryki danych
        ├── app/                      # Expo Router – cienkie trasy
        │   ├── _layout.tsx           # providery, fonty, splash, bramki (Stack.Protected)
        │   ├── +html.tsx             # HTML dla statycznego webu (tło bez „flasha”)
        │   ├── +not-found.tsx
        │   ├── (tabs)/               # gość: index (Explore), reservations, profile
        │   ├── (auth)/sign-in.tsx    # modal, tylko gdy niezalogowany
        │   ├── (staff)/              # tylko staff/admin: today.tsx (lista dnia), floor.tsx (plan sali)
        │   ├── restaurant/[id].tsx   # rezerwacja stolika (BookingScreen)
        │   ├── reservation/[id].tsx  # szczegóły rezerwacji
        │   └── confirmed.tsx         # potwierdzenie rezerwacji
        ├── features/                 # ekrany i logika per domena
        │   ├── auth/                 # AuthProvider, SignInScreen, ProfileScreen
        │   ├── restaurants/          # ExploreScreen (+ filtr miasta, data/goście), hooki, godziny otwarcia
        │   ├── reservations/         # BookingScreen, ReservationsScreen, szczegóły, potwierdzenie, RescheduleSheet, sloty/pickery
        │   └── staff/                # floor.ts (czysta logika), StaffScope, hooki, FloorScreen, TodayScreen,
        │                             #   ReservationPanel, MovePanel, NewReservationSheet, StaffNav, useHotkeys, useNow
        ├── components/ui/            # design system: AppText, Button, Input, FilterChip, Badge, StatusChip,
        │                             #   Card, SegmentedControl, BottomSheet, ConfirmDialog, SwipeRow, TableTile, EmptyState, Screen, Icon
        ├── components/floor-plan/    # FloorPlan, FloorTile (kolor 220 ms + spring), TimeScrubber
        ├── components/motion/        # Reveal, SuccessMark (Reanimated + Moti, z obsługą reduced motion)
        ├── theme/                    # tokens.ts (paleta + zmienne CSS), ThemeProvider (system/dark/light)
        └── lib/
            ├── api/                  # client.ts (błędy, token), index.ts (endpointy), schema.ts (generowany)
            ├── token-storage.ts      # keychain (natywnie) / localStorage (web)
            └── cn.ts
```

> Pozycje oznaczone jako „Faza N” to struktura docelowa – pliki powstają iteracyjnie.

## Roadmapa faz

0. **Inicjalizacja architektury** (dokumentacja, struktura, git) ✅
1. Setup FastAPI + baza + walidacja rezerwacji i anti-overbooking ✅
2. Auth (JWT) + zarządzanie restauracjami, stolikami i statusami rezerwacji + CI ✅
3. Inicjalizacja Expo + NativeWind + nawigacja + motyw + warstwa API ✅
4. Rezerwacje gościa (4A ✅), plan sali i konsola staffu, animacje (Reanimated/Moti) (4B ✅)
5. Polish, skróty klawiszowe, CI, deployment
