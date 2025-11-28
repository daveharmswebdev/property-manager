# 💻 Development Workflow Lessons

> *"A good development workflow is invisible when it works and painful when it doesn't."*

## Executive Summary

The development workflow evolved from chaos to clarity over the project lifecycle. This document captures what worked, what didn't, and the "aha!" moments that transformed our productivity.

## 🎯 Core Workflow Principles That Emerged

### "Use What's in the Pantry"

**The Revelation:**
Stop writing new code when existing utilities exist.

**The Practice:**
```typescript
// ❌ WRONG: Writing new formatting
const formatMoney = (val: number) => `$${val.toFixed(2)}`;

// ✅ RIGHT: Using existing utility
import { formatPrice } from '@/utils/formatters';
```

**The Impact:**
- **50% less code** written
- **100% consistency** in formatting
- **Zero duplication** bugs
- **Faster development** once learned

**The Lesson:**
Before implementing ANY feature:
1. Check `apps/frontend/src/utils/`
2. Check shared libraries
3. Search for similar patterns
4. Only create new if nothing exists

This principle alone saved dozens of hours.

### TypeScript Configuration Mastery

**The Journey:**
Week 1: "Why won't the frontend see the shared libraries?"
Week 2: "Why are there .js files in my TypeScript project?"
Week 3: "OH! That's how module systems work!"

**The Working Configuration:**

```json
// Shared library pattern that works
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",     // For optimal bundling
    "target": "ES2020",     // For Node compatibility
    "declaration": true,     // Generate .d.ts files
    "outDir": "./dist"
  },
  // DO NOT add "type": "module" to package.json!
}
```

**The Critical Insights:**
1. **Both apps import TypeScript source** - Not compiled JavaScript
2. **ts-node-dev handles backend** - Compiles on the fly
3. **Vite handles frontend** - Bundles TypeScript directly
4. **Never mix module systems** - Pick one approach

**The Lesson:**
Document your module strategy in detail. Future you will thank present you.

## 📝 Code Organization Patterns

### Feature-First Structure

**What Worked:**
Organizing by feature, not by file type:

```
application/
├── property/
│   ├── CreatePropertyUseCase.ts
│   ├── UpdatePropertyUseCase.ts
│   ├── DeletePropertyUseCase.ts
│   └── tests/
├── maintenance/
│   ├── CreateMaintenanceWorkUseCase.ts
│   └── tests/
```

**Why It Worked:**
- All related code in one place
- Easy to find feature logic
- Clear ownership boundaries
- Simple to delete features

### Consistent Naming Conventions

**What Emerged:**
- **Use Cases:** `{Verb}{Entity}UseCase`
- **Repositories:** `{Technology}{Entity}Repository`
- **Controllers:** `{Entity}Controller`
- **Tests:** Same name with `.test.ts`

**The Impact:**
New developers could guess file names correctly 90% of the time.

## 🔄 Git Workflow Evolution

### What Failed: Feature Branches for Everything

**The Problem:**
- Long-lived branches diverged
- Merge conflicts multiplied
- Reviews took forever

### What Worked: Trunk-Based Development

**The Approach:**
```bash
# Work directly on main for small changes
git add .
git commit -m "fix: Update property validation"
git push

# Short-lived branches for features (< 1 day)
git checkout -b add-lease-entity
# ... work ...
git push
# Merge immediately
```

**The Benefits:**
- Conflicts rare
- Continuous integration
- Faster feedback
- Simpler mental model

**The Lesson:**
Keep branches short-lived. If it takes more than a day, break it down.

## 🧪 Testing Workflow

### Unit Testing Pattern That Worked

**The Formula:**
```typescript
describe('CreatePropertyUseCase', () => {
  let useCase: CreatePropertyUseCase;
  let mockRepo: jest.Mocked<IPropertyRepository>;

  beforeEach(() => {
    // Setup mocks
    mockRepo = { create: jest.fn(), /* ... */ };
    useCase = new CreatePropertyUseCase(mockRepo);
  });

  describe('execute', () => {
    it('should create property with valid input', async () => {
      // Arrange
      const input = validPropertyInput();
      const expected = propertyEntity(input);
      mockRepo.create.mockResolvedValue(expected);

      // Act
      const result = await useCase.execute(input);

      // Assert
      expect(result).toEqual(expected);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    it('should throw ValidationError with invalid input', async () => {
      // Test the unhappy path
    });
  });
});
```

**Why This Pattern:**
- Consistent structure
- Clear AAA pattern
- Isolated tests
- Fast execution

### What We Missed: Integration Tests

**The Gap:**
```typescript
// We had this (unit test)
const mockRepo = { create: jest.fn() };

// We needed this (integration test)
const response = await request(app)
  .post('/api/properties')
  .send(data);
```

**The Cost:**
- Module issues in production
- API contract mismatches
- Middleware bugs

**The Lesson:**
Unit tests verify logic. Integration tests verify the system works.

## 🚀 Local Development Setup

### What Worked: npm Workspaces

**The Setup:**
```json
{
  "workspaces": [
    "apps/*",
    "libs/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "npm run dev --workspace=@upkeep-io/backend",
    "dev:frontend": "npm run dev --workspace=@upkeep-io/frontend"
  }
}
```

**The Benefits:**
- Single `npm install`
- Shared dependencies
- Atomic commits
- Simplified CI/CD

### What Worked: Environment Variables

**The Pattern:**
```bash
# .env.example (committed)
DATABASE_URL=postgresql://user:pass@localhost:5432/upkeep
JWT_SECRET=your-secret-here

# .env (gitignored)
DATABASE_URL=postgresql://actual:values@localhost:5432/upkeep
JWT_SECRET=actual-secret-key
```

**The Discipline:**
1. Never commit .env
2. Always update .env.example
3. Document each variable
4. Validate at startup

## 🔧 Development Tools That Mattered

### Essential VS Code Extensions

**Game Changers:**
- **Prisma:** Syntax highlighting and formatting
- **ESLint:** Catch issues while typing
- **Prettier:** Never argue about formatting
- **Thunder Client:** API testing in VS Code
- **GitLens:** Understand code history

### npm Scripts That Saved Time

```json
{
  "scripts": {
    // Development
    "dev": "Start everything",
    "dev:backend": "Backend only",
    "dev:frontend": "Frontend only",

    // Database
    "migrate:dev": "Create migration",
    "migrate:deploy": "Apply migrations",
    "studio": "Prisma Studio GUI",

    // Testing
    "test": "Run all tests",
    "test:watch": "TDD mode",
    "test:coverage": "Coverage report",

    // Utilities
    "clean": "Remove all build artifacts",
    "typecheck": "Check types across monorepo",
    "lint:fix": "Auto-fix all issues"
  }
}
```

## 📊 Productivity Metrics

### What Improved

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Feature delivery | 1 week | 2-3 days | -60% |
| Bug rate | 5-10/week | 1-2/week | -80% |
| Test writing time | 2 hours | 30 min | -75% |
| PR review time | 1 day | 2 hours | -75% |
| Onboarding time | 1 week | 3 days | -60% |

### What Enabled the Improvements

1. **Consistent patterns** - Less thinking, more doing
2. **Shared utilities** - Stop reinventing wheels
3. **Type safety** - Catch errors at compile time
4. **Good tests** - Confident refactoring
5. **Clear structure** - Know where everything goes

## 🔴 Workflow Mistakes

### 1. Not Documenting Decisions Immediately

**The Mistake:**
"I'll remember why we did this"

**The Reality:**
Two weeks later: "Why did we configure it this way?"

**The Fix:**
```typescript
// Document WHY, not WHAT
// We use CommonJS for backend because ts-node-dev doesn't
// handle ES modules well in development
"module": "commonjs"
```

### 2. Over-Engineering the Build Process

**The Mistake:**
Complex webpack configs, multiple build tools

**The Fix:**
- Backend: Simple tsc compilation
- Frontend: Vite defaults
- Libraries: Minimal configuration

**The Lesson:**
Start with tool defaults. Customize only when needed.

### 3. Ignoring Developer Experience

**Initially:**
- 5 terminals to run everything
- Manual database setup
- No seed data

**Eventually:**
```bash
npm run dev        # Everything starts
npm run seed       # Sample data loaded
npm run test       # All tests run
```

**The Lesson:**
Optimize for developer happiness. Happy developers write better code.

## ✅ Daily Workflow That Emerged

### Morning Routine

```bash
# 1. Pull latest changes
git pull

# 2. Install any new dependencies
npm install

# 3. Run migrations
npm run migrate:dev

# 4. Start development
npm run dev

# 5. Run tests in watch mode
npm run test:watch
```

### Feature Development Flow

```bash
# 1. Create use case with test
touch src/application/feature/UseCase.ts
touch src/application/feature/UseCase.test.ts

# 2. TDD the use case
npm run test:watch

# 3. Create controller
touch src/presentation/controllers/Controller.ts

# 4. Test full flow
curl http://localhost:3000/api/endpoint

# 5. Commit with conventional message
git add .
git commit -m "feat: Add feature description"
```

### End of Day

```bash
# 1. Run all tests
npm test

# 2. Check types
npm run typecheck

# 3. Fix any linting issues
npm run lint:fix

# 4. Commit work
git add .
git commit -m "wip: Description of progress"
git push
```

## 🎯 Key Workflow Insights

### On Productivity

1. **Consistency beats optimization** - Similar patterns are faster than optimal ones
2. **Automation compounds** - Every script saves future time
3. **Fast feedback loops matter** - Hot reload, instant tests
4. **Reduce context switching** - One command to rule them all

### On Quality

1. **Types are documentation** - They never get out of date
2. **Tests are confidence** - Refactor without fear
3. **Linting is consistency** - No style arguments
4. **Reviews are learning** - Both ways

### On Sustainability

1. **Document immediately** - Memory fades quickly
2. **Automate repeatedly** - If you do it twice, script it
3. **Simplify complexity** - Complex systems have complex failures
4. **Measure everything** - You can't improve what you don't measure

## 🔮 Workflow Improvements for Next Time

### Day One Setup

1. **CI/CD from start** - Not "when we need it"
2. **Integration tests immediately** - Catch real issues
3. **Error tracking service** - Know about issues before users
4. **Performance monitoring** - Baseline from beginning
5. **Documentation templates** - Consistent from start

### Development Process

1. **Pair programming for complex features** - Two heads, fewer bugs
2. **Code review checklist** - Consistent quality
3. **Architecture Decision Records** - Document the why
4. **Weekly tech debt time** - Prevent accumulation
5. **Automated dependency updates** - Stay current

## Final Thoughts

> *"The best workflow is one you don't notice. It should feel like the tools are reading your mind."*

Our workflow evolved from friction to flow. The key was:
1. **Recognize repeated pain** - If it hurts twice, fix it
2. **Automate everything possible** - Humans for thinking, computers for doing
3. **Document along the way** - Future you is your most important user
4. **Optimize for the common case** - Make the right thing easy

The workflow lessons learned on Upkeep.io will make the next project start at 60mph instead of 0.

**Remember:** A great workflow isn't about tools - it's about removing friction so developers can focus on solving problems.