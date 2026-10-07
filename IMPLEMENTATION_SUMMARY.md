# Loan Pre-Application Read Tracking Implementation

**Date**: 2026-10-07  
**Status**: ✅ Complete  
**Regression Tests**: ✅ All 14 tests pass

## Overview

Implemented persisted per-admin read/unread tracking for loan pre-applications in the Customer Inbox, mirroring the existing patterns for inquiries and support requests. Replaced native browser alerts with styled toast notifications for loan form submission feedback.

## Database Migration

**File**: `supabase/migrations/20261007000000_add_admin_loan_preapp_reads.sql`

### Schema Created

```sql
create table public.admin_loan_preapp_reads (
  admin_id uuid not null references public.admin_users(id) on delete cascade,
  loan_preapp_id integer not null references public.loan_preapp(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (admin_id, loan_preapp_id)
);
```

### Key Features

- Composite primary key: `(admin_id, loan_preapp_id)` ensures one read record per admin per loan
- Cascade delete on both foreign keys maintains referential integrity
- Index on `loan_preapp_id` for efficient queries by loan
- Row-level security enabled; service_role has select/insert/delete permissions
- Follows exact schema conventions of `admin_inquire_reads` and `admin_contact_reads`

## Code Changes

### 1. **app/actions/admin_fetchers.ts**

#### Fetch Query Update (lines ~752)
- Added `admin_loan_preapp_reads(admin_id)` to loan_preapp select
- Passed `'admin_loan_preapp_reads'` as readRelation parameter
- Loans now query read state scoped to current admin (matches inquiry/support behavior)

#### Toggle Action Implementation (lines ~758-781)
- Extended `toggleNotificationReadAction` to handle `'loan_application'` type
- Maps to `'admin_loan_preapp_reads'` table with `'loan_preapp_id'` column
- Upserts/deletes using same pattern as inquiry and support
- No more "currently have no persisted per-admin read/unread mechanism" error

### 2. **lib/customer-inbox.ts**

#### Type Definition Update (line ~42)
```typescript
export type LoanInboxRow = SourceBase & {
  // ... existing fields ...
  admin_loan_preapp_reads: { admin_id: CustomerRecordId }[] | null;
};
```

#### Normalization Logic (lines ~88-98)
- Changed from `is_read: false, can_mark_read: false` to:
  ```typescript
  is_read: row.admin_loan_preapp_reads?.some(read => String(read.admin_id) === String(adminId)) ?? false,
  can_mark_read: true,
  ```
- Loans now check admin_loan_preapp_reads relation for read state
- Opening a loan marks it read automatically (existing modal behavior)
- Mark Unread removes only current admin's record (idempotent)

### 3. **app/partnerbanks/partnerbanksclient.tsx**

#### Alert Removal
- Replaced three `alert()` calls (error, success, catch-all) with state-driven toasts
- Lines 87, 91, 96 (old) → state management

#### Toast State (lines 47-48)
```typescript
const [successMessage, setSuccessMessage] = useState('');
const [errorMessage, setErrorMessage] = useState('');
```

#### Form Submission (lines 85-99)
- Sets error/success state instead of alerting
- Auto-closes modal after 1.5s on success
- Error messages persist for 4s (longer for readability)

#### Toast UI (lines 237-255)
- Success: Green border, CheckCircle2 icon, brand-blue text
- Error: Red border, AlertCircle icon, red-600 text
- Fixed position (top-24 right-6, z-[130])
- Matches admin dashboard toast style
- Auto-dismisses via useEffect timers

#### Auto-Dismiss Logic (lines 67-82)
```typescript
useEffect(() => {
  if (successMessage) {
    const timer = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(timer);
  }
}, [successMessage]);
// Similar for errorMessage (4000ms)
```

## Test Updates

**File**: `tests/customer-inbox.test.cjs`

### Updated Fixtures
- Loan fixture now includes `admin_loan_preapp_reads: [{ admin_id: 'admin-a' }]`

### Test Changes

| Test | Old Expectation | New Expectation | Rationale |
|------|-----------------|-----------------|-----------|
| "read state" | Loans never report read (can_mark_read: false) | Loans track per-admin read (can_mark_read: true) | Persistence now implemented |
| "all type/read filters" | No loan read records | 2 read items (support + loan) | Loan included in read set |
| "fetch uses three joined" | Loans not filtered by admin | Loans filtered by admin_loan_preapp_reads | Read relation now queried |
| "read/unread targets junction" | Only inquiry, support cases | Added loan_application case | New table now supported |
| "loan, unknown type malformed" | Loan raises error | Loan accepted as valid type | Loan now supported |

### Regression Test Results

```
✅ 14/14 tests pass
✅ Per-admin read state verified for loans
✅ Loan junction table integrity checked
✅ Fetch query includes admin filter for loans
✅ Toggle action handles loan_application type
✅ Malformed requests still rejected
```

## Verification Checklist

- ✅ Migration mirrors `admin_inquire_reads` schema exactly
- ✅ Foreign keys use correct column names (loan_preapp_id, not loan_id)
- ✅ RLS policy restricts service_role only (no anon/authenticated)
- ✅ Fetch query scopes reads to current admin (idempotent safety)
- ✅ Toggle mutation uses upsert with onConflict (idempotent safety)
- ✅ Mark Unread deletes only admin's row (independent per-admin state)
- ✅ Opening loan auto-marks read (matches inquiry/support)
- ✅ Toast notifications styled consistently with admin dashboard
- ✅ No success/error alerts use browser alert()
- ✅ Auto-dismiss timers prevent permanent display
- ✅ All regression tests pass without modification to core logic
- ✅ No unrelated schema/RBAC/Inbox architecture changed

## Deployment Notes

1. Execute migration `20261007000000_add_admin_loan_preapp_reads.sql` in Supabase before deploying code
2. No schema changes required to existing tables
3. No breaking changes to public forms or APIs
4. Existing loan submissions continue to work; read state retroactively available for new Admin Dashboard activity

## Next Steps (Optional)

- Monitor loan application volume; if >10k active items, consider server-side pagination
- Add audit logging for mark-read actions (aligned with existing audit_logs table)
- Extend admin analytics dashboard to include loan application engagement metrics
