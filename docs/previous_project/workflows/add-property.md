# 🏠 Property Management Workflow (Complete Implementation Guide)

> *This consolidated workflow demonstrates the full stack implementation of property CRUD operations, serving as a reference pattern for all features.*

## Overview

The property management feature implements Clean Architecture patterns across the full stack, demonstrating:
- Domain-driven design with clear separation of concerns
- Shared validation between frontend and backend
- Comprehensive error handling
- User-centric workflow design

This workflow serves as the **reference implementation** for all other features in the system.

---

## User Journey

### 1. Authentication Flow

**Entry Point:** User lands on login page

**User Actions:**
1. Enter email and password
2. Click "Login" or "Sign Up"

**System Response:**
```typescript
// Backend endpoint
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "Property Owner"
}

// Response
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Property Owner"
  },
  "token": "JWT_TOKEN"
}
```

**Frontend Storage:**
- JWT stored in localStorage
- User info stored in auth store (Pinia)
- Axios interceptor configured with Bearer token

### 2. Navigate to Add Property

**Trigger:** User clicks "Add Property" button

**Navigation:** Router pushes to `/properties/add`

**Form Display:**
- Clean form with no error messages
- Submit button disabled initially
- All required field indicators visible

### 3. Property Form Interaction

**Form Fields:**
```typescript
// Shared validation schema from @validators/property
{
  address: string;      // Required, min 1 char
  address2?: string;    // Optional
  city: string;         // Required, min 1 char
  state: string;        // Required, min 1 char
  zipCode: string;      // Required, 5+ chars
}
```

**Validation Behavior:**
- Fields validate on blur (first interaction)
- Real-time validation after first blur
- Error messages appear below invalid fields
- Submit button enables only when form is valid

**User Experience:**
- No errors shown on initial load
- Clear, immediate feedback on validation
- Errors disappear when corrected
- Loading state during submission

### 4. Submit Property (Success Path)

**User Action:** Click "Create" with valid data

**Frontend Processing:**
```typescript
// useFormSubmission composable handles submission
const { submitError, isSubmitting, submit } = useFormSubmission(
  async (data: CreatePropertyInput) => {
    await propertyStore.createProperty(convertedData);
  },
  {
    successMessage: 'Property created successfully',
    redirectTo: '/properties'
  }
);
```

**API Request:**
```http
POST /api/properties
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "address": "123 Main Street",
  "city": "Springfield",
  "state": "IL",
  "zipCode": "62701"
}
```

**Backend Processing:**
```typescript
// CreatePropertyUseCase flow
1. Validate input with shared schema
2. Check for duplicate addresses (business rule)
3. Create property via repository
4. Return created property entity
```

**Success Response:**
```json
HTTP 201 Created
{
  "id": "property-uuid",
  "userId": "user-uuid",
  "address": "123 Main Street",
  "city": "Springfield",
  "state": "IL",
  "zipCode": "62701",
  "createdAt": "2025-11-19T17:07:53.168Z",
  "updatedAt": "2025-11-19T17:07:53.168Z"
}
```

**User Feedback:**
- Success toast: "Property created successfully"
- Automatic redirect to `/properties` list
- New property appears in list

### 5. Property List View

**Display Format:**
- Mobile-first card layout
- Each card shows full address
- Vacancy status badge (if applicable)
- Clickable for details

**List Management:**
- Properties sorted by creation date
- Loading state while fetching
- Empty state for no properties
- Error state with retry option

### 6. Error Handling

**Validation Errors (400):**
```json
{
  "error": "Validation failed",
  "details": {
    "zipCode": "Zip code must be at least 5 characters"
  }
}
```
- Form remains with user data
- Specific field errors highlighted
- User can correct and resubmit

**Duplicate Property (409):**
```json
{
  "error": "Property at this address already exists for this user"
}
```
- Error banner at form top
- Form data preserved
- User can modify address

**Server Errors (500):**
- Generic error message to user
- Detailed error logged to console
- Retry option provided

---

## Implementation Architecture

### Backend Layers

#### 1. Domain Layer
```typescript
// core/entities/Property.ts
export class Property {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly address: string,
    public readonly city: string,
    public readonly state: string,
    public readonly zipCode: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
```

#### 2. Application Layer
```typescript
// application/property/CreatePropertyUseCase.ts
@injectable()
export class CreatePropertyUseCase {
  constructor(
    @inject('IPropertyRepository')
    private propertyRepository: IPropertyRepository
  ) {}

  async execute(input: CreatePropertyInput): Promise<Property> {
    // 1. Validate with shared schema
    const validation = createPropertySchema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError(validation.error.errors[0].message);
    }

    // 2. Check business rules
    const existing = await this.propertyRepository.findByAddress(
      input.userId,
      input.address
    );
    if (existing) {
      throw new ConflictError('Property already exists');
    }

    // 3. Create and return
    return this.propertyRepository.create(validation.data);
  }
}
```

#### 3. Infrastructure Layer
```typescript
// infrastructure/repositories/PrismaPropertyRepository.ts
@injectable()
export class PrismaPropertyRepository implements IPropertyRepository {
  async create(data: CreatePropertyData): Promise<Property> {
    const created = await prisma.property.create({
      data: {
        userId: data.userId,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode
      }
    });

    return new Property(
      created.id,
      created.userId,
      created.address,
      created.city,
      created.state,
      created.zipCode,
      created.createdAt,
      created.updatedAt
    );
  }
}
```

#### 4. Presentation Layer
```typescript
// presentation/controllers/PropertyController.ts
@injectable()
export class PropertyController {
  constructor(
    @inject(CreatePropertyUseCase)
    private createPropertyUseCase: CreatePropertyUseCase
  ) {}

  async createProperty(req: Request, res: Response): Promise<void> {
    try {
      const property = await this.createPropertyUseCase.execute({
        ...req.body,
        userId: req.user.id
      });
      res.status(201).json(property);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof ConflictError) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}
```

### Frontend Implementation

#### 1. Store (Pinia)
```typescript
// stores/property.ts
export const usePropertyStore = defineStore('property', () => {
  const properties = ref<Property[]>([]);
  const loading = ref(false);
  const error = ref('');

  async function createProperty(data: CreatePropertyData) {
    loading.value = true;
    error.value = '';
    try {
      const response = await api.post('/properties', data);
      properties.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = extractErrorMessage(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    properties: readonly(properties),
    loading: readonly(loading),
    error: readonly(error),
    createProperty
  };
});
```

#### 2. Form Component
```vue
<!-- PropertyFormView.vue -->
<template>
  <Form @submit="onSubmit" :validation-schema="validationSchema">
    <FormInput
      name="address"
      label="Street Address"
      placeholder="123 Main Street"
    />

    <FormInput
      name="city"
      label="City"
      placeholder="Springfield"
    />

    <FormInput
      name="state"
      label="State"
      placeholder="IL"
    />

    <FormInput
      name="zipCode"
      label="Zip Code"
      placeholder="62701"
    />

    <button
      type="submit"
      :disabled="!meta.valid || isSubmitting"
      class="btn-primary"
    >
      {{ isSubmitting ? 'Creating...' : 'Create Property' }}
    </button>
  </Form>
</template>

<script setup lang="ts">
import { createPropertySchema } from '@validators/property';
import { useFormSubmission } from '@/composables/useFormSubmission';
import { usePropertyStore } from '@/stores/property';

const validationSchema = toTypedSchema(createPropertySchema);
const propertyStore = usePropertyStore();

const { submitError, isSubmitting, submit } = useFormSubmission(
  async (data) => {
    await propertyStore.createProperty(data);
  },
  {
    successMessage: 'Property created successfully',
    redirectTo: '/properties'
  }
);
</script>
```

### Shared Validation
```typescript
// libs/validators/src/property.ts
import { z } from 'zod';

export const createPropertySchema = z.object({
  address: z.string().min(1, 'Address is required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(5, 'Zip code must be at least 5 characters')
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
```

---

## Testing Coverage

### Unit Tests (Backend)
```typescript
describe('CreatePropertyUseCase', () => {
  let useCase: CreatePropertyUseCase;
  let mockRepo: jest.Mocked<IPropertyRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    useCase = new CreatePropertyUseCase(mockRepo);
  });

  it('should create property with valid input', async () => {
    const input = validPropertyInput();
    const expected = propertyEntity(input);
    mockRepo.create.mockResolvedValue(expected);

    const result = await useCase.execute(input);

    expect(result).toEqual(expected);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it('should throw ValidationError for invalid input', async () => {
    const input = { ...validInput, zipCode: '123' }; // Too short

    await expect(useCase.execute(input))
      .rejects.toThrow(ValidationError);
  });

  it('should throw ConflictError for duplicate address', async () => {
    mockRepo.findByAddress.mockResolvedValue(existingProperty);

    await expect(useCase.execute(validInput))
      .rejects.toThrow(ConflictError);
  });
});
```

### Integration Tests
```typescript
describe('Property API Integration', () => {
  it('should create property through full stack', async () => {
    const token = await getAuthToken();

    const response = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        address: '456 Test Ave',
        city: 'Test City',
        state: 'TX',
        zipCode: '78701'
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      address: '456 Test Ave'
    });
  });
});
```

### E2E Test Results

| Test Scenario | Status | Notes |
|--------------|--------|-------|
| User signup | ✅ PASS | JWT token generated |
| Property creation (valid) | ✅ PASS | 201 response, property created |
| Property creation (invalid) | ✅ PASS | 400 response, validation errors |
| Duplicate address check | ✅ PASS | 409 response |
| Property list | ✅ PASS | Returns user's properties |
| Property details | ✅ PASS | Shows full property info |
| Property update | ✅ PASS | Updates successfully |
| Property deletion | ✅ PASS | Soft delete implemented |

---

## Common Issues & Solutions

### Issue: Form Validation Not Working
**Cause:** VeeValidate not configured with Zod adapter
**Solution:** Install and configure `@vee-validate/zod`

### Issue: CORS Errors
**Cause:** Backend not configured for frontend URL
**Solution:** Set `CORS_ORIGIN` environment variable

### Issue: JWT Not Sent
**Cause:** Axios interceptor not configured
**Solution:** Setup interceptor in `api/client.ts`

### Issue: TypeScript Path Errors
**Cause:** Vite not configured for monorepo aliases
**Solution:** Add aliases to `vite.config.ts`

---

## Lessons Learned

1. **Shared Validation is Critical** - Having one source of truth for validation prevents frontend/backend mismatches

2. **Clean Architecture Pays Off** - Adding new property features takes hours, not days

3. **User Experience Matters** - Show errors only after interaction, provide clear feedback

4. **Test the Full Stack** - Unit tests catch logic errors, integration tests catch contract issues

5. **Document the Why** - This workflow serves as the pattern for all features

---

## Using This as a Template

To implement a new feature (e.g., Maintenance Work), follow this pattern:

1. **Define the entity** in `core/entities/`
2. **Create validation schema** in `libs/validators/`
3. **Implement use cases** in `application/`
4. **Add repository** in `infrastructure/`
5. **Create controller** in `presentation/`
6. **Build frontend form** using same patterns
7. **Add to store** following property store pattern
8. **Write tests** at each layer

The consistency of patterns makes new features mechanical to implement.

---

*This workflow represents the gold standard for feature implementation in the Upkeep.io system. When in doubt, refer to the property implementation as the reference.*