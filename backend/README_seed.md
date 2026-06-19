# URSB AMS — Database Seed Script

## Overview

`seed.py` populates the database with realistic sample data for the URSB Asset Management System.
It is **idempotent**: running it multiple times will never create duplicate records.

---

## Prerequisites

Ensure your Python environment has the required packages:

```bash
pip install sqlalchemy passlib[bcrypt] python-dotenv bcrypt==4.0.1
```

> **Note on bcrypt:** Use `bcrypt==4.0.1`. Newer versions of the `bcrypt` library have a
> compatibility issue with `passlib` that causes a `ValueError` on password hashing.

---

## Running the Seed Script

### SQLite (default — development)

From the `backend/` directory:

```bash
python seed.py
```

This uses `sqlite:///./ursb_asset.db` by default (no `.env` needed).

### MySQL / Custom database URL

Set `DATABASE_URL` in your `.env` file or export it before running:

```bash
# .env
DATABASE_URL=mysql+pymysql://ursb_user:password@localhost:3306/ursb_asset_db
```

```bash
python seed.py
```

Or inline:

```bash
DATABASE_URL=mysql+pymysql://ursb_user:password@localhost/ursb_asset_db python seed.py
```

### After Alembic migrations

Run migrations first, then seed:

```bash
alembic upgrade head
python seed.py
```

---

## What Gets Seeded

| Table                | Records | Notes                                              |
|----------------------|---------|----------------------------------------------------|
| `users`              | 7       | All 4 roles covered; passwords securely hashed     |
| `assets`             | 22      | ICT, Furniture, Vehicle, Software; all statuses    |
| `assignments`        | 4       | 3 active, 1 returned (historical)                  |
| `maintenance_records`| 4       | Covers vehicles and ICT equipment                  |
| `disposal_records`   | 3       | Write-off, Destruction, Donation methods           |
| `audit_logs`         | 8       | LOGIN, CREATE, UPDATE actions across tables        |

### Asset status distribution

| Status            | Count |
|-------------------|-------|
| Active            | 14    |
| In Storage        | 3     |
| Under Maintenance | 2     |
| Disposed          | 3     |
| **Total**         | **22**|

---

## Default Credentials

> ⚠️ **To change all passwords immediately in any non-development environment.**

| Role                  | Email                         | Password        |
|-----------------------|-------------------------------|-----------------|
| System Administrator  | admin@ursb.go.ug              | `Admin@1234`    |
| Asset Manager         | asset.manager@ursb.go.ug      | `Manager@1234`  |
| Asset Custodian (ICT) | custodian.ict@ursb.go.ug      | `Custodian@1234`|
| Asset Custodian (Adm) | custodian.admin@ursb.go.ug    | `Custodian@1234`|
| Employee              | john.mukasa@ursb.go.ug        | `Employee@1234` |
| Employee              | sarah.namuli@ursb.go.ug       | `Employee@1234` |
| Employee              | peter.opio@ursb.go.ug         | `Employee@1234` |

All passwords are stored as **bcrypt hashes** — the plaintext is never written to the database.

---

## Idempotency

The script uses "get or create" logic for every record:

- **Users**: looked up by `email`
- **Assets**: looked up by `asset_id`
- **Assignments**: looked up by `(asset_id, assigned_to, status)`
- **Maintenance records**: looked up by `(asset_id, service_date, service_provider)`
- **Disposal records**: looked up by `(asset_id, disposal_date)`
- **Audit logs**: looked up by `(user_id, action, table_affected, record_id)`

Running the script twice produces the same database state as running it once.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError: No module named 'app'` | Run from the `backend/` directory, not a subdirectory |
| `ValueError: password cannot be longer than 72 bytes` | Pin bcrypt: `pip install bcrypt==4.0.1` |
| `sqlalchemy.exc.OperationalError: no such table` | Run `alembic upgrade head` before seeding |
| Foreign key constraint errors on MySQL | Ensure all `alembic` migrations have been applied |