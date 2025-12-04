# E2E Testing with Playwright - Lessons Learned

> Critical insights from implementing Playwright E2E tests for Property Manager. These lessons will save hours of debugging on future E2E test development.

## Table of Contents

1. [Email Verification Token Extraction](#1-email-verification-token-extraction)
2. [Parallel Test Execution and Shared State](#2-parallel-test-execution-and-shared-state)
3. [Async Component Behavior](#3-async-component-behavior)
4. [Angular Material Dropdown Selection](#4-angular-material-dropdown-selection)
5. [CI Environment Differences](#5-ci-environment-differences)

---

## 1. Email Verification Token Extraction

### Problem
E2E tests for email verification flow were failing with "Invalid verification link" errors.

### Symptom
The extracted token was `3DMDE5YWVhMmIt...` instead of `MDE5YWVhMmIt...` (note the `3D` prefix).

### Root Cause
**Quoted-printable encoding** in email bodies. SMTP emails use this encoding where special characters are encoded as `=XX` (hex). The `=` character becomes `=3D`.

So in the email body:
```
token=MDE5YWVhMmIt...
```
Becomes:
```
token=3DMDE5YWVhMmIt...
```

Additionally, URL-encoded characters (`%2f`, `%2b`, etc.) in tokens weren't being captured by the regex.

### Solution

```typescript
// mailhog.helper.ts

private decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)));
}

extractVerificationToken(message: MailHogMessage): string | null {
  const body = this.decodeQuotedPrintable(message.Content.Body);
  // Include % for URL-encoded characters in tokens
  const tokenMatch = body.match(/[?&]token=([a-zA-Z0-9_%-]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}
```

### Key Takeaway
**Always decode email content before extracting data.** SMTP protocols use various encodings (quoted-printable, base64) that must be handled.

---

## 2. Parallel Test Execution and Shared State

### Problem
Tests passed individually but failed randomly when run in parallel with multiple workers.

### Symptom
```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
waiting for locator('.success-icon') to be visible
```

One test would fail with "Invalid verification link" while another passed.

### Root Cause
**Race condition with shared MailHog state.** When tests ran in parallel:

1. Test A registers user, verification email sent to MailHog
2. Test B calls `deleteAllMessages()` in its `beforeEach`
3. Test A tries to retrieve its email - it's gone!

```typescript
// BAD: This causes race conditions
test.beforeEach(async ({ mailhog }) => {
  await mailhog.deleteAllMessages(); // Deletes ALL emails including other tests'
});
```

### Solution
**Don't delete shared state in parallel tests.** Instead, rely on unique identifiers:

```typescript
// GOOD: Each test uses unique timestamp-based email
static generateTestUser(): TestUser {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`, // Unique per test
    // ...
  };
}

// Filter by specific email instead of clearing all
async getVerificationToken(email: string): Promise<string> {
  const message = await this.waitForEmail(email, 'Verify');
  // ...
}
```

### Key Takeaway
**Design E2E tests for parallel execution from the start:**
- Use unique identifiers (timestamps, UUIDs) for test data
- Never delete or modify shared resources (databases, email queues) globally
- Filter by specific test data rather than clearing everything

---

## 3. Async Component Behavior

### Problem
Tests failed waiting for redirect after email verification, even though verification succeeded.

### Symptom
```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
waiting for navigation to "/login" until "load"
  navigated to "http://localhost:4200/verify-email?token=..."
```

### Root Cause
The `verify-email.component.ts` has a **3-second delay** before redirecting:

```typescript
// verify-email.component.ts
this.authService.verifyEmail(token).subscribe({
  next: () => {
    this.state.set('success');
    // 3 second delay before redirect!
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3000);
  },
  // ...
});
```

The test was waiting for the URL change but timing out before the 3-second delay completed.

### Solution
**Wait for the intermediate state before waiting for navigation:**

```typescript
// Wait for success state FIRST
await page.locator('.success-icon, mat-icon:has-text("check_circle")')
  .waitFor({ state: 'visible', timeout: 10000 });

// THEN wait for redirect (which happens 3s after success)
await page.waitForURL('/login', { timeout: 10000 });
```

### Key Takeaway
**Understand your component's async behavior:**
- Check for `setTimeout`, animations, or delayed actions
- Wait for intermediate states before final states
- Don't assume navigation happens immediately after API success

---

## 4. Angular Material Dropdown Selection

### Problem
Property form test timed out trying to select a state from dropdown.

### Symptom
```
TimeoutError: Test timeout of 30000ms exceeded.
waiting for locator('mat-option').filter({ hasText: 'TX' })
```

### Root Cause
The dropdown shows **full state names** ("Texas", "California") but test data used **state codes** ("TX", "CA").

```typescript
// BAD: Using codes when dropdown shows names
return {
  state: 'TX', // Dropdown shows "Texas", not "TX"
};
```

### Solution
**Match the actual UI text:**

```typescript
// GOOD: Use what the user sees
return {
  state: 'Texas', // Matches dropdown option text
};
```

### Key Takeaway
**E2E tests interact with the UI as users do:**
- Use visible text, not internal codes
- Check actual rendered values in screenshots/traces
- Consider adding `data-testid` attributes for stable selectors

---

## 5. CI Environment Differences

### Problem
Tests pass locally but fail in GitHub Actions CI.

### Common Causes and Solutions

#### Timing Issues
CI runners are often slower than local machines:

```typescript
// Increase timeouts for CI
retries: process.env.CI ? 2 : 0,
workers: process.env.CI ? 1 : undefined, // Serial execution in CI
timeout: 30000, // Global timeout
```

#### Service Dependencies
Ensure services are ready before tests run:

```yaml
# ci.yml - Wait for API health check
- name: Start backend API
  run: |
    dotnet run &
    for i in {1..30}; do
      if curl -s http://localhost:5292/api/v1/health > /dev/null; then
        echo "API is ready"
        break
      fi
      sleep 2
    done
```

#### Network Differences
Use explicit localhost URLs:

```typescript
baseURL: process.env.BASE_URL || 'http://localhost:4200',
```

### Key Takeaway
**CI environments are different:**
- Always add health checks and readiness waits
- Use environment variables for URLs
- Run tests serially in CI to reduce flakiness
- Upload artifacts (screenshots, traces) on failure for debugging

---

## Quick Reference: E2E Test Debugging Checklist

When E2E tests fail, check in this order:

1. **Screenshots/Traces** - What does the UI actually show?
2. **Timing** - Is something async not being awaited?
3. **Data** - Is test data being interfered with by parallel tests?
4. **Selectors** - Do selectors match actual rendered content?
5. **Environment** - Are services running? Are URLs correct?

---

## File Locations

| File | Purpose |
|------|---------|
| `frontend/playwright.config.ts` | Playwright configuration |
| `frontend/e2e/helpers/mailhog.helper.ts` | Email verification helpers |
| `frontend/e2e/helpers/auth.helper.ts` | Authentication flow helpers |
| `frontend/e2e/helpers/test-data.helper.ts` | Test data generators |
| `frontend/e2e/fixtures/test-fixtures.ts` | Reusable test fixtures |
| `.github/workflows/ci.yml` | CI pipeline with E2E job |

---

## Related Resources

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Quoted-Printable Encoding](https://en.wikipedia.org/wiki/Quoted-printable)
