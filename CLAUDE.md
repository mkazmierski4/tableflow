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

- Expo (SDK aktualne) + **Expo Router** (file-based routing), TypeScript `strict: true`, bez `any`.
- **NativeWind** (Tailwind) do stylowania; tokeny kolorów w `tailwind.config.js`; dark-slate design + tryb light/dark.
- **Animacje**: React Native Reanimated + Moti (przejścia stanów stolika, otwieranie formularzy, potwierdzenia), Gesture Handler (gesty, bottom sheet).
- **Web**: skróty klawiszowe (np. `N` – nowa rezerwacja, `/` – szukaj, `Esc` – zamknij), focus states, dobre odstępy.
- Komponenty małe i typowane; logika w hookach (`hooks/`), wywołania API w `lib/api/`, brak `fetch` w komponentach.
- Stan serwerowy: TanStack Query; stan lokalny: React state / Zustand (tylko jeśli potrzebny).
- Dostępność: `accessibilityLabel`, kontrast, obsługa `prefers-reduced-motion`.

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
```

### CI
`.github/workflows/backend.yml`: ruff, mypy, migracje + `alembic check` na PostgreSQL oraz pytest na SQLite i PostgreSQL (Python 3.11 i 3.13), plus build obrazu Docker.

### Frontend
```bash
cd frontend
npm install
npx expo start                    # dev server (i/a/w – iOS/Android/Web)
npx expo start --web              # tylko Web
npx tsc --noEmit                  # typy
npm run lint
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
│       └── backend.yml              # CI: ruff, mypy, migracje, pytest (SQLite + PostgreSQL)
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── pyproject.toml               # ruff, mypy, pytest
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/                     # migracje
│   │   └── versions/                # 0001 schemat + exclusion constraint (PG), 0002 users + user_id
│   ├── src/
│   │   ├── main.py                  # app factory, lifespan, CORS
│   │   ├── cli.py                   # python -m src.cli create-admin
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
    ├── app/                         # Expo Router
    │   ├── _layout.tsx
    │   ├── (tabs)/
    │   │   ├── index.tsx            # plan sali / stoliki
    │   │   ├── reservations.tsx
    │   │   └── settings.tsx
    │   └── reservation/
    │       ├── new.tsx
    │       └── [id].tsx
    ├── src/
    │   ├── components/              # ui/, floor-plan/, reservation/
    │   ├── hooks/
    │   ├── lib/
    │   │   └── api/                 # klient REST + typy
    │   ├── theme/                   # tokeny, dark/light
    │   └── types/
    ├── assets/
    ├── global.css                   # NativeWind
    ├── tailwind.config.js
    ├── babel.config.js
    ├── metro.config.js
    ├── app.json
    ├── tsconfig.json
    └── package.json
```

> Pozycje oznaczone jako „Faza N” oraz cały `frontend/` to struktura docelowa – pliki powstają iteracyjnie.

## Roadmapa faz

0. **Inicjalizacja architektury** (dokumentacja, struktura, git) ✅
1. Setup FastAPI + baza + walidacja rezerwacji i anti-overbooking ✅
2. Auth (JWT) + zarządzanie restauracjami, stolikami i statusami rezerwacji + CI ✅
3. Inicjalizacja Expo + NativeWind + nawigacja + motyw
4. Plan sali, rezerwacje, animacje (Reanimated/Moti)
5. Polish, skróty klawiszowe, CI, deployment
