# 🛠️ Feature Implementation Template

> *Use this template when adding any new feature to ensure consistency with established patterns.*

## Feature: [FEATURE NAME]

**Description:** [Brief description of the feature]

**User Story:** As a [user type], I want to [action] so that [benefit]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---

## Implementation Checklist

### Phase 1: Planning & Design

#### 1.1 Domain Modeling
- [ ] Define entities in `core/entities/[Feature].ts`
- [ ] Identify relationships with existing entities
- [ ] Document business rules and invariants
- [ ] Define entity states/enums if needed

#### 1.2 Database Design
- [ ] Design database schema
- [ ] Plan indexes for common queries
- [ ] Consider soft delete requirements
- [ ] Document foreign key relationships

#### 1.3 API Design
- [ ] Define REST endpoints
- [ ] Document request/response formats
- [ ] Plan error responses
- [ ] Consider pagination needs

#### 1.4 Validation Planning
- [ ] List all validation rules
- [ ] Identify shared vs specific validation
- [ ] Plan conditional validation logic

---

### Phase 2: Backend Implementation

#### 2.1 Shared Libraries
```bash
# Location: libs/validators/src/[feature].ts
```
- [ ] Create Zod validation schemas
- [ ] Export TypeScript types from schemas
- [ ] Add to validators barrel export

**Template:**
```typescript
import { z } from 'zod';

export const create[Feature]Schema = z.object({
  // Required fields
  field1: z.string().min(1, 'Field1 is required'),
  field2: z.number().positive(),

  // Optional fields
  field3: z.string().optional(),

  // Nested objects
  nested: z.object({
    subField: z.string()
  }).optional()
});

export const update[Feature]Schema = create[Feature]Schema.partial();

export type Create[Feature]Input = z.infer<typeof create[Feature]Schema>;
export type Update[Feature]Input = z.infer<typeof update[Feature]Schema>;
```

#### 2.2 Domain Entities
```bash
# Location: apps/backend/src/core/entities/[Feature].ts
```
- [ ] Create entity class
- [ ] Add business methods
- [ ] Export from entities index

**Template:**
```typescript
export class [Feature] {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    // ... other fields
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  // Business methods
  isValid(): boolean {
    // Business logic
  }
}
```

#### 2.3 Repository Interface
```bash
# Location: apps/backend/src/domain/repositories/I[Feature]Repository.ts
```
- [ ] Define repository interface
- [ ] Include all CRUD operations
- [ ] Add custom query methods

**Template:**
```typescript
export interface I[Feature]Repository {
  create(data: Create[Feature]Data): Promise<[Feature]>;
  findById(id: string): Promise<[Feature] | null>;
  findByUserId(userId: string): Promise<[Feature][]>;
  update(id: string, data: Update[Feature]Data): Promise<[Feature]>;
  delete(id: string): Promise<void>;
  // Custom queries
}
```

#### 2.4 Use Cases
```bash
# Location: apps/backend/src/application/[feature]/
```
- [ ] Create[Feature]UseCase
- [ ] Get[Feature]ByIdUseCase
- [ ] List[Feature]sUseCase
- [ ] Update[Feature]UseCase
- [ ] Delete[Feature]UseCase

**Template:**
```typescript
@injectable()
export class Create[Feature]UseCase {
  constructor(
    @inject('I[Feature]Repository')
    private repository: I[Feature]Repository
  ) {}

  async execute(input: Create[Feature]Input): Promise<[Feature]> {
    // 1. Validate input
    const validation = create[Feature]Schema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError(validation.error.errors[0].message);
    }

    // 2. Check business rules
    // ... custom logic

    // 3. Create entity
    const created = await this.repository.create(validation.data);

    // 4. Return result
    return created;
  }
}
```

#### 2.5 Repository Implementation
```bash
# Location: apps/backend/src/infrastructure/repositories/Prisma[Feature]Repository.ts
```
- [ ] Implement repository interface
- [ ] Add Prisma queries
- [ ] Map to domain entities

**Template:**
```typescript
@injectable()
export class Prisma[Feature]Repository implements I[Feature]Repository {
  async create(data: Create[Feature]Data): Promise<[Feature]> {
    const created = await prisma.[feature].create({
      data: {
        userId: data.userId,
        // ... map fields
      }
    });

    return this.toDomainEntity(created);
  }

  private toDomainEntity(data: any): [Feature] {
    return new [Feature](
      data.id,
      data.userId,
      // ... map fields
      data.createdAt,
      data.updatedAt
    );
  }
}
```

#### 2.6 Controller
```bash
# Location: apps/backend/src/presentation/controllers/[Feature]Controller.ts
```
- [ ] Create controller class
- [ ] Add route handlers
- [ ] Handle errors properly

**Template:**
```typescript
@injectable()
export class [Feature]Controller {
  constructor(
    @inject(Create[Feature]UseCase) private createUseCase: Create[Feature]UseCase,
    @inject(Get[Feature]ByIdUseCase) private getByIdUseCase: Get[Feature]ByIdUseCase,
    // ... other use cases
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.createUseCase.execute({
        ...req.body,
        userId: req.user.id
      });
      res.status(201).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

#### 2.7 Routes
```bash
# Location: apps/backend/src/presentation/routes/[feature].routes.ts
```
- [ ] Define routes
- [ ] Apply authentication middleware
- [ ] Register with Express

**Template:**
```typescript
export function register[Feature]Routes(app: Application, container: Container): void {
  const controller = container.get([Feature]Controller);

  app.post('/api/[features]',
    authenticateToken,
    (req, res) => controller.create(req, res)
  );

  app.get('/api/[features]',
    authenticateToken,
    (req, res) => controller.list(req, res)
  );

  app.get('/api/[features]/:id',
    authenticateToken,
    (req, res) => controller.getById(req, res)
  );

  app.put('/api/[features]/:id',
    authenticateToken,
    (req, res) => controller.update(req, res)
  );

  app.delete('/api/[features]/:id',
    authenticateToken,
    (req, res) => controller.delete(req, res)
  );
}
```

#### 2.8 Dependency Injection
```bash
# Location: apps/backend/src/container.ts
```
- [ ] Register repository
- [ ] Register use cases
- [ ] Register controller

**Add to container:**
```typescript
// Repository
container.bind<I[Feature]Repository>('I[Feature]Repository')
  .to(Prisma[Feature]Repository)
  .inTransientScope();

// Use cases
container.bind(Create[Feature]UseCase).toSelf().inTransientScope();
container.bind(Get[Feature]ByIdUseCase).toSelf().inTransientScope();
container.bind(List[Feature]sUseCase).toSelf().inTransientScope();
container.bind(Update[Feature]UseCase).toSelf().inTransientScope();
container.bind(Delete[Feature]UseCase).toSelf().inTransientScope();

// Controller
container.bind([Feature]Controller).toSelf().inTransientScope();
```

#### 2.9 Database Migration
```bash
# Generate migration
npm run migrate:dev --name add_[feature]_table

# Copy to Flyway format
cp prisma/migrations/*/migration.sql apps/backend/migrations/V[X]__add_[feature].sql
```

---

### Phase 3: Frontend Implementation

#### 3.1 Store (Pinia)
```bash
# Location: apps/frontend/src/stores/[feature].ts
```
- [ ] Create Pinia store
- [ ] Add CRUD operations
- [ ] Handle loading/error states

**Template:**
```typescript
import { defineStore } from 'pinia';
import { ref, readonly } from 'vue';
import { api } from '@/api/client';
import { extractErrorMessage } from '@/utils/errorHandlers';

export const use[Feature]Store = defineStore('[feature]', () => {
  const items = ref<[Feature][]>([]);
  const currentItem = ref<[Feature] | null>(null);
  const loading = ref(false);
  const error = ref('');

  async function create(data: Create[Feature]Data) {
    loading.value = true;
    error.value = '';
    try {
      const response = await api.post('/[features]', data);
      items.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = extractErrorMessage(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAll() {
    loading.value = true;
    error.value = '';
    try {
      const response = await api.get('/[features]');
      items.value = response.data;
    } catch (err) {
      error.value = extractErrorMessage(err);
    } finally {
      loading.value = false;
    }
  }

  return {
    items: readonly(items),
    currentItem: readonly(currentItem),
    loading: readonly(loading),
    error: readonly(error),
    create,
    fetchAll,
    // ... other methods
  };
});
```

#### 3.2 Form Component
```bash
# Location: apps/frontend/src/views/[Feature]FormView.vue
```
- [ ] Create form component
- [ ] Use VeeValidate with shared schema
- [ ] Handle submission

**Template:**
```vue
<template>
  <div class="form-container">
    <h1>{{ isEdit ? 'Edit' : 'Create' }} [Feature]</h1>

    <Form @submit="onSubmit" :validation-schema="validationSchema">
      <FormInput
        name="field1"
        label="Field 1"
        placeholder="Enter field 1"
      />

      <FormInput
        name="field2"
        label="Field 2"
        type="number"
      />

      <div v-if="submitError" class="error-message">
        {{ submitError }}
      </div>

      <div class="form-actions">
        <button type="button" @click="cancel">Cancel</button>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </Form>
  </div>
</template>

<script setup lang="ts">
import { Form } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { create[Feature]Schema } from '@validators/[feature]';
import { use[Feature]Store } from '@/stores/[feature]';
import { useFormSubmission } from '@/composables/useFormSubmission';
import FormInput from '@/components/FormInput.vue';

const store = use[Feature]Store();
const validationSchema = toTypedSchema(create[Feature]Schema);

const { submitError, isSubmitting, submit } = useFormSubmission(
  async (data) => {
    await store.create(data);
  },
  {
    successMessage: '[Feature] created successfully',
    redirectTo: '/[features]'
  }
);

const cancel = () => {
  router.push('/[features]');
};
</script>
```

#### 3.3 List Component
```bash
# Location: apps/frontend/src/views/[Feature]ListView.vue
```
- [ ] Create list view
- [ ] Add loading/error states
- [ ] Implement actions

**Template:**
```vue
<template>
  <div class="list-container">
    <header class="list-header">
      <h1>[Features]</h1>
      <router-link to="/[features]/add" class="btn-primary">
        Add [Feature]
      </router-link>
    </header>

    <div v-if="loading" class="loading">Loading...</div>

    <div v-else-if="error" class="error">
      {{ error }}
      <button @click="retry">Retry</button>
    </div>

    <div v-else-if="items.length === 0" class="empty">
      <p>No [features] yet</p>
      <router-link to="/[features]/add">Add your first [feature]</router-link>
    </div>

    <div v-else class="list">
      <[Feature]Card
        v-for="item in items"
        :key="item.id"
        :[feature]="item"
        @click="viewDetails(item.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { use[Feature]Store } from '@/stores/[feature]';
import [Feature]Card from '@/components/[Feature]Card.vue';

const store = use[Feature]Store();
const router = useRouter();

const { items, loading, error } = storeToRefs(store);

onMounted(() => {
  store.fetchAll();
});

const retry = () => store.fetchAll();

const viewDetails = (id: string) => {
  router.push(`/[features]/${id}`);
};
</script>
```

#### 3.4 Routes
```bash
# Location: apps/frontend/src/router/index.ts
```
- [ ] Add routes to router

**Add routes:**
```typescript
{
  path: '/[features]',
  name: '[features]',
  component: () => import('@/views/[Feature]ListView.vue'),
  meta: { requiresAuth: true }
},
{
  path: '/[features]/add',
  name: 'add-[feature]',
  component: () => import('@/views/[Feature]FormView.vue'),
  meta: { requiresAuth: true }
},
{
  path: '/[features]/:id',
  name: '[feature]-detail',
  component: () => import('@/views/[Feature]DetailView.vue'),
  meta: { requiresAuth: true }
},
{
  path: '/[features]/:id/edit',
  name: 'edit-[feature]',
  component: () => import('@/views/[Feature]FormView.vue'),
  meta: { requiresAuth: true }
}
```

---

### Phase 4: Testing

#### 4.1 Backend Unit Tests
```bash
# Location: apps/backend/src/application/[feature]/tests/
```
- [ ] Test each use case
- [ ] Test validation
- [ ] Test error cases

**Template:**
```typescript
describe('Create[Feature]UseCase', () => {
  let useCase: Create[Feature]UseCase;
  let mockRepo: jest.Mocked<I[Feature]Repository>;

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      // ... other methods
    };
    useCase = new Create[Feature]UseCase(mockRepo);
  });

  describe('execute', () => {
    it('should create [feature] with valid input', async () => {
      const input = valid[Feature]Input();
      const expected = [feature]Entity(input);
      mockRepo.create.mockResolvedValue(expected);

      const result = await useCase.execute(input);

      expect(result).toEqual(expected);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    it('should throw ValidationError for invalid input', async () => {
      const input = { ...validInput, field1: '' };

      await expect(useCase.execute(input))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

#### 4.2 Integration Tests
```bash
# Location: apps/backend/tests/integration/[feature].test.ts
```
- [ ] Test API endpoints
- [ ] Test with real database
- [ ] Test authentication

**Template:**
```typescript
describe('[Feature] API Integration', () => {
  let token: string;

  beforeAll(async () => {
    await resetDatabase();
    token = await getAuthToken();
  });

  describe('POST /api/[features]', () => {
    it('should create [feature]', async () => {
      const response = await request(app)
        .post('/api/[features]')
        .set('Authorization', `Bearer ${token}`)
        .send(valid[Feature]Data());

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        // ... other fields
      });
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/[features]')
        .set('Authorization', `Bearer ${token}`)
        .send({ /* invalid data */ });

      expect(response.status).toBe(400);
    });
  });
});
```

#### 4.3 Frontend Tests
```bash
# Location: apps/frontend/src/views/__tests__/[Feature]FormView.test.ts
```
- [ ] Test form validation
- [ ] Test submission
- [ ] Test error handling

---

### Phase 5: Documentation

#### 5.1 API Documentation
- [ ] Document endpoints in README
- [ ] Add example requests/responses
- [ ] Document error codes

#### 5.2 User Documentation
- [ ] Create user guide
- [ ] Add screenshots
- [ ] Document workflows

#### 5.3 Code Documentation
- [ ] Add JSDoc comments
- [ ] Document complex logic
- [ ] Update architecture diagrams

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Database migrations tested
- [ ] Environment variables documented

### Deployment
- [ ] Run database migrations
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Verify health checks

### Post-Deployment
- [ ] Test in production
- [ ] Monitor for errors
- [ ] Check performance
- [ ] Update status page

---

## Common Pitfalls to Avoid

1. **Forgetting shared validation** - Always create Zod schemas first
2. **Missing dependency injection** - Register all classes in container
3. **Incomplete error handling** - Handle all error types in controller
4. **No loading states** - Always show loading in UI
5. **Missing tests** - Write tests as you code
6. **Hard-coded values** - Use environment variables
7. **No pagination** - Add from the start for lists
8. **Ignoring soft deletes** - Plan for data retention
9. **Missing indexes** - Add for foreign keys and queries
10. **No transaction management** - Use for multi-step operations

---

## Time Estimates

Based on existing features:

| Phase | Estimated Time |
|-------|---------------|
| Planning & Design | 2-4 hours |
| Backend Implementation | 4-8 hours |
| Frontend Implementation | 4-6 hours |
| Testing | 2-4 hours |
| Documentation | 1-2 hours |
| **Total** | **13-24 hours** |

---

## Definition of Done

- [ ] All code written and reviewed
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Documentation complete
- [ ] Deployed to production
- [ ] Monitored for 24 hours
- [ ] No critical bugs

---

*Use this template as a starting point and adapt based on feature complexity. The key is maintaining consistency with existing patterns.*