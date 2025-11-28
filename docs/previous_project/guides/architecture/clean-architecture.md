# 🏗️ Clean Architecture Guide

> *"The goal of software architecture is to minimize the human resources required to build and maintain the required system."* - Robert C. Martin

## Overview

Upkeep.io implements Clean Architecture with Domain-Driven Design (DDD) principles, creating clear boundaries between business logic and technical implementation details. This architecture enables us to add features in 2-3 days instead of weeks.

**Architecture Health Score: 8.8/10** (November 2024 Assessment)

## Architecture Layers

```
┌─────────────────────────────────────┐
│      Presentation Layer             │  ← HTTP, Controllers, Routes
├─────────────────────────────────────┤
│      Application Layer              │  ← Use Cases (Business Logic)
├─────────────────────────────────────┤
│      Domain Layer                   │  ← Interfaces, Contracts
├─────────────────────────────────────┤
│      Core Layer                     │  ← Entities, Business Rules
├─────────────────────────────────────┤
│      Infrastructure Layer           │  ← Database, External Services
└─────────────────────────────────────┘
```

### Dependency Rule

**The Fundamental Rule:** Dependencies only point inward. Inner layers know nothing about outer layers.

```
✅ Allowed:
- Presentation → Application
- Application → Domain → Core
- Infrastructure → Domain → Core

❌ Forbidden:
- Core → ANY other layer
- Domain → Infrastructure
- Application → Presentation
```

## Layer Responsibilities

### 1. Core Layer
**Location:** `apps/backend/src/core/`

**Purpose:** Pure domain models with zero external dependencies

**Contains:**
- Entity classes
- Value objects
- Domain errors
- Business invariants

**Example:**
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
  ) {
    // Business invariants enforced in constructor
    if (!this.isValidZipCode(zipCode)) {
      throw new InvalidZipCodeError(zipCode);
    }
  }

  private isValidZipCode(zip: string): boolean {
    return /^\d{5}(-\d{4})?$/.test(zip);
  }

  // Business methods
  getFullAddress(): string {
    return `${this.address}, ${this.city}, ${this.state} ${this.zipCode}`;
  }
}
```

### 2. Domain Layer
**Location:** `apps/backend/src/domain/`

**Purpose:** Define contracts that connect business logic to infrastructure

**Contains:**
- Repository interfaces
- Service interfaces
- Domain events (future)

**Example:**
```typescript
// domain/repositories/IPropertyRepository.ts
export interface IPropertyRepository {
  create(data: CreatePropertyData): Promise<Property>;
  findById(id: string): Promise<Property | null>;
  findByUserId(userId: string): Promise<Property[]>;
  update(id: string, data: UpdatePropertyData): Promise<Property>;
  delete(id: string): Promise<void>;
}

// domain/services/IPasswordHasher.ts
export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}
```

### 3. Application Layer
**Location:** `apps/backend/src/application/`

**Purpose:** Orchestrate business logic without knowing implementation details

**Contains:**
- Use cases
- Application services
- DTOs (Data Transfer Objects)

**Example:**
```typescript
// application/property/CreatePropertyUseCase.ts
@injectable()
export class CreatePropertyUseCase {
  constructor(
    @inject('IPropertyRepository')
    private propertyRepository: IPropertyRepository,
    @inject('IEventBus')
    private eventBus: IEventBus
  ) {}

  async execute(input: CreatePropertyInput): Promise<Property> {
    // 1. Validate input (using shared validators)
    const validation = createPropertySchema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError(validation.error.errors[0].message);
    }

    // 2. Apply business rules
    const existing = await this.propertyRepository.findByAddress(
      input.userId,
      input.address
    );
    if (existing) {
      throw new ConflictError('Property at this address already exists');
    }

    // 3. Create entity via repository
    const property = await this.propertyRepository.create({
      ...validation.data,
      userId: input.userId
    });

    // 4. Publish domain event
    await this.eventBus.publish({
      type: 'PropertyCreated',
      payload: property
    });

    // 5. Return result
    return property;
  }
}
```

### 4. Infrastructure Layer
**Location:** `apps/backend/src/infrastructure/`

**Purpose:** Implement technical details

**Contains:**
- Repository implementations
- Service implementations
- Third-party integrations
- Database clients

**Example:**
```typescript
// infrastructure/repositories/PrismaPropertyRepository.ts
@injectable()
export class PrismaPropertyRepository implements IPropertyRepository {
  async create(data: CreatePropertyData): Promise<Property> {
    // Technical implementation using Prisma
    const created = await prisma.property.create({
      data: {
        userId: data.userId,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode
      }
    });

    // Map database model to domain entity
    return this.toDomainEntity(created);
  }

  private toDomainEntity(dbModel: any): Property {
    return new Property(
      dbModel.id,
      dbModel.userId,
      dbModel.address,
      dbModel.city,
      dbModel.state,
      dbModel.zipCode,
      dbModel.createdAt,
      dbModel.updatedAt
    );
  }
}
```

### 5. Presentation Layer
**Location:** `apps/backend/src/presentation/`

**Purpose:** Handle HTTP concerns and user interaction

**Contains:**
- Controllers
- Middleware
- Routes
- Request/Response mapping

**Example:**
```typescript
// presentation/controllers/PropertyController.ts
@injectable()
export class PropertyController {
  constructor(
    @inject(CreatePropertyUseCase) private createUseCase: CreatePropertyUseCase,
    @inject(GetPropertyByIdUseCase) private getByIdUseCase: GetPropertyByIdUseCase
  ) {}

  async createProperty(req: Request, res: Response): Promise<void> {
    try {
      const property = await this.createUseCase.execute({
        ...req.body,
        userId: req.user.id  // From auth middleware
      });

      res.status(201).json(property);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: unknown, res: Response): void {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
    } else {
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

## Dependency Injection with Inversify

### Why Dependency Injection?

1. **Testability:** Easy to inject mocks
2. **Flexibility:** Swap implementations without changing business logic
3. **Clear Dependencies:** Explicit about what each class needs
4. **No Circular Dependencies:** Container enforces acyclic graph

### Container Configuration
```typescript
// container.ts
import { Container } from 'inversify';
import 'reflect-metadata';

function createContainer(): Container {
  const container = new Container();

  // Bind repositories
  container.bind<IPropertyRepository>('IPropertyRepository')
    .to(PrismaPropertyRepository)
    .inTransientScope();

  container.bind<IUserRepository>('IUserRepository')
    .to(PrismaUserRepository)
    .inTransientScope();

  // Bind services
  container.bind<IPasswordHasher>('IPasswordHasher')
    .to(BcryptPasswordHasher)
    .inSingletonScope();

  container.bind<ITokenGenerator>('ITokenGenerator')
    .to(JwtTokenGenerator)
    .inSingletonScope();

  // Bind use cases
  container.bind(CreatePropertyUseCase).toSelf().inTransientScope();
  container.bind(GetPropertyByIdUseCase).toSelf().inTransientScope();
  container.bind(UpdatePropertyUseCase).toSelf().inTransientScope();
  container.bind(DeletePropertyUseCase).toSelf().inTransientScope();

  // Bind controllers
  container.bind(PropertyController).toSelf().inTransientScope();

  return container;
}

export const container = createContainer();
```

### Required TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,    // Required for @injectable
    "emitDecoratorMetadata": true,     // Required for type metadata
    "types": ["reflect-metadata"]
  }
}
```

## Testing Strategy

### Unit Testing Use Cases
```typescript
describe('CreatePropertyUseCase', () => {
  let useCase: CreatePropertyUseCase;
  let mockRepo: jest.Mocked<IPropertyRepository>;
  let mockEventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    // Create mocks
    mockRepo = {
      create: jest.fn(),
      findByAddress: jest.fn(),
      // ... other methods
    };

    mockEventBus = {
      publish: jest.fn()
    };

    // Inject mocks
    useCase = new CreatePropertyUseCase(mockRepo, mockEventBus);
  });

  it('should create property with valid input', async () => {
    // Arrange
    const input = validPropertyInput();
    const expected = propertyEntity(input);
    mockRepo.findByAddress.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(expected);

    // Act
    const result = await useCase.execute(input);

    // Assert
    expect(result).toEqual(expected);
    expect(mockEventBus.publish).toHaveBeenCalledWith({
      type: 'PropertyCreated',
      payload: expected
    });
  });
});
```

## Benefits of This Architecture

### 1. Feature Development Speed
- New features follow established patterns
- 2-3 days from concept to production
- Mechanical process reduces decision fatigue

### 2. Testability
- Business logic tested without database
- 100% unit test coverage achievable
- Fast test execution (< 30 seconds)

### 3. Maintainability
- Clear separation of concerns
- Easy to locate code
- Consistent patterns across features

### 4. Flexibility
- Switch from Prisma to MongoDB: Change only repositories
- Switch from Express to Fastify: Change only presentation layer
- Switch from JWT to OAuth: Change only auth service

### 5. Team Scalability
- Clear boundaries prevent conflicts
- Parallel development possible
- Onboarding time: 3 days

## Common Patterns

### Repository Pattern
```typescript
// Abstraction (Domain Layer)
interface IRepository<T> {
  create(data: CreateData): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, data: UpdateData): Promise<T>;
  delete(id: string): Promise<void>;
}

// Implementation (Infrastructure Layer)
class ConcreteRepository implements IRepository<Entity> {
  // Database-specific implementation
}
```

### Use Case Pattern
```typescript
// Standard use case structure
class UseCase {
  constructor(private dependencies: Dependencies) {}

  async execute(input: Input): Promise<Output> {
    // 1. Validate input
    // 2. Apply business rules
    // 3. Perform operation
    // 4. Handle side effects
    // 5. Return result
  }
}
```

### Error Handling Pattern
```typescript
// Domain errors (Core Layer)
class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends DomainError {}
class NotFoundError extends DomainError {}
class ConflictError extends DomainError {}

// Usage in use case
if (!valid) {
  throw new ValidationError('Invalid input');
}

// Handling in controller
catch (error) {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  }
}
```

## Anti-Patterns to Avoid

### ❌ Business Logic in Controllers
```typescript
// WRONG
async createProperty(req, res) {
  // Validation in controller
  if (!req.body.address) {
    return res.status(400).json({ error: 'Address required' });
  }

  // Business logic in controller
  const existing = await prisma.property.findFirst({...});
  if (existing) {
    return res.status(409).json({ error: 'Duplicate' });
  }
}
```

### ❌ Infrastructure in Domain
```typescript
// WRONG
class Property {
  async save() {
    // Domain entity shouldn't know about database
    await prisma.property.create({...});
  }
}
```

### ❌ Concrete Dependencies
```typescript
// WRONG
class CreatePropertyUseCase {
  constructor() {
    // Hard-coded dependency
    this.repo = new PrismaPropertyRepository();
  }
}
```

## Migration Path

### Moving to Clean Architecture

1. **Start with new features** - Don't refactor everything at once
2. **Extract use cases first** - Move business logic out of controllers
3. **Define interfaces** - Create repository interfaces
4. **Implement repositories** - Wrap database calls
5. **Wire with DI** - Use dependency injection
6. **Add tests** - Verify behavior preserved

### Example Migration
```typescript
// Before (Fat Controller)
async createProperty(req, res) {
  const data = req.body;
  if (!data.address) throw new Error('Invalid');
  const property = await prisma.property.create({data});
  res.json(property);
}

// After (Clean Architecture)
// Controller (thin)
async createProperty(req, res) {
  const property = await this.createUseCase.execute(req.body);
  res.json(property);
}

// Use Case (business logic)
async execute(input) {
  const valid = this.validate(input);
  return await this.repository.create(valid);
}
```

## Conclusion

Clean Architecture provides:
- **Clear boundaries** between concerns
- **Testable** business logic
- **Flexible** technical implementations
- **Consistent** patterns across features
- **Fast** feature development

The initial complexity pays off after 2-3 features when patterns are established and development becomes mechanical.

---

*"The architecture should scream the intent of the system."* - Clean Architecture enables anyone to understand what Upkeep.io does by looking at the use cases, not the framework.