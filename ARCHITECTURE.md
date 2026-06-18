# URSB Asset Management System — Architecture Document

> This document is the **single source of truth** for all architectural decisions in the URSB Asset Management System. Every developer must follow the conventions and patterns described here when implementing features.

---

## Table of Contents

- [1. Repository Structure: Monorepo](#1-repository-structure-monorepo)
- [2. Frontend Architecture](#2-frontend-architecture)
- [3. Backend Framework](#3-backend-framework)
- [4. Database Strategy](#4-database-strategy)
- [5. Authentication Approach](#5-authentication-approach)
- [6. Frontend–Backend Interaction](#6-frontendbackend-interaction)
- [7. Folder Layout Reference](#7-folder-layout-reference)
  - [7.1 Frontend Directory Structure](#71-frontend-directory-structure)
  - [7.2 Backend Directory Structure](#72-backend-directory-structure)
  - [7.3 Directory Responsibilities — Summary](#73-directory-responsibilities--summary)
- [8. Rules, Constraints, and Boundaries](#8-rules-constraints-and-boundaries)
  - [8.1 Frontend Rules](#81-frontend-rules)
  - [8.2 Backend Rules](#82-backend-rules)
  - [8.3 Authentication & Security Constraints](#83-authentication--security-constraints)
  - [8.4 Database Constraints](#84-database-constraints)
  - [8.5 Repository & Collaboration Boundaries](#85-repository--collaboration-boundaries)

---

## 1. Repository Structure: Monorepo

The project uses a **monorepo** layout — a single Git repository containing both the frontend and backend applications under clearly separated top-level directories.

### Decision Comparison

| Criterion | Monorepo | Polyrepo |
|-----------|----------|----------|
| **Cross-stack changes** | Single commit covers API + UI changes | Requires coordinated PRs across repos |
| **Shared tooling** | Unified linting, CI, and docs | Duplicated configuration per repo |
| **Team visibility** | All developers see the full system | Siloed knowledge per repository |
| **Build complexity** | Requires workspace-aware tooling | Simpler individual builds |
| **Access control** | All-or-nothing repository access | Fine-grained per-repo permissions |

**Verdict: Monorepo** — The URSB Asset Management System is an internal enterprise tool developed by a single team. The benefits of atomic cross-stack commits, shared conventions, and unified CI far outweigh the access-control advantages of a polyrepo setup.

---

## 2. Frontend Architecture

### Framework: React.js (TypeScript) with Feature-Based Architecture

The frontend is built with **React.js using TypeScript**. It is organized using a **Feature-Based Architecture** — code is grouped by **business domain feature** rather than by technical concern. Each feature module is self-contained with its own components, services, and local utilities.

### Why TypeScript

| Criterion | TypeScript | JavaScript |
|-----------|------------|-----------|
| **Type safety** | Compile-time type checking catches bugs early | Runtime errors only, no type guarantees |
| **IDE support** | Rich autocomplete, refactoring, and IntelliSense | Limited tooling, no structural awareness |
| **Maintainability** | Interfaces and types document contracts inline | Implicit contracts, harder to trace across modules |
| **Team fit** | Enforced contracts for growing teams and codebases | Faster start but degrades as codebase grows |

**Verdict: TypeScript** — TypeScript provides compile-time safety, better IDE tooling, and self-documenting interfaces that scale with the codebase. The URSB Asset Management System benefits from the type guarantees across API contracts (Pydantic schemas mirrored in frontend types), shared hooks, and feature service layers.

### Feature-Based vs Layer-Based Comparison

| Criterion | Feature-Based | Layer-Based |
|-----------|--------------|-------------|
| **Scalability** | Scales linearly — new features are new folders | Degrades as each layer folder grows unbounded |
| **Discoverability** | All code for "assets" lives under `features/assets/` | Scattered across `components/`, `pages/`, `services/` |
| **Team ownership** | Teams can own feature modules end-to-end | Teams must coordinate across shared layer folders |
| **Reusability** | Shared code promoted to `components/common/` or `hooks/` | Implicitly shared by default, leading to coupling |
| **Onboarding** | New developers understand one feature at a time | Must trace across many folders to understand a flow |

**Verdict: Feature-Based Architecture** — Asset management systems have clearly distinct domains (assets, users, maintenance, reports). Feature-based organization keeps each domain isolated, testable, and independently navigable.

### Rules

1. **Feature isolation** — A feature folder must not import from another feature folder. Use `components/common/` or `hooks/` for genuinely shared code.
2. **Co-location** — Place components and styles as close to where they are used as possible.
3. **Barrel exports** — Each feature folder should expose a clean public API via an `index.ts` file.

---

## 3. Backend Framework

### Framework: FastAPI (Python) with SQLAlchemy ORM

The backend is built with **FastAPI**, a modern, high-performance Python web framework built on standard Python type hints. Database access is handled by **SQLAlchemy**, the de-facto standard Python ORM, providing a powerful and flexible abstraction over multiple database engines.

### Decision Comparison

| Criterion | FastAPI | Django | Flask |
|-----------|---------|--------|-------|
| **Performance** | Async-native, one of the fastest Python frameworks | Synchronous by default, heavier request cycle | Lightweight but synchronous |
| **Type safety** | Pydantic models with strict validation from type hints | Manual serializer definitions | Manual validation required |
| **Auto documentation** | Built-in Swagger UI & ReDoc out of the box | Requires third-party packages | Requires third-party packages |
| **ORM** | Flexible — pairs with SQLAlchemy (industry standard) | Built-in Django ORM (locked to Django) | Requires Flask-SQLAlchemy plugin |
| **Learning curve** | Low — functions + type hints, no monolithic framework | Steep — ORM, middleware, apps, admin | Minimal but lacks structure |
| **Async support** | First-class async/await for routes and DB | Limited async support | No native async |
| **Flexibility** | Composable — pick the best tool for each layer | Batteries-included, opinionated | Too minimal for enterprise features |

**Verdict: FastAPI + SQLAlchemy** — The URSB Asset Management System requires a lean, performant API for asset CRUD, user management, and session-authenticated endpoints. FastAPI provides automatic OpenAPI documentation, async request handling, and Pydantic-based validation without the overhead of a full MVC framework. SQLAlchemy gives the team the most powerful Python ORM available, with support for both SQLite (development) and MySQL (production) from a single codebase.

### Rules

1. **SQLAlchemy ORM only** — All database operations must go through SQLAlchemy models and session queries. No raw SQL unless absolutely necessary and reviewed.
2. **Router-per-feature** — Each business domain (assets, users, etc.) is a separate `APIRouter` module mounted under the `/api/` prefix.
3. **Separation of concerns** — Route handlers (`api/v1/`) handle request/response. Business logic lives in a `services/` module. SQLAlchemy models define data structure in `models/`.
4. **Pydantic schemas** — Every endpoint must define typed Pydantic schemas for request and response bodies in `schemas/`.
5. **Async by default** — Use `async def` for all route handlers. Use async SQLAlchemy sessions for database operations.

---

## 4. Database Strategy

### Decision: SQLite for Development — MySQL for Production

The system uses a dual-database strategy: **SQLite** during local development for zero-config simplicity, and **MySQL** in production for reliability, wide hosting support, and proven performance in enterprise environments.

### Decision Comparison

| Criterion | SQLite (Dev) | MySQL (Prod) |
|-----------|-------------|--------------|
| **Setup effort** | Zero — file-based, no server | Requires server provisioning |
| **Concurrency** | Single-writer limitation | Row-level locking, concurrent reads/writes |
| **Transaction safety** | Basic ACID | Full ACID with InnoDB engine |
| **Data types** | Limited type affinity | Rich types (ENUM, SET, JSON, spatial) |
| **Scalability** | Suitable for single-user dev | Handles high-traffic production loads |
| **Ecosystem** | Embedded, no ops overhead | Widely supported by cloud providers and tools |
| **Migration parity** | Minor dialect differences | Production target dialect |

**Verdict: SQLite (Dev) + MySQL (Prod)** — During development, engineers need instant startup with no external dependencies. SQLite provides a frictionless local experience. MySQL is the production target because asset management data demands transactional integrity, concurrent access from multiple users, and robust relational modeling. SQLAlchemy's database-agnostic abstraction ensures the same application code works seamlessly across both environments.

### Rules

1. **No raw SQL** — All database operations must go through SQLAlchemy to maintain cross-database compatibility between SQLite and MySQL.
2. **Migration discipline** — Migrations must be managed via **Alembic** (SQLAlchemy's migration tool) and tested against both SQLite and MySQL before merging.
3. **Environment-driven** — The active database engine is determined by the `DATABASE_URL` environment variable (e.g., `sqlite:///./dev.db` for development, `mysql+pymysql://user:pass@host/db` for production). No code branches based on database type.

---

## 5. Authentication Approach

### Strategy: Session-Based Authentication

The system uses **strict session-based authentication** — a stateful approach where the server creates a session upon successful login, stores it server-side (in the database via SQLAlchemy), and sends a session identifier via a secure, HTTP-only cookie. Session management is implemented as a custom FastAPI middleware layer.

### Decision Comparison

| Criterion | Session-Based | JWT (Token-Based) |
|-----------|--------------|-------------------|
| **State management** | Server stores session state | Stateless — token carries all claims |
| **Revocation** | Instant — destroy server-side session | Requires blocklist or short expiry |
| **Security** | HTTP-only cookies immune to XSS token theft | Tokens vulnerable to XSS if stored in `localStorage` |
| **Scalability** | Requires session store (DB/Redis) | Fully stateless, horizontally scalable |
| **Enterprise fit** | Ideal for internal tools with known user base | Better for distributed microservices / mobile |
| **CSRF protection** | Requires CSRF tokens | Not needed (token sent via header) |

**Verdict: Session-Based Authentication** — The URSB Asset Management System is an internal enterprise application with a known, bounded user base. Session-based auth provides superior security characteristics for this context: instant revocation (critical when employees leave), no client-side token exposure to XSS, and simpler mental model for the development team. Sessions are stored in the database through SQLAlchemy and managed via FastAPI middleware.

### Rules

1. **Secure cookies only** — Session cookies must be `HttpOnly`, `Secure` (in production), and `SameSite=Lax`.
2. **Server-side sessions** — Session data is stored in the database (or Redis in production), never in the cookie itself. A `Session` SQLAlchemy model tracks active sessions with user reference and expiry timestamp.
3. **CSRF protection** — All state-changing requests must include CSRF token validation, implemented as FastAPI middleware.
4. **Session expiry** — Sessions must have a defined TTL with sliding-window renewal on activity. Expired sessions are cleaned up periodically.

---

## 6. Frontend–Backend Interaction

The React frontend communicates with the FastAPI backend over HTTP. Session cookies are exchanged automatically by the browser to maintain authentication state.

```mermaid
sequenceDiagram
    participant Browser
    participant React as React Frontend
    participant FastAPI as FastAPI Backend

    Note over Browser,FastAPI: CSRF Token Initialization

    React->>FastAPI: GET /api/auth/csrf
    FastAPI-->>React: 200 OK + Set-Cookie csrf_token + JSON csrf_token
    React-->>Browser: Store CSRF token for state-changing requests

    Note over Browser,FastAPI: Regular User Login

    Browser->>React: User enters credentials on /login
    React->>FastAPI: POST /api/auth/login with X-CSRFToken header
    FastAPI->>FastAPI: Validate credentials, reject ADMIN users
    FastAPI->>FastAPI: Create session in DB
    FastAPI-->>React: 200 OK + Set-Cookie session_token + JSON user
    React-->>Browser: Store auth state in context, redirect to /dashboard

    Note over Browser,FastAPI: Admin Login

    Browser->>React: Admin enters credentials on /admin/login
    React->>FastAPI: POST /api/auth/login-admin with X-CSRFToken header
    FastAPI->>FastAPI: Validate credentials, require ADMIN role
    FastAPI->>FastAPI: Create session in DB
    FastAPI-->>React: 200 OK + Set-Cookie session_token + JSON user
    React-->>Browser: Store auth state in context, redirect to /admin

    Note over Browser,FastAPI: Authenticated API Flow

    Browser->>React: User navigates to Assets page
    React->>FastAPI: GET /api/assets with Cookie session_token
    FastAPI->>FastAPI: Session middleware validates session_token
    FastAPI->>FastAPI: Query database via SQLAlchemy
    FastAPI-->>React: 200 OK + JSON asset list
    React-->>Browser: Render asset list in UI

    Note over Browser,FastAPI: Session Restoration on Page Reload

    React->>FastAPI: GET /api/auth/session with Cookie session_token
    FastAPI-->>React: 200 OK + JSON user or 401 Unauthorized
    React-->>Browser: Restore auth state or redirect to login

    Note over Browser,FastAPI: Logout

    Browser->>React: User clicks Logout
    React->>FastAPI: POST /api/auth/logout with X-CSRFToken header
    FastAPI->>FastAPI: Destroy server-side session in DB
    FastAPI-->>React: 200 OK + Clear session_token cookie
    React-->>Browser: Clear auth state, redirect to login
```

### Key Interaction Principles

1. **CORS with credentials** — During development, FastAPI must be configured with `CORSMiddleware` allowing the Vite dev server origin and `allow_credentials=True`. In production, serve the built React app from the same origin or configure CORS accordingly.
2. **Fetch with credentials** — All API calls from the frontend must include `credentials: 'include'` so the browser attaches the session cookie.
3. **CSRF token flow** — The backend sets a CSRF token cookie. The frontend reads it and attaches it as a header (`X-CSRFToken`) on every state-changing request (POST, PUT, DELETE, PATCH).
4. **API prefix** — All backend endpoints live under the `/api/` namespace to avoid collision with frontend routes.

---

## 7. Folder Layout Reference

The following is the canonical folder structure for the repository. Every developer must follow this layout.

### 7.1 Frontend Directory Structure

```
frontend/
│
├── index.html                           # ── HTML entry point served by Vite ──
│
├── package.json                         # NPM manifest — dependencies, scripts, metadata
├── package-lock.json                    # Locked dependency tree (auto-generated)
│
├── vite.config.ts                       # Vite dev server and build configuration
│                                        #   (proxy, plugins, resolve aliases)
│
├── tsconfig.json                        # Root TypeScript config (references app + node)
├── tsconfig.app.json                    # TypeScript config for browser source files
├── tsconfig.node.json                   # TypeScript config for Vite/node config files
│
├── eslint.config.js                     # ESLint 9 flat config — TypeScript, React
│                                        #   hooks, and React Refresh rules
│
├── .env.example                         # Template of required environment variables
│
├── src/                                 # ── Application source root ──
│   │
│   ├── main.tsx                          # Application entry point. Mounts the React
│   │                                    #   tree to the DOM element (#root). Imports
│   │                                    #   global styles and wraps <App /> with
│   │                                    #   top-level providers (Context, Router).
│   │
│   ├── App.tsx                           # Root React component. Defines the global
│   │                                    #   layout shell, route definitions, and
│   │                                    #   navigation structure. All feature routes
│   │                                    #   are registered here.
│   │
│   ├── vite-env.d.ts                    # Vite client type declarations (auto-generated)
│   │
│   ├── components/                      # ── Shared / reusable UI components ──
│   │   │                                #   Components used by TWO OR MORE features.
│   │   │                                #   If a component is only used by one feature,
│   │   │                                #   it stays inside that feature's folder.
│   │   │
│   │   └── common/                      # Base UI primitives that have no business
│   │                                    #   logic — purely presentational building blocks.
│   │
│   ├── context/                         # ── React Context providers ──
│   │                                    #   Global state that must be accessible across
│   │                                    #   the entire application tree.
│   │
│   ├── features/                        # ── Feature-based modules (core of the app) ──
│   │   │                                #   Each feature is a SELF-CONTAINED vertical slice.
│   │   │                                #   A feature folder may contain its own:
│   │   │                                #     - components/  (feature-specific UI)
│   │   │                                #     - services/    (feature-specific API calls)
│   │   │                                #     - hooks/       (feature-specific hooks)
│   │   │                                #     - index.ts     (barrel export)
│   │   │
│   │   ├── assets/                      # ── Asset Management feature ──
│   │   ├── auth/                        # ── Authentication feature ──
│   │   └── users/                       # ── User Management feature ──
│   │
│   ├── hooks/                           # ── Shared custom React hooks ──
│   │                                    #   Hooks used by TWO OR MORE features.
│   │                                    #   Feature-only hooks stay inside the feature.
│   │
│   ├── services/                        # ── Shared API service layer ──
│   │                                    #   Centralized HTTP client configuration shared
│   │                                    #   by all features. Feature-specific API calls
│   │                                    #   live inside each feature's own services/.
│   │
│   └── utils/                           # ── Pure utility functions ──
│                                        #   Stateless helper functions with NO React
│                                        #   dependencies and NO side effects.
│
└── node_modules/                        # NPM dependencies (auto-generated, gitignored)
```

### 7.2 Backend Directory Structure

```
backend/
│
├── main.py                              # ── Application entry point ──
│                                        #   Creates the FastAPI instance, registers CORS
│                                        #   middleware, session middleware, and mounts all
│                                        #   routers under /api/.
│
├── requirements.txt                     # Python package dependencies (pip)
├── .env                                 # Local environment variables (gitignored)
├── .env.example                         # Template of required environment variables
│
├── app/                                 # ── FastAPI application package ──
│   │
│   ├── __init__.py                      #   Package marker
│   │
│   ├── api/                             # ── API route layer (versioned) ──
│   │   │                                #   Versioned API routers. Each business domain
│   │   │                                #   is a separate APIRouter module.
│   │   │
│   │   ├── __init__.py                  #   Package marker
│   │   │
│   │   └── v1/                          # ── API version 1 ──
│   │       └── __init__.py              #   v1 router registration
│   │
│   ├── models/                          # ── SQLAlchemy ORM models ──
│   │   └── __init__.py                  #   Package marker / model exports
│   │
│   ├── schemas/                         # ── Pydantic request/response schemas ──
│   │   └── __init__.py                  #   Package marker / schema exports
│   │
│   └── services/                        # ── Business logic layer ──
│       └── __init__.py                  #   Package marker / service exports
│
└── venv/                                # Python virtual environment (gitignored)
```

### 7.3 Directory Responsibilities — Summary

| Directory / File | Layer | Responsibility |
|------------------|-------|----------------|
| `frontend/src/main.tsx` | Entry | Mounts React app to DOM, wraps with providers |
| `frontend/src/App.tsx` | Shell | Global layout, route definitions, navigation |
| `frontend/src/components/common/` | UI | Base UI primitives shared across all features |
| `frontend/src/context/` | State | Global React Context providers (auth state) |
| `frontend/src/features/assets/` | Feature | All asset-related UI, logic, and API calls |
| `frontend/src/features/auth/` | Feature | Login/logout UI, session guards, protected routes |
| `frontend/src/features/users/` | Feature | User management UI, roles, profiles |
| `frontend/src/hooks/` | Shared | Reusable custom React hooks (used by 2+ features) |
| `frontend/src/services/` | API | Centralized HTTP client with CSRF and credentials |
| `frontend/src/utils/` | Shared | Pure helper functions (formatters, validators) |
| `backend/main.py` | Entry | FastAPI app factory, middleware registration, router mounting |
| `backend/app/api/v1/` | API | Versioned APIRouter modules (auth, assets, users) |
| `backend/app/models/` | Data | SQLAlchemy ORM models (User, Asset, Session) |
| `backend/app/schemas/` | Validation | Pydantic request/response schemas for all endpoints |
| `backend/app/services/` | Logic | Business logic decoupled from HTTP (auth, asset, user services) |

---

## 8. Rules, Constraints, and Boundaries

Every developer on the team MUST follow these rules. Violations must be caught during code review.

### 8.1 Frontend Rules

| # | Rule | Constraint |
|---|------|-----------|
| F1 | **Feature isolation** | A feature folder (`features/assets/`, `features/users/`, etc.) MUST NOT import from another feature folder. Cross-feature sharing is forbidden. |
| F2 | **Shared code promotion** | If a component, hook, or utility is needed by two or more features, it MUST be moved to `components/common/`, `hooks/`, or `utils/` — not duplicated. |
| F3 | **Barrel exports** | Every feature folder MUST expose its public API through an `index.ts` file. Other parts of the app import from the feature root, never from internal paths. |
| F4 | **No business logic in components** | React components handle rendering only. API calls go in `services/`. Complex logic goes in `hooks/` or utility functions. |
| F5 | **Co-location** | Files that are only used by a single feature MUST live inside that feature's folder. Do not place feature-specific code in shared directories. |
| F6 | **No raw `fetch` in components** | All HTTP calls must go through the centralized `apiClient.ts` in `services/` to ensure consistent CSRF handling and credential attachment. |
| F7 | **Pure utilities** | Files in `utils/` must be pure functions with zero side effects and zero React dependencies. They must be trivially testable. |
| F8 | **TypeScript** | All frontend source files use `.tsx` (JSX components) or `.ts` (non-JSX) extensions. Strict TypeScript is enforced via `tsconfig.json`. No untyped `.js` files are permitted in `src/`. |

### 8.2 Backend Rules

| # | Rule | Constraint |
|---|------|-----------|
| B1 | **SQLAlchemy ORM only** | All database operations MUST go through SQLAlchemy models and async sessions. Raw SQL is prohibited unless explicitly reviewed and approved. |
| B2 | **Router-per-feature** | Each business domain is a separate `APIRouter` module. New domains require new router files — never dump unrelated endpoints into an existing router. |
| B3 | **Service layer** | Business logic MUST live in `services/`. Routers (`api/v1/`) handle only HTTP request parsing and response formatting. |
| B4 | **Pydantic schemas mandatory** | Every endpoint MUST define Pydantic schemas for request bodies and response models. Never return raw SQLAlchemy model instances directly. |
| B5 | **Migration discipline** | Every model change MUST produce an Alembic migration. Migrations are version-controlled and reviewed in pull requests. |
| B6 | **API namespace** | All endpoints MUST be mounted under the `/api/` URL prefix to avoid collision with frontend client-side routes. |
| B7 | **Consistent error responses** | All API errors must use shared exception handlers. No ad-hoc error JSON in route handlers. |
| B8 | **Async all the way** | Route handlers MUST use `async def`. Database operations MUST use async SQLAlchemy sessions. Never block the event loop. |
| B9 | **Dependency injection** | Database sessions and current user must be injected via FastAPI `Depends()`, not imported directly. This ensures testability and proper request scoping. |

### 8.3 Authentication & Security Constraints

| # | Rule | Constraint |
|---|------|-----------|
| S1 | **Session-based only** | JWT tokens are NOT used. All authentication relies on server-side sessions stored in the database via SQLAlchemy, managed through FastAPI middleware. |
| S2 | **Secure cookie flags** | Session cookies MUST be configured with `HttpOnly`, `Secure` (in production), and `SameSite=Lax`. |
| S3 | **CSRF mandatory** | Every state-changing request (POST, PUT, DELETE, PATCH) MUST include a valid CSRF token validated by `csrf_middleware.py`. The frontend `apiClient.ts` handles injection automatically. |
| S4 | **No credentials in localStorage** | Session tokens, passwords, or any sensitive data MUST NOT be stored in `localStorage` or `sessionStorage`. |
| S5 | **Protected routes** | All authenticated frontend routes MUST be wrapped with the `ProtectedRoute` component from `features/auth/`. Backend endpoints MUST use the `get_current_user` dependency. |

### 8.4 Database Constraints

| # | Rule | Constraint |
|---|------|-----------|
| D1 | **SQLite in development** | Local development uses SQLite. No MySQL-specific features may be used in ORM queries. |
| D2 | **MySQL in production** | Production deployments use MySQL (InnoDB engine). The SQLAlchemy abstraction must remain database-agnostic. |
| D3 | **No database branching** | Code MUST NOT contain conditional logic that switches behavior based on the active database engine. |
| D4 | **Environment-driven config** | The active database is determined entirely by the `DATABASE_URL` environment variable. |
| D5 | **Alembic migrations only** | All schema changes MUST go through Alembic. Never manually modify database tables outside the migration system. |

### 8.5 Repository & Collaboration Boundaries

| # | Rule | Constraint |
|---|------|-----------|
| R1 | **Monorepo discipline** | Both frontend and backend live in one repository. No separate repos for shared packages. |
| R2 | **Never commit generated files** | `node_modules/`, `venv/`, `__pycache__/`, `.env`, and build output directories are gitignored. |
| R3 | **Architecture doc as contract** | Any change to the folder structure, technology stack, or architectural pattern MUST be reflected in this `ARCHITECTURE.md` before implementation begins. |
| R4 | **Single source of truth** | When a conflict arises between verbal agreements and this document, this document takes precedence until formally updated. |

---

*This document is maintained alongside the codebase. Any architectural change must be reflected here before implementation begins.*
