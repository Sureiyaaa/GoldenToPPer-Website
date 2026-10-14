# Payment Carousel CMS - Setup Instructions

This document describes the setup steps required to enable the Payment Carousel admin CMS backend.

## Phase 1: Backend Foundation

### 1. Database Schema

**Status:** ✓ Migration created at `supabase/migrations/20261014000000_add_payment_carousel_slides.sql`

Apply the migration to Supabase:
```bash
supabase db push
```

This creates the `payment_carousel_slides` table with:
- Default showcase support (project_id IS NULL)
- Project-specific slides (project_id = X)
- Focal point metadata (focal_x, focal_y)
- Admin visibility toggle (is_active)
- Audit trail (created_at, updated_at)

### 2. RBAC Module Registration

**Status:** ✓ Registered automatically by migration

The `payment_carousel` module is registered automatically by the database migration. 

#### Access Control

**SUPER_ADMIN users:**
- Automatically receive full access (create, edit, delete, view) via existing authorization bypass

**Other admin groups:**
- Must be explicitly granted access via the `module_access` table
- Granting is a manual step performed separately from migration
- Do NOT automatically grant all existing groups; only grant explicitly to intended groups

#### To Grant Permission to a Specific Group

Use Supabase dashboard SQL editor:

```sql
-- Replace 'group-uuid-here' with actual group ID
INSERT INTO public.module_access 
  (group_id, module_id, can_view, can_create, can_edit, can_delete)
SELECT 
  'group-uuid-here'::uuid,
  id,
  true, true, true, true
FROM public.modules
WHERE module_code = 'payment_carousel'
ON CONFLICT DO NOTHING;
```

#### Verify Module Registered

```sql
SELECT id, module_code FROM public.modules WHERE module_code = 'payment_carousel';
```

Expected: 1 row with module_code = 'payment_carousel'

### 3. Server Actions

**Status:** ✓ Created at `app/actions/payment-carousel.ts`

Provides:

**Public (Read-Only):**
- `fetchDefaultCarouselSlidesAction()` — Default showcase slides for public Payment page
- `fetchProjectCarouselSlidesAction(projectId)` — Project-specific carousel slides

**Admin (CRUD + Reorder):**
- `fetchCarouselSlidesForAdminAction(projectId)` — Fetch all slides (active + inactive) for admin editing
- `createPaymentCarouselSlideAction(payload)` — Add new slide
- `updatePaymentCarouselSlideAction(slideId, payload)` — Edit slide metadata/focal point
- `togglePaymentCarouselSlideStatusAction(slideId, status)` — Toggle is_active visibility
- `deletePaymentCarouselSlideAction(slideId)` — Remove slide
- `reorderPaymentCarouselSlidesAction(projectId, orderedIds)` — Reorder slides atomically

All admin actions include:
- ✓ RBAC authorization (payment_carousel module)
- ✓ Field allowlist validation (security)
- ✓ Project/FK validation
- ✓ Focal point range validation (0–100)
- ✓ Audit logging
- ✓ Cache revalidation (revalidatePath('/payment') called after successful persistence)
- ✓ Error handling

### 4. Authorization Implementation

**File:** `app/actions/payment-carousel.ts`

Uses existing repository authorization pattern:

```typescript
// RBAC check for payment_carousel module
const modulePerms = profile.permissions['payment_carousel'];

// Operation → Required Permission
- CREATE → can_create
- EDIT   → can_edit
- DELETE → can_delete
- VIEW   → can_view

// SUPER_ADMIN bypasses all checks automatically
```

### 5. Audit Logging & Cache Revalidation

**Audit Logging:**

Status: ✓ Integrated using existing `createAuditLogAction()` pattern

Logged events:
- `CREATE` — Slide added
- `EDIT` — Slide properties updated
- `VISIBILITY` — Slide activated/deactivated
- `REORDERED` — Slides reordered
- `DELETE` — Slide removed

Audit context:
- Entity type: "Payment Carousel"
- Entity name: "Default Showcase" or "Project X"
- Details: Operation description + payload summary

**Audit Failure Semantics:**

Audit logging is best-effort, performed AFTER successful database persistence. If audit logging fails:
- Database mutation remains persisted ✓
- Admin receives `success: true` response (not a silent partial-success)
- Warning logged to server console
- Public carousel eventually reflects change (Next.js revalidation occurs regardless)

**Cache Revalidation:**

After successful persistence and audit logging, `revalidatePath('/payment')` is called to invalidate Next.js cache. This ensures the public Payment page reflects carousel changes immediately without hard browser refresh. Revalidation errors are logged as warnings but do not cause the mutation to fail.

## Phase 2: Admin Editor UI (Future)

Placeholder for next phase:
- `app/admin/payment/page.tsx` — Main editor
- `app/admin/payment/PaymentCarouselPreview.tsx` — Preview component
- `app/admin/payment/FocalPointEditor.tsx` — Focal point UI
- Integrate into dashboard navigation

## Testing

### Unit Tests (Server Actions)

```typescript
// Test authorization
const result = await createPaymentCarouselSlideAction({...});
// ✓ SUPER_ADMIN → success
// ✓ EDITOR (no permission) → error
// ✓ EDITOR (has permission) → success

// Test validation
const result = await createPaymentCarouselSlideAction({
  image_url: '',  // Invalid: empty
  focal_x: 150,   // Invalid: > 100
});
// ✓ Error: validation failed

// Test project validation
const result = await createPaymentCarouselSlideAction({
  project_id: 999,  // Non-existent project
  image_url: 'url',
});
// ✓ Error: project not found

// Test reorder atomicity
const result = await reorderPaymentCarouselSlidesAction(null, [5, 3, 1, 2, 4]);
// ✓ All slides updated with sort_order 0, 1, 2, 3, 4
```

### Integration Tests (Public Payment Page)

Currently skipped (Phase 4):
- Payment page will remain using static carousel
- Database carousel configuration ready but not yet in use
- Public Payment carousel must remain 100% operational during Phase 1

### Manual Testing

1. Open Supabase dashboard
2. Verify `payment_carousel_slides` table created
3. Insert test row:
   ```sql
   INSERT INTO payment_carousel_slides 
     (project_id, image_url, alt_text, is_active)
   VALUES (NULL, 'https://example.com/image.jpg', 'Test Slide', true);
   ```
4. Query default showcase:
   ```sql
   SELECT * FROM payment_carousel_slides 
   WHERE project_id IS NULL AND is_active = true
   ORDER BY sort_order;
   ```
5. Verify RLS configuration:

   **Check RLS enabled on table:**
   ```sql
   SELECT relname, relrowsecurity
   FROM pg_class
   WHERE relname = 'payment_carousel_slides';
   ```
   Expected: `relrowsecurity = true`

   **Check table role grants:**
   ```sql
   SELECT grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND table_name = 'payment_carousel_slides';
   ```
   Expected: service_role with SELECT, INSERT, UPDATE, DELETE grants

   **Check sequence privileges:**
   ```sql
   SELECT grantee, privilege_type
   FROM information_schema.role_usage_grants
   WHERE object_schema = 'public'
     AND object_name = 'payment_carousel_slides_id_seq';
   ```
   Expected: service_role with USAGE and SELECT privileges

   **Verify anon/authenticated access blocked:**
   - Connect as anon user (via browser with public key)
   - Try: `select * from payment_carousel_slides`
   - Expected: 403 permission denied

## Troubleshooting

### Module Not Found Error

```
Error: Unauthorized: You don't have permission to create carousel slides.
```

**Cause:** User's group not granted `payment_carousel` permission

**Fix:** 
1. Verify module registered: `SELECT * FROM modules WHERE module_code = 'payment_carousel'`
2. Check user's group: `SELECT group_id FROM admin_users WHERE id = 'user-id'`
3. Grant permission: Run SQL from Section 2.B above with correct group_id

### Focal Point Out of Range

```
Error: Validation failed: focal_x must be between 0 and 100
```

**Cause:** Client sent focal_x > 100 or < 0

**Fix:** Client-side validation enforces 0–100 range; error indicates bypass attempt. Verify admin UI code.

### Project Not Found

```
Error: Project not found or is inactive
```

**Cause:** Submitted project_id doesn't exist, is_active=false, or is deleted

**Fix:** Only valid, active projects can be assigned carousel slides. Check project status in Projects admin.

### Service Role Key Not Set

```
Error: Cannot connect to Supabase (SUPABASE_SERVICE_ROLE_KEY missing)
```

**Cause:** `.env.local` missing `SUPABASE_SERVICE_ROLE_KEY`

**Fix:** Add to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Dependencies

- Supabase (existing)
- React-hook-form (for Phase 2 admin UI)
- Next.js (for revalidatePath)
- bcryptjs (existing, for auth)

No new npm packages required for Phase 1 backend.

## References

- Schema: `supabase/migrations/20261014000000_add_payment_carousel_slides.sql`
- Server Actions: `app/actions/payment-carousel.ts`
- Authorization Pattern: `app/actions/auth.ts` (getRBACProfile)
- Audit Logging: `app/actions/admin_fetchers.ts` (createAuditLogAction)
- Similar Implementation: `app/actions/homepage.ts` (payment_carousel pattern is based on this)
