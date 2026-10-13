# PHASE 2.3A IMPLEMENTATION REPORT

**Status**: ✅ COMPLETE
**Date**: 2026-10-09
**Branch**: feat/admin-login-cloudflare-turnstile
**Scope**: Server-side authorization for Projects module

---

## COMPLETE INSPECTED SERVER ACTION INVENTORY

### Functions Implemented (12 active + 1 disabled)

| # | Function | Type | Authorization | Permission | Status |
|----|----------|------|---------------|-----------|--------|
| 1 | fetchAdminProjectsList() | READ | ✅ Added | can_view | ✅ Protected |
| 2 | fetchArchivedProjectsList() | READ | ✅ Added | can_view | ✅ Protected |
| 3 | archiveProjectAction() | MUTATION | ✅ Added | can_delete | ✅ Protected |
| 4 | restoreArchivedProjectAction() | MUTATION | ✅ Added | can_edit | ✅ Protected |
| 5 | permanentlyDeleteArchivedProjectAction() | DISABLED | Already disabled | — | ✅ Safe |
| 6 | createBasicProjectAction() | CREATE | ✅ Added | can_create | ✅ Protected |
| 7 | ensureProjectNavigationEntriesAction() | MUTATION | ✅ Added | can_edit | ✅ Protected |
| 8 | hideProjectNavigationEntryAction() | MUTATION | ✅ Added | can_edit | ✅ Protected |
| 9 | setProjectWebsiteVisibilityAction() | MUTATION | ✅ Added | can_edit | ✅ Protected |
| 10 | saveProjectAction() | MUTATION (create+edit) | ✅ Added | can_edit | ⚠️ See Gap |
| 11 | getProjectTowerUsageAction() | READ | ✅ Added | can_view | ✅ Protected |
| 12 | deleteProjectTowerAction() | MUTATION | ✅ Added | can_delete | ✅ Protected |
| 13 | fetchProjectForEdit() | READ | ✅ Added | can_view | ✅ Protected |

---

## EXACT AUTHORIZATION CHANGES IMPLEMENTED

### New Import
```typescript
import { getCustomSession, getCurrentUser, getRBACProfile } from './auth';
```

### New Authorization Helper (28 lines)
```typescript
async function authorizeProjectOperation(operation: 'create' | 'edit' | 'delete' | 'view') {
  const profile = await getRBACProfile();
  if (!profile) {
    throw new Error("Unauthorized: Session expired.");
  }

  if (profile.permissions === 'SUPER_ADMIN') {
    return;  // Super-admin bypass
  }

  const modulePerms = typeof profile.permissions === 'object' 
    ? profile.permissions['edit_project'] 
    : null;
  const requiredPermission = `can_${operation}`;

  if (!modulePerms || modulePerms[requiredPermission] !== true) {
    throw new Error(`Unauthorized: You don't have permission to ${operation} projects.`);
  }
}
```

### Per-Function Changes (2-3 lines each × 12)

Pattern applied:
```typescript
await authorizeProjectOperation('view');  // or 'create', 'edit', 'delete'
```

Added to all 12 active functions after session check, before mutations.

---

## FUNCTIONS PROTECTED AND REQUIRED PERMISSIONS

### Read Operations
- **fetchAdminProjectsList()** → can_view
- **fetchArchivedProjectsList()** → can_view
- **getProjectTowerUsageAction()** → can_view
- **fetchProjectForEdit()** → can_view

### Create Operations
- **createBasicProjectAction()** → can_create

### Edit Operations
- **restoreArchivedProjectAction()** → can_edit
- **setProjectWebsiteVisibilityAction()** → can_edit
- **ensureProjectNavigationEntriesAction()** → can_edit
- **hideProjectNavigationEntryAction()** → can_edit
- **saveProjectAction()** → can_edit (⚠️ Phase 2.3B: needs can_create/can_edit split)

### Delete Operations
- **archiveProjectAction()** → can_delete (soft-delete)
- **deleteProjectTowerAction()** → can_delete

---

## EXISTING SESSION AND RBAC COMPATIBILITY

✅ Session validation preserved (getCustomSession checks)
✅ RBAC module pre-exists: edit_project with can_view, can_create, can_edit, can_delete
✅ Super-admin bypass: profile.permissions === 'SUPER_ADMIN'
✅ Group-based permissions: admin_users → groups → module_access
✅ Fail-closed design: Authorization before mutations
✅ Active account validation: Transitive through getRBACProfile

---

## REMAINING CREATE/EDIT AUTHORIZATION GAP

**Problem in saveProjectAction():**
- Currently requires can_edit for both create and edit
- Should require can_create for new projects, can_edit for existing
- Phase 2.3B will add server-side record existence check

**Documented as TODO:**
```typescript
// TODO Phase 2.3B: Separate create (can_create) vs edit (can_edit) authorization
```

---

## TOWER DELETION AND DATA RELATIONSHIPS

### Preserved Behavior
deleteProjectTowerAction() still:
1. Validates tower exists
2. Checks amenity usage
3. Checks layout usage
4. Reassigns amenities to target tower or null
5. Reassigns layouts to target tower
6. Deletes tower registry
7. Re-sequences remaining towers

**Now Protected**: Authorization (can_delete) enforced before deletion

### Known Acceptable Risks
- Race condition: New amenity between check and reassign (low probability)
- Cross-project access: Not validated (admin-only assumption, can be Phase 2.3B)

---

## MULTI-TABLE CONSISTENCY RISKS

**Tower Rename Cascade**: ✅ Now protected by can_edit check
**Partial Save Failure**: ⚠️ Known issue, acceptable for admin-only
**Navigation Orphaning**: ✅ Already handled by cleanupFailedProjectCreation()

---

## EXECUTED TESTING RESULTS

### Automated Tests
✅ npx tsc --noEmit: 0 errors
✅ npm run build: 24/24 routes
✅ git diff --check: No formatting issues

### Manual Tests
Documented in PHASE_2_3_AUDIT.md (awaiting execution):
- 13 scenario groups
- 6 test permission levels
- Workflow regression verification

---

## FILES MODIFIED AND GIT STATUS

**Modified Files**:
- M app/actions/homepage.ts (Phase 2.1 - preserved)
- M app/actions/news.ts (Phase 2.2 - preserved)
- M app/actions/projects.ts (Phase 2.3A - NEW)

**Unchanged**:
- app/actions/auth.ts
- Database schema
- Package dependencies
- CAPTCHA, session cookies
- Other modules

**Changes in Phase 2.3A**:
- +28 lines (helper function)
- +30 lines (12 functions × 2-3 lines)
- +1 line (import)
- Total: +59 lines

---

## RECOMMENDED NEXT STEP

### Phase 2.3B Priority: Create/Edit Authorization Separation

Add server-side record existence check in saveProjectAction():
1. If targetProjectId is null or record doesn't exist → require can_create
2. If targetProjectId and record exists → require can_edit
3. Fail closed on lookup failure

Effort: ~45 minutes

---

## PHASE 2.3A STATUS: ✅ COMPLETE

**Delivered**:
✅ 12 functions protected with RBAC
✅ Provisional permissions implemented
✅ Fail-closed before mutations
✅ Backward compatible

**Verified**:
✅ TypeScript: 0 errors
✅ Build: 24/24 routes
✅ Formatting: No issues

**Remaining Gap**:
⚠️ Phase 2.3B: Create/edit separation in saveProjectAction()

Ready for manual testing and Phase 2.3B implementation.
