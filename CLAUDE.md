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
- **Pydantic v2**: modele dziedziczą po `BaseModel`, `model_config = ConfigDict(strict=True, from_attributes=True)` tam, gdzie ma to sens;
  walidacja przez `@field_validator` / `@model_validator`; osobne schematy `Create` / `Update` / `Read`.
- **SQLAlchemy 2.0**: styl `Mapped[...]` + `mapped_column`, `AsyncSession`, `select()`; bez lazy loadingu w async (używamy `selectinload`/`joinedload`).
- **Czas**: wszystkie daty jako timezone-aware UTC (`datetime` z `tzinfo`).
- **Type hints** obowiązkowe (mypy strict dla `src/`), formatowanie i lint: `ruff`.
- **Anti-double-booking** jest niepodlegające negocjacjom: walidacja w serwisie + blokada w transakcji + constraint w bazie (patrz README).
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
pytest                            # testy
ruff check . && ruff format .     # lint + format
mypy src                          # typy
alembic upgrade head              # migracje
```

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
docker compose up --build         # backend + PostgreSQL
docker compose down -v            # zatrzymaj i usuń wolumeny
```

## Struktura katalogów

```
tableflow/
├── CLAUDE.md
├── README.md
├── .gitignore
├── docker-compose.yml
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── alembic.ini                  # (Faza 1)
│   ├── alembic/                     # (Faza 1) migracje
│   ├── src/
│   │   ├── main.py                  # (Faza 1) app factory, lifespan, CORS
│   │   ├── api/
│   │   │   ├── deps.py              # zależności (sesja DB, auth)
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       ├── auth.py
│   │   │       ├── restaurants.py
│   │   │       ├── tables.py
│   │   │       ├── availability.py
│   │   │       └── reservations.py
│   │   ├── core/
│   │   │   ├── config.py            # pydantic-settings
│   │   │   ├── database.py          # async engine + session
│   │   │   ├── security.py          # hash haseł, JWT
│   │   │   └── exceptions.py        # wyjątki domenowe
│   │   ├── models/                  # SQLAlchemy ORM
│   │   │   ├── base.py
│   │   │   ├── user.py
│   │   │   ├── restaurant.py
│   │   │   ├── table.py
│   │   │   └── reservation.py
│   │   ├── schemas/                 # Pydantic v2
│   │   │   ├── user.py
│   │   │   ├── restaurant.py
│   │   │   ├── table.py
│   │   │   └── reservation.py
│   │   └── services/                # logika biznesowa
│   │       ├── reservation_service.py
│   │       ├── availability_service.py
│   │       └── table_service.py
│   └── tests/
│       ├── conftest.py
│       ├── unit/
│       └── integration/             # w tym testy współbieżności (double-booking)
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

> Pozycje oznaczone jako „Faza N” lub jeszcze nieistniejące to struktura docelowa – katalogi/pliki powstają iteracyjnie.

## Roadmapa faz

0. **Inicjalizacja architektury** (dokumentacja, struktura, git) ✅
1. Setup FastAPI + baza + walidacja rezerwacji i anti-overbooking
2. Auth (JWT) + zarządzanie restauracjami i stolikami
3. Inicjalizacja Expo + NativeWind + nawigacja + motyw
4. Plan sali, rezerwacje, animacje (Reanimated/Moti)
5. Polish, skróty klawiszowe, CI, deployment
