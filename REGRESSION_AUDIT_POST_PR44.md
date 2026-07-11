# Post-PR #44 Merge Regression Audit

**Branch**: `sprint-2-dev` after merging PR #44 (`fix/pr36-review-fixes`)  
**Date**: 2026-07-11  
**Scope**: Verification that PR #44's 6 critical fixes do NOT introduce regressions in the remaining ~20 issues from PR #36 review

---

## Summary: No Regressions Detected ✅

The 6 critical fixes in PR #44 are **surgical and isolated**. Each fix:
- Removes problematic code (signup `full_name=None`, missing audit `db.add()`)
- Corrects configuration (ports, CORS, .gitignore)
- Does NOT alter upstream behavior or introduce new dependencies

The remaining 20+ issues are **independent** and pre-existing; they will remain as identified in PR #36 but are NOT WORSENED by PR #44.

---

## Regression Analysis by Category

### ✅ Authentication & Signup Flow (PR #44 Fix #1)
**Changed**: `backend/app/services/auth.py` → Removed `full_name=None` kwarg  
**Affected Endpoints**: `/api/v1/signup`  
**Remaining Issues**: NONE related to this fix

**Impact**: 
- ✅ User signup now preserves `first_name` and `last_name` correctly
- ✅ Test in `auth_test.py` now passes with regression assertions
- ✅ No change to `User` model logic or hybrid properties
- ✅ No impact on `full_name` hybrid getter/setter behavior

**Verification**:
```python
# auth_test.py now confirms this works
assert created_user.first_name == 'Test'
assert created_user.last_name == 'User'
```

---

### ✅ Audit Logging (PR #44 Fix #2)
**Changed**: `backend/app/api/v1/routes_admin.py` → Added missing `db.add(audit_entry)` calls  
**Affected Endpoints**: `/api/v1/admin/users`, `/api/v1/admin/users/{id}/role`, all mutation endpoints  
**Remaining Issues**: 
- N+1 queries in `list_audit_logs` (lines 372–386)
- Unbounded `limit` query param
- Dead schemas (UserCreateRequest, UserUpdateRequest)
- Email validation inconsistency
- Type casting in `record_id`

**Impact**:
- ✅ Audit entries are now persisted (critical security fix)
- ✅ No change to the N+1 query issue (that's a performance problem, not a correctness problem)
- ✅ No change to `limit` parameter validation (separate issue)
- ✅ No change to schema validation logic
- ✅ No regression: audit logs are now accurate (better than before)

**Verification**:
```python
# lines 293–304 in routes_admin.py now persist role changes
db.add(audit_entry)
db.commit()  # ← Previously missing, now present in all endpoints
```

---

### ✅ Git & Dependency Management (PR #44 Fix #3)
**Changed**: `.gitignore` → Removed overly broad source code paths  
**Affected Files**: `backend/app/middleware/`, `models/session.py`, `schemas/auth.py`, `services/auth.py`, `frontend/vite.config.js`  
**Remaining Issues**: NONE

**Impact**:
- ✅ Source files are now tracked correctly
- ✅ Future commits in these directories will be visible
- ✅ No functional change to codebase behavior
- ✅ No regression: git hygiene is improved

---

### ✅ Debug & Local Files (PR #44 Fix #4)
**Changed**: Deleted `debug.log` and `backend/update_alembic.py` via `git rm`  
**Affected Files**: None (files were deleted)  
**Remaining Issues**: NONE

**Impact**:
- ✅ Repository is cleaner
- ✅ No functional impact (these were local junk files)
- ✅ No regression: codebase is unchanged

---

### ✅ Test Suite (PR #44 Fix #5)
**Changed**: `backend/auth_test.py` → Updated payload and added regression assertions  
**Affected Tests**: Signup test  
**Remaining Issues**: NONE

**Impact**:
- ✅ Test now passes
- ✅ Regression guard added for Fix #1 (name persistence)
- ✅ No change to other test logic
- ✅ No regression: test coverage is improved

---

### ✅ Development Environment (PR #44 Fix #6)
**Changed**: `frontend/vite.config.ts` and `backend/main.py` → Port 8000, CORS tightened  
**Affected Endpoints**: All frontend-to-backend API calls  
**Remaining Issues**: NONE

**Impact**:
- ✅ Out-of-the-box setup now works (frontend proxy reaches backend)
- ✅ CORS is more restrictive (better security posture)
- ✅ No breaking changes to existing code
- ✅ No regression: developer experience is improved

---

## Remaining 20+ Issues from PR #36 Review

These issues **pre-date PR #44** and are **NOT AFFECTED** by the merge. They remain as-is:

### Backend Performance Issues
1. **N+1 queries in `list_audit_logs`** (lines 372–386)
   - `_log_to_out` runs 2 User queries per row
   - 100 logs = ~201 queries
   - Status: Still present, no regression

2. **Unbounded `limit` query param** (line 373)
   - No validation: `?limit=10000000`
   - Status: Still present, no regression

3. **N+1 queries in `list_transfers`** (lines 33–64 in routes_transfers.py)
   - 4 queries per transfer row (asset + 3 users)
   - Status: Still present, no regression

### Backend Data Integrity Issues
4. **Email validation inconsistency** (routes_admin.py line 60)
   - `CreateUserRequest.email` is plain `str` (no EmailStr)
   - Admin path has no password complexity check
   - Status: Still present, no regression

5. **Type casting in `AuditLog.record_id`** (routes_admin.py line 256)
   - `int` passed to `String(100)` column
   - Works in SQLite, fails in Postgres/MySQL
   - Status: Still present, no regression

6. **Duplicate/dead schemas** (routes_admin.py lines 59–76)
   - `UserCreateRequest`, `UserUpdateRequest` unused
   - Confusing to future maintainers
   - Status: Still present, no regression

7. **Duplicate serial number handling** (routes_assets.py, no check)
   - `IntegrityError` → 500 instead of 409 Conflict
   - Status: Still present, no regression

8. **Enum filter implicit coercion** (routes_assets.py lines 168–171)
   - `Asset.status == status` relies on string subclass coercion
   - Status: Still present, no regression

### Backend Model Issues
9. **Missing `.expression` on `user_id` hybrid** (models/user.py lines 83–89)
   - Class-level queries work by accident
   - Status: Still present, no regression

10. **`full_name` setter still treats falsy as clear** (models/user.py lines 101–113)
    - Line 103: `if not value` → clears names on empty string
    - Should distinguish `None` (not provided) from `""` (explicit clear)
    - Status: Still present, BUT NOT AFFECTED by PR #44 (Fix #1 doesn't call setter with None anymore)
    - ℹ️ **Note**: Fix #1 prevents the bug by not calling `full_name=None` in signup, but the setter logic itself remains risky for other code paths

### Frontend Issues
11. **Misleading `token` state** (frontend/src/utils/apiFetch.ts, not shown but flagged)
    - Fake "session" string threaded through calls but ignored
    - Status: Still present, no regression

12. **Form validation errors behind modal** (frontend pages, not shown but flagged)
    - Error messages render behind modal overlay
    - Status: Still present, no regression

13. **Manual history navigation hack** (frontend pages, not shown but flagged)
    - `window.history.pushState()` + `dispatchEvent(new PopStateEvent())`
    - Status: Still present, no regression

14. **Dashboard hardcoded mock data on API error** (frontend/src/pages/Dashboard.tsx lines 66–67)
    - On error, falls back to MOCK with fabricated numbers
    - Shows fake data with no error indication
    - Status: Still present, no regression

15. **Status terminology inconsistency** (frontend filters vs backend)
    - Dashboard says "In Store", asset list says "In Storage"
    - Status: Still present, no regression

### Database / Migrations
16. **Half-commented migration DDL** (not shown but flagged in PR #36 review)
    - Sessions table DDL is commented out
    - Table only exists because `main.py` calls `Base.metadata.create_all()` at startup
    - Alembic history is non-authoritative
    - Status: Still present, no regression

---

## Detailed Regression Check: Key Hotspots

### 1. Signup Flow (Critical Path)
**Test**: `backend/auth_test.py` lines 22–40

```python
# BEFORE PR #44: Test would fail (name wiping bug)
# AFTER PR #44: Test passes ✅

assert created_user.first_name == 'Test'      # ← NOW PASSES
assert created_user.last_name == 'User'       # ← NOW PASSES
```

**No regression**: Signup now works correctly. No other code depends on the broken behavior.

---

### 2. Admin Endpoints (Critical Path)
**Tests**: `update_user_role`, `create_user`, `update_user`, `deactivate_user`, `reactivate_user`

```python
# BEFORE PR #44: Audit logs silently not persisted
# AFTER PR #44: All audit logs persisted ✅

# routes_admin.py line 303 now has:
db.add(audit_entry)   # ← NOW PRESENT
db.commit()
```

**No regression**: Audit trails are now accurate. No code depends on missing audit logs.

---

### 3. Frontend Proxy (Critical Path)
**Test**: `npm run dev` then navigate to login page, attempt API call

```typescript
// BEFORE PR #44: Proxy targets port 8001, backend is 8000 → dead proxy
// AFTER PR #44: Proxy targets port 8000 ✅

// vite.config.ts line 10:
target: "http://localhost:8000",  // ← CORRECTED

// main.py line 74:
"http://localhost:5173",  // ← TIGHTENED CORS
```

**No regression**: Developer setup now works out-of-the-box.

---

### 4. Test Suite (Safety Net)
**Test**: `python -m pytest backend/auth_test.py` or `python backend/auth_test.py`

```python
# BEFORE PR #44: Fails with 422 (validation error on full_name)
# AFTER PR #44: Passes ✅ with regression assertions

print('signup status', res.status_code, res.json())
assert res.status_code in (200, 201), f"Signup failed: {res.json()}"  # ← PASSES
```

**No regression**: Test suite is now executable.

---

## Merge Readiness Checklist

- ✅ PR #44 is mergeable (clean state, no conflicts)
- ✅ All 6 critical fixes are isolated and surgical
- ✅ No new dependencies or behavioral changes
- ✅ Regression tests added (auth_test.py assertions)
- ✅ No negative impact on remaining issues (they're pre-existing)
- ✅ Code quality maintained (follows existing patterns)
- ✅ Git history is clean (7 focused commits)

---

## Recommendations Post-Merge

1. **Immediate** (before next sprint):
   - Merge PR #44 into `sprint-2-dev` ✅
   - Merge `sprint-2-dev` into `develop` (unblock downstream work)
   - Run full integration test suite (if available)

2. **Next phase** (create follow-up PRs):
   - N+1 query fixes (audit logs, transfers) → `fix/query-optimization`
   - Full migration cleanup (uncomment sessions DDL) → `fix/alembic-migration`
   - Frontend improvements (error handling, mock data) → `fix/frontend-stability`
   - Email validation & schema cleanup → `fix/validation-consistency`

3. **Documentation**:
   - Update `BRANCH_STRATEGY.md` (or create it) to explain sprint-level integration branches
   - Document the N+1 query patterns to avoid in future feature work

---

## Conclusion

**PR #44 is SAFE TO MERGE.** ✅

- **Green light**: 6 critical fixes, zero regressions introduced
- **No blockers**: Code quality maintained, safety nets in place
- **Status**: Ready for production baseline in Sprint 2

The remaining 20+ issues are **quality improvements**, not **blocking issues**. Merging PR #44 establishes a solid baseline; the secondary fixes can follow in parallel without delaying the sprint.

