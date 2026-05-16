---
description: "Generate failing acceptance tests before implementation (Given-When-Then, network-first, TDD)"
---

# Create ATDD Tests

## Context

Generate failing acceptance tests BEFORE implementation following TDD's red-green-refactor cycle. Tests define expected behavior and must fail for the right reason (missing implementation, not test errors). The output is a set of failing tests plus an implementation checklist.

## Inputs

- Story file: user provides path or story number
- `docs/project/project-context.md` — coding standards and test patterns
- Existing test patterns in `frontend/e2e/` and `backend/tests/`
- Playwright config at `frontend/playwright.config.ts`

## Process

### Step 1: Load story and test context

1. Read the story file — extract all acceptance criteria
2. Read Playwright config and identify test directory structure
3. Search existing tests for similar patterns, reusable fixtures, helpers, data factories
4. Note naming conventions and selector patterns in use

### Step 2: Select test levels

For each acceptance criterion, determine the appropriate level:
- **E2E** — critical user journeys, multi-system integration, user-facing ACs
- **API/Integration** — business logic validation, service contracts, data transformations
- **Component** — UI component behavior, form validation, interaction testing
- **Unit** — pure business logic, edge cases, error handling

Avoid duplicate coverage across levels. Use E2E for critical happy paths only, API tests for business logic variations, component tests for UI edge cases.

### Step 3: Generate failing tests

**E2E tests** — use Given-When-Then format:

```typescript
test.describe('Feature Name', () => {
  test('should [expected behavior]', async ({ page }) => {
    // GIVEN: [precondition]
    // WHEN: [action]
    // THEN: [expected outcome]
  });
});
```

**Critical patterns to follow:**

1. **Network-first**: Intercept routes BEFORE navigation
```typescript
// CORRECT: intercept before navigate
await page.route('**/api/data', handler);
await page.goto('/page');

// WRONG: navigate then intercept (race condition)
await page.goto('/page');
await page.route('**/api/data', handler);
```

2. **data-testid selectors**: Use `[data-testid="name"]` for stability, not CSS classes

3. **One assertion per test**: Atomic tests — if the second assertion fails, you don't know if the first is still valid

4. **Explicit waits**: No hard waits/sleeps — use Playwright's built-in waiting

5. **E2E shared database warning**: Tests share a single database and test account. Use `page.route()` to control data shape. Never assume seed-data counts.

**Backend unit tests** — Application layer (MediatR handlers, validators):

```csharp
// backend/tests/PropertyManager.Application.Tests/
public class CreateExpenseCommandHandlerTests
{
    private readonly Mock<IApplicationDbContext> _contextMock;
    private readonly CreateExpenseCommandHandler _handler;

    public CreateExpenseCommandHandlerTests()
    {
        _contextMock = new Mock<IApplicationDbContext>();
        _handler = new CreateExpenseCommandHandler(_contextMock.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_CreatesExpenseAndReturnsId()
    {
        // GIVEN: a valid create expense command
        var command = new CreateExpenseCommand
        {
            PropertyId = Guid.NewGuid(),
            Amount = 150.00m,
            Description = "Plumbing repair",
            CategoryId = Guid.NewGuid(),
            Date = DateTime.UtcNow
        };

        _contextMock.Setup(x => x.Expenses.AddAsync(It.IsAny<Expense>(), default))
            .Returns(ValueTask.CompletedTask);
        _contextMock.Setup(x => x.SaveChangesAsync(default))
            .ReturnsAsync(1);

        // WHEN: the handler processes the command
        var result = await _handler.Handle(command, CancellationToken.None);

        // THEN: an expense ID is returned and the entity was persisted
        result.Should().NotBe(Guid.Empty);
        _contextMock.Verify(x => x.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_MissingPropertyId_ThrowsValidationException()
    {
        // GIVEN: a command with no property ID
        var command = new CreateExpenseCommand { PropertyId = Guid.Empty };

        // WHEN/THEN: validation fails
        await Assert.ThrowsAsync<ValidationException>(
            () => _handler.Handle(command, CancellationToken.None));
    }
}
```

**Backend integration tests** — API endpoints with real HTTP:

```csharp
// backend/tests/PropertyManager.Api.Tests/
public class ExpensesControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ExpensesControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
        // Authenticate the client (JWT token setup)
    }

    [Fact]
    public async Task PostExpense_ValidPayload_Returns201WithId()
    {
        // GIVEN: a valid expense payload
        var payload = new { propertyId = _testPropertyId, amount = 100.00, description = "Test", categoryId = _testCategoryId, date = "2026-01-15" };

        // WHEN: posting to the expenses endpoint
        var response = await _client.PostAsJsonAsync("/api/v1/expenses", payload);

        // THEN: returns 201 with the new expense ID
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<CreateExpenseResponse>();
        body!.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task PostExpense_MissingRequiredFields_Returns400WithValidationErrors()
    {
        // GIVEN: an incomplete payload
        var payload = new { description = "Missing required fields" };

        // WHEN: posting to the expenses endpoint
        var response = await _client.PostAsJsonAsync("/api/v1/expenses", payload);

        // THEN: returns 400 with validation error details
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
```

**Key C# test patterns:**
- Use xUnit `[Fact]` and `[Theory]` attributes
- Use FluentAssertions (`Should()`) for readable assertions
- Use Moq for mocking interfaces
- Use `WebApplicationFactory<Program>` for integration tests
- Follow the Arrange/Act/Assert (Given/When/Then) structure
- One assertion focus per test method
- Test naming: `MethodName_Scenario_ExpectedResult`

**Test project structure:**
- `backend/tests/PropertyManager.Application.Tests/` — command/query handler tests, validator tests
- `backend/tests/PropertyManager.Api.Tests/` — controller integration tests
- `backend/tests/PropertyManager.Infrastructure.Tests/` — EF Core query tests

### Step 4: Build data infrastructure

Create or update as needed:
- **Data factories** using faker for random data (no hardcoded values), with override support
- **Test fixtures** with auto-cleanup
- **Document required `data-testid` attributes** for the dev workflow to add

### Step 5: Verify tests fail

Run the tests locally. Confirm:
- All tests FAIL (red phase)
- Failures are due to missing implementation, not test bugs
- Failure messages are clear and actionable

### Step 6: Create implementation checklist

Write ATDD checklist to `docs/project/atdd-checklists/atdd-checklist-{story_key}.md`:

```markdown
# ATDD Checklist: {story_key}

## Acceptance Criteria → Test Mapping
[Each AC mapped to specific test files]

## Failing Tests Created
- E2E: {count} tests in {files}
- Backend: {count} tests in {files}

## Required data-testid Attributes
[List with element descriptions]

## Implementation Checklist
[For each failing test: implementation tasks to make it pass]

## Red-Green-Refactor Workflow
1. Pick one failing test
2. Implement minimal code to pass it
3. Run test to verify green
4. Refactor with confidence
5. Repeat
```

Report completion and suggest running `/dev-story` next to implement.

## Validation Gates

- [ ] Every acceptance criterion has at least one test
- [ ] All tests fail initially (red phase verified)
- [ ] Network-first pattern applied to all E2E tests
- [ ] Given-When-Then format used consistently
- [ ] data-testid selectors used (not CSS classes)
- [ ] No hard waits — only Playwright built-in waiting
- [ ] Implementation checklist maps tests to tasks
