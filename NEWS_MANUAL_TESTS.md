# News Security Manual Acceptance Tests

## Prerequisites
- Development environment running
- Admin logged in with test accounts
- Test accounts with varying permissions:
  - Account A: can_create=true, can_edit=true, can_delete=true (full access)
  - Account B: can_create=false, can_edit=true, can_delete=false (edit only)
  - Account C: can_create=true, can_edit=false, can_delete=false (create only)

## Test Scenarios

### 1. Authorized Article Creation
- **Setup**: Use Account A (can_create=true)
- **Steps**:
  1. Navigate to `/admin/news`
  2. Create new article with:
     - Title: "Test Article 1"
     - Category: "News"
     - Date: Today's date
     - Slug: "test-article-1"
     - Excerpt: "Test article body content"
     - Image: (optional)
  3. Click Save
- **Expected**: Article created, UI shows "Article created."
- **Verify**: Article appears in news list with correct fields
- **Status**: [NOT YET EXECUTED]

### 2. Authorized Article Editing
- **Setup**: Use Account A with existing article
- **Steps**:
  1. Open existing article
  2. Modify fields:
     - Title: "Updated Title"
     - Excerpt: "Updated body content"
  3. Click Save
- **Expected**: Article updated, UI shows "Article updated."
- **Verify**: Changes saved to database, audit log created
- **Status**: [NOT YET EXECUTED]

### 3. Authorized Article Deletion
- **Setup**: Use Account A with test article
- **Steps**:
  1. Navigate to article
  2. Delete article (via database direct call or UI if available)
- **Expected**: Article deleted successfully
- **Verify**: Record removed from database
- **Status**: [NOT YET EXECUTED]

### 4. Unauthorized Creation (Edit-Only User)
- **Setup**: Use Account B (can_create=false, can_edit=true)
- **Steps**:
  1. Navigate to `/admin/news`
  2. Attempt to create new article
  3. Submit form with valid data
- **Expected**: Error "You don't have permission to create articles"
- **Verify**: No article created in database
- **Browser Console**: Check for error message
- **Status**: [NOT YET EXECUTED]

### 5. Unauthorized Editing (Create-Only User)
- **Setup**: Use Account C (can_create=true, can_edit=false)
- **Steps**:
  1. Open existing article for editing
  2. Modify excerpt
  3. Click Save
- **Expected**: Error "You don't have permission to edit articles"
- **Verify**: Article not modified in database
- **Status**: [NOT YET EXECUTED]

### 6. Unauthorized Deletion (No Delete Permission)
- **Setup**: Use Account B or C (no can_delete permission)
- **Steps**:
  1. Directly call deleteArticleFromDB() via API
  2. Example: POST request to server action
- **Expected**: Error "You don't have permission to delete articles"
- **Verify**: Article still exists in database
- **Status**: [NOT YET EXECUTED]

### 7. Valid Image Upload
- **Setup**: Use Account A (has can_create or can_edit)
- **Steps**:
  1. Create new article
  2. Upload image file:
     - File: 500KB PNG image
     - Type: image/png
  3. Submit article
- **Expected**: Image uploaded to storage, URL returned
- **Verify**: Image URL saved in article.image field
- **Browser Network Tab**: Check upload request succeeded
- **Status**: [NOT YET EXECUTED]

### 8. Invalid File Type Upload
- **Setup**: Use Account A
- **Steps**:
  1. Create new article
  2. Attempt to upload invalid file:
     - File: test.exe or test.txt
- **Expected**: Error "Invalid file type. Allowed types: jpg, jpeg, png, webp, gif"
- **Verify**: File not uploaded to storage
- **Browser Console**: Check error message
- **Status**: [NOT YET EXECUTED]

### 9. Oversized Image Upload
- **Setup**: Use Account A
- **Steps**:
  1. Create new article
  2. Upload image > 10MB
- **Expected**: Error "File too large. Maximum size: 10MB"
- **Verify**: File not uploaded to storage
- **Status**: [NOT YET EXECUTED]

### 10. Image Upload Without Save
- **Setup**: Use Account A
- **Steps**:
  1. Create new article form
  2. Upload image successfully
  3. Navigate away WITHOUT saving article
  4. Check storage for uploaded image
- **Expected**: Image remains in storage (orphaned)
- **Verify**: Orphaned file exists in news_images bucket
- **Risk Assessment**: Acceptable (no data loss, just wasted storage)
- **Status**: [NOT YET EXECUTED]

### 11. Nonexistent Edit Target
- **Setup**: Account A
- **Steps**:
  1. Try to load `/admin/news?edit=99999` (nonexistent ID)
  2. Modify excerpt, click Save
- **Expected**: Article loads as new, save creates new article instead
- **Verify**: New record created with unique ID
- **UI Behavior**: URL updates to new article ID
- **Status**: [NOT YET EXECUTED]

### 12. Attempted System Field Modification
- **Setup**: Developer console, Account A
- **Steps**:
  1. Open article for edit
  2. Manually inject payload in DevTools:
     ```javascript
     // Intercept saveArticleToDB call
     const payload = {
       title: "Test",
       excerpt: "Body",
       created_at: "2000-01-01",  // Try to inject system field
       is_archived: true,          // Try to inject system field
       custom_field: "hack"        // Try to inject unknown field
     };
     ```
  3. Submit
- **Expected**: Only title, excerpt, category, date, slug, image preserved
- **Verify**: created_at, is_archived, custom_field NOT in saved record
- **Database Check**: Inspect actual record fields
- **Status**: [NOT YET EXECUTED]

### 13. Audit Logging
- **Setup**: Account A creates/edits/deletes article
- **Steps**:
  1. Create article "Audit Test"
  2. Edit article
  3. Check admin_audit_log table
- **Expected**: Entries created with:
   - action: "CREATE" or "EDIT"
   - section: "News & Updates"
   - description: Corresponding operation
   - user_id: Matches current user
- **Status**: [NOT YET EXECUTED]

## Regression Checks

### Homepage News Display
- **Steps**: Navigate to homepage, check news widget
- **Expected**: News articles display without authorization errors
- **Status**: [NOT YET EXECUTED]

### Public News Page
- **Steps**: Navigate to `/news&updates`
- **Expected**: Public articles display, no admin data exposed
- **Status**: [NOT YET EXECUTED]

## Summary Template

Once tests are executed, fill in results:

| # | Scenario | Status | Notes |
|----|----------|--------|-------|
| 1  | Authorized Creation | [ ] PASS [ ] FAIL | |
| 2  | Authorized Editing | [ ] PASS [ ] FAIL | |
| 3  | Authorized Deletion | [ ] PASS [ ] FAIL | |
| 4  | Unauthorized Creation | [ ] PASS [ ] FAIL | |
| 5  | Unauthorized Editing | [ ] PASS [ ] FAIL | |
| 6  | Unauthorized Deletion | [ ] PASS [ ] FAIL | |
| 7  | Valid Image Upload | [ ] PASS [ ] FAIL | |
| 8  | Invalid File Type | [ ] PASS [ ] FAIL | |
| 9  | Oversized Image | [ ] PASS [ ] FAIL | |
| 10 | Image Orphaning | [ ] PASS [ ] FAIL | |
| 11 | Nonexistent Target | [ ] PASS [ ] FAIL | |
| 12 | System Field Injection | [ ] PASS [ ] FAIL | |
| 13 | Audit Logging | [ ] PASS [ ] FAIL | |
