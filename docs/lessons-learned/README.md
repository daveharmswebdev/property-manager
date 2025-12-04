# Lessons Learned Index

> Hard-won wisdom from building Property Manager with Angular 20 and .NET 10.

This section contains practical insights from actual implementation. These lessons will save time on future features and similar projects.

## Quick Access by Problem

**"I'm styling Angular Material dialogs"** → [Frontend Styling Patterns](frontend-styling-patterns.md)

**"My E2E tests are flaky/failing"** → [E2E Testing with Playwright](e2e-testing-playwright.md)

## All Lessons Documents

### 1. [Frontend Styling Patterns](frontend-styling-patterns.md)
Angular Material and CSS patterns including:
- Dialog padding and scrollbar issues
- Icon + text alignment in headers
- Reusable confirmation dialog patterns
- CSS architecture principles

### 2. [E2E Testing with Playwright](e2e-testing-playwright.md)
Playwright E2E testing patterns including:
- Email verification token extraction (quoted-printable encoding)
- Parallel test execution and shared state race conditions
- Async component behavior (setTimeout delays)
- Angular Material dropdown selection
- CI environment differences and debugging

---

## Contributing Lessons

As you work with this codebase and learn new lessons:

1. Document them immediately (memory fades)
2. Include the problem, symptom, root cause, and solution
3. Add code examples where helpful
4. Update this index

**Your struggles today are someone's time savings tomorrow.**
