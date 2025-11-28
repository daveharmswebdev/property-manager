# 🧪 Testing Strategies & Lessons

> *"Tests are the first users of your code. If they're painful to write, your code is painful to use."*

## Executive Summary

Testing Upkeep.io revealed fundamental truths about what to test, how to test it, and when testing provides value versus ceremony. We achieved 100% unit test coverage on business logic but learned that coverage doesn't equal confidence.

## 🎯 Testing Philosophy That Emerged

### "Test Behavior, Not Implementation"

**The Wrong Way:**
```typescript
// Testing implementation details
it('should call repository.create with correct params', () => {
  await useCase.execute(input);
  expect(mockRepo.create).toHaveBeenCalledWith(expectedParams);
});
```

**The Right Way:**
```typescript
// Testing behavior
it('should create a property for the user', () => {
  const property = await useCase.execute(input);
  expect(property.address).toBe(input.address);
  expect(property.userId).toBe(input.userId);
});
```

**The Difference:**
Implementation tests break when refactoring. Behavior tests only break when behavior changes.

### "Test Pyramid, Not Test Ice Cream Cone"

**What We Built (Good):**
```
         /\          Integration (10%)
        /  \         Use Case Tests (70%)
       /    \        Unit Tests (20%)
      /______\
```

**What to Avoid:**
```
        ____         Manual Tests (40%)
       |    |        Integration (10%)
       |    |        Use Cases (20%)
       \    /        Unit Tests (30%)
        \__/
```

**The Lesson:**
Most tests should be at the use case level - they provide the best balance of speed and confidence.

## 📊 Testing Metrics & Reality

### What We Achieved

| Metric | Target | Actual | Reality Check |
|--------|--------|--------|---------------|
| Unit Test Coverage | 80% | 100% | ✅ But missed integration issues |
| Test Execution Time | < 30s | 12s | ✅ Fast enough for TDD |
| Test Reliability | 100% | 98% | ⚠️ Occasional date-based failures |
| Bug Escape Rate | < 5% | ~15% | ❌ Integration bugs escaped |

### Coverage Isn't Everything

**100% Coverage Example:**
```typescript
// This has 100% coverage
function divide(a: number, b: number): number {
  return a / b;
}

test('divides numbers', () => {
  expect(divide(10, 2)).toBe(5);
});
// But crashes with divide(10, 0)
```

**The Lesson:**
Coverage shows what you tested, not what you tested well.

## 🏗️ Testing Architecture Layers

### 1. Domain Entity Tests

**What to Test:**
- Business invariants
- Entity validation
- Value object equality

**Example That Worked:**
```typescript
describe('Property Entity', () => {
  it('should not allow negative purchase price', () => {
    expect(() => new Property({
      purchasePrice: -1000
    })).toThrow('Purchase price cannot be negative');
  });

  it('should calculate age correctly', () => {
    const property = new Property({
      purchaseDate: new Date('2020-01-01')
    });
    expect(property.age).toBe(4); // in 2024
  });
});
```

**Lesson:** Domain tests should be numerous and fast. They're your first line of defense.

### 2. Use Case Tests (The Sweet Spot)

**What Made These Valuable:**
- Test business logic without infrastructure
- Fast execution with mocked dependencies
- High confidence in core functionality

**The Pattern That Worked:**
```typescript
describe('CreatePropertyUseCase', () => {
  let useCase: CreatePropertyUseCase;
  let mockPropertyRepo: jest.Mocked<IPropertyRepository>;
  let mockEventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    // Arrange - Setup mocks
    mockPropertyRepo = createMockRepository();
    mockEventBus = createMockEventBus();
    useCase = new CreatePropertyUseCase(mockPropertyRepo, mockEventBus);
  });

  describe('successful creation', () => {
    it('should create property with valid input', async () => {
      // Arrange
      const input = validPropertyInput();
      mockPropertyRepo.create.mockResolvedValue(propertyEntity(input));

      // Act
      const result = await useCase.execute(input);

      // Assert - Business logic
      expect(result).toMatchObject({
        address: input.address,
        userId: input.userId
      });

      // Assert - Side effects
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PropertyCreated'
        })
      );
    });
  });

  describe('validation failures', () => {
    it('should reject property without address', async () => {
      const input = { ...validInput, address: '' };

      await expect(useCase.execute(input))
        .rejects.toThrow(ValidationError);

      expect(mockPropertyRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('business rule enforcement', () => {
    it('should prevent duplicate addresses for same user', async () => {
      mockPropertyRepo.findByAddress.mockResolvedValue(existingProperty);

      await expect(useCase.execute(input))
        .rejects.toThrow('Property at this address already exists');
    });
  });
});
```

**Why This Pattern Worked:**
- Clear AAA structure (Arrange, Act, Assert)
- Tests business rules, not implementation
- Fast execution (no database)
- Easy to understand failures

### 3. Integration Tests (What We Missed)

**What We Should Have Had:**
```typescript
describe('Property API Integration', () => {
  let app: Application;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase();
    token = await getAuthToken();
  });

  describe('POST /api/properties', () => {
    it('should create property through full stack', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701'
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        address: '123 Main St'
      });

      // Verify in database
      const saved = await db.property.findUnique({
        where: { id: response.body.id }
      });
      expect(saved).toBeTruthy();
    });

    it('should handle validation errors correctly', async () => {
      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({ address: '' }); // Invalid

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });
});
```

**What Integration Tests Would Have Caught:**
- Module loading issues
- Middleware problems
- Database transaction issues
- API contract mismatches
- Authentication flow problems

**The Lesson:** Integration tests are slow but catch real issues. Have at least one happy path and one error path per endpoint.

## 🔴 Testing Mistakes & Learnings

### Mistake 1: Over-Mocking

**What We Did:**
```typescript
// Mocked everything
const mockValidator = { validate: jest.fn() };
const mockLogger = { log: jest.fn() };
const mockConfig = { get: jest.fn() };
const mockCache = { get: jest.fn(), set: jest.fn() };
```

**The Problem:**
- Tests passed but production failed
- Mocks diverged from reality
- Tests became brittle

**The Fix:**
Only mock external dependencies:
- ✅ Database repositories
- ✅ External APIs
- ✅ File system
- ❌ Validators (use real ones)
- ❌ Utility functions
- ❌ Domain objects

### Mistake 2: Time-Dependent Tests

**The Problem:**
```typescript
it('should calculate age correctly', () => {
  const property = new Property({
    purchaseDate: new Date('2020-01-01')
  });
  expect(property.age).toBe(4); // Fails in 2025!
});
```

**The Fix:**
```typescript
it('should calculate age correctly', () => {
  const fixedDate = new Date('2024-01-01');
  jest.spyOn(Date, 'now').mockReturnValue(fixedDate.getTime());

  const property = new Property({
    purchaseDate: new Date('2020-01-01')
  });
  expect(property.age).toBe(4);
});
```

**The Lesson:** Control time in tests. Never depend on current date/time.

### Mistake 3: Testing Framework Instead of Logic

**What We Did:**
```typescript
it('should call Express res.json', () => {
  controller.getProperty(req, res);
  expect(res.json).toHaveBeenCalled();
});
```

**What We Should Have Done:**
```typescript
it('should return property data for valid request', () => {
  const response = controller.getProperty(validRequest);
  expect(response.data).toMatchObject({
    id: 'property-123',
    address: '123 Main St'
  });
});
```

**The Lesson:** Don't test that Express works. Test your logic.

## ✅ Testing Patterns That Worked

### Factory Functions for Test Data

**The Pattern:**
```typescript
// test/factories/property.factory.ts
export function createPropertyInput(overrides = {}): CreatePropertyInput {
  return {
    address: '123 Test St',
    city: 'Test City',
    state: 'TX',
    zipCode: '12345',
    purchasePrice: 250000,
    ...overrides
  };
}

export function createPropertyEntity(overrides = {}): Property {
  return new Property({
    id: 'prop-' + Math.random(),
    ...createPropertyInput(),
    userId: 'user-123',
    createdAt: new Date(),
    ...overrides
  });
}
```

**Usage:**
```typescript
it('should update property price', () => {
  const property = createPropertyEntity({ purchasePrice: 300000 });
  // Test with realistic data
});
```

**Why It Worked:**
- Realistic test data
- Easy to create variations
- Single source of truth for test objects
- Reduces test setup boilerplate

### Shared Test Utilities

**The Utilities:**
```typescript
// test/utils/auth.ts
export async function getAuthToken(user = defaultUser): Promise<string> {
  const response = await request(app)
    .post('/auth/login')
    .send({ email: user.email, password: user.password });
  return response.body.token;
}

// test/utils/database.ts
export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.property.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

// test/utils/expectations.ts
export function expectValidationError(response: Response): void {
  expect(response.status).toBe(400);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toContain('validation');
}
```

**Why It Worked:**
- Consistent test behavior
- DRY test code
- Easy to update test infrastructure
- Self-documenting test intentions

## 📈 Testing ROI Analysis

### High ROI Tests

1. **Use Case Tests** - 80% confidence for 20% effort
2. **Validation Tests** - Prevent bad data early
3. **Critical Path E2E** - User can complete core flows
4. **Error Handling Tests** - System fails gracefully

### Low ROI Tests

1. **Getter/Setter Tests** - TypeScript handles this
2. **Framework Tests** - Trust the framework
3. **Mock Tests** - Testing your mocks, not code
4. **UI Unit Tests** - Better to test integration

### The 80/20 Rule

**Focus 80% effort on:**
- Core business logic (use cases)
- Data validation
- Error paths
- Integration points

**Spend 20% on:**
- Edge cases
- Performance tests
- UI component tests
- Utility functions

## 🎯 TDD Lessons

### Where TDD Worked Well

**Use Cases:**
```bash
1. Write failing test for use case
2. Implement minimal code to pass
3. Refactor with confidence
```

**Why:** Clear inputs/outputs, pure functions

### Where TDD Was Painful

**UI Components:**
- Requirements changed frequently
- Visual testing more valuable
- Tests became obstacles to iteration

**Infrastructure:**
- Hard to test without implementation
- Mocking everything
- Tests mirror implementation

**The Lesson:** TDD for business logic, test-after for UI and infrastructure.

## 🔮 Testing Strategy for Next Project

### Day One Setup

```typescript
// 1. Integration test harness
class TestApp {
  async setup() { /* Create app with test DB */ }
  async teardown() { /* Clean up */ }
  async loginAs(user) { /* Get auth token */ }
  async resetDatabase() { /* Clear data */ }
}

// 2. Factory functions
createUser()
createProperty()
createMaintenance()

// 3. Custom matchers
expect.extend({
  toBeValidated(received) { /* Check validation */ },
  toRequireAuth(received) { /* Check auth */ }
});
```

### Testing Checklist

**For Every Feature:**
- [ ] Use case unit tests (happy + sad paths)
- [ ] Integration test (at least one)
- [ ] Validation tests
- [ ] Error handling tests
- [ ] Authorization tests

**For Every Bug:**
- [ ] Write failing test that reproduces bug
- [ ] Fix bug
- [ ] Test passes
- [ ] Add to regression suite

## 💡 Universal Testing Truths

1. **Tests are code** - They need maintenance too
2. **Fast tests get run** - Slow tests get skipped
3. **Flaky tests are worse than no tests** - They erode confidence
4. **Test names are documentation** - Be descriptive
5. **Test the contract, not the implementation** - Internals will change

## Final Assessment

Our testing strategy was **good but incomplete**:

- ✅ **100% use case coverage** - High confidence in business logic
- ✅ **Fast test execution** - Enabled TDD workflow
- ✅ **Clean test code** - Easy to maintain
- ❌ **Missing integration tests** - Caught bugs in production
- ❌ **No performance tests** - Discovered issues late
- ❌ **No visual regression tests** - UI bugs slipped through

**Overall Testing Score: 7/10**

The missing 3 points would come from:
- Integration tests (1.5 points)
- Performance tests (1 point)
- Visual tests (0.5 points)

---

> *"Legacy code is code without tests."* - Michael Feathers

Our test suite gave us confidence to refactor aggressively and add features quickly. The missing integration tests would have prevented several production issues. The lesson: **Unit tests verify you built it right. Integration tests verify you built the right thing.**