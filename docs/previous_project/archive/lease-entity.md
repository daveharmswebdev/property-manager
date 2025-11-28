# Lease Entity Documentation

## Overview

The Lease entity is the core component for managing rental agreements in the Upkeep.io property management system. It replaces the previous Tenant entity and provides comprehensive support for complex lease scenarios including multiple lessees, occupants, and lease history tracking.

## Entity Structure

### Core Entities

#### Lease
The main lease entity representing a rental agreement for a property.

```typescript
interface Lease {
  id: string;
  userId: string;              // Property owner
  propertyId: string;          // Associated property
  startDate: Date;
  endDate?: Date;              // Optional for month-to-month
  monthlyRent?: number;
  securityDeposit?: number;
  depositPaidDate?: Date;
  notes?: string;
  status: LeaseStatus;         // ACTIVE | MONTH_TO_MONTH | ENDED | VOIDED
  voidedReason?: string;       // Reason if status is VOIDED
  deletedAt?: Date;            // Soft delete timestamp
  createdAt: Date;
  updatedAt: Date;
}

enum LeaseStatus {
  ACTIVE = 'ACTIVE',
  MONTH_TO_MONTH = 'MONTH_TO_MONTH',
  ENDED = 'ENDED',
  VOIDED = 'VOIDED'
}
```

#### LeaseLessee
Join table managing the many-to-many relationship between Leases and Persons (as lessees).

```typescript
interface LeaseLessee {
  id: string;
  leaseId: string;
  personId: string;            // References Person entity
  signedDate?: Date;           // When this person signed
  deletedAt?: Date;            // Soft delete for historical tracking
  createdAt: Date;
  updatedAt: Date;
}
```

#### LeaseOccupant
Tracks people living at the property who are not on the lease.

```typescript
interface LeaseOccupant {
  id: string;
  leaseId: string;
  personId: string;            // References Person entity
  isAdult: boolean;            // Determines email/phone requirements
  moveInDate?: Date;
  moveOutDate?: Date;
  deletedAt?: Date;            // Soft delete
  createdAt: Date;
  updatedAt: Date;
}
```

### Updated Person Entity

The Person entity has been updated to support the lease system:

```typescript
type PersonType = 'OWNER' | 'FAMILY_MEMBER' | 'VENDOR' | 'LESSEE' | 'OCCUPANT';

interface Person {
  id: string;
  userId: string;
  personType: PersonType;
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;              // Optional (required for adult lessees/occupants)
  phone?: string;              // Optional (required for adult lessees/occupants)
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Changes:**
- Added `LESSEE` and `OCCUPANT` to PersonType enum
- Made `email` and `phone` optional to support child occupants
- Person entities are reusable across leases

## Relationships

```
User (1) ──── (M) Property
Property (1) ──── (M) Lease
Lease (M) ──── (M) Person (via LeaseLessee)
Lease (1) ──── (M) LeaseOccupant
LeaseOccupant (M) ──── (1) Person
```

**Key Relationship Rules:**
- One lease belongs to one property
- One lease can have multiple lessees (people on the lease)
- One lease can have multiple occupants (people living there but not on lease)
- One person can be a lessee on multiple leases over time (lease history)
- Occupants are distinguished as adults or children via `isAdult` flag

## Validation Rules

### Lease Creation
- **Required:** propertyId, startDate
- **Optional:** endDate (for month-to-month), monthlyRent, securityDeposit, notes
- **Lessees:** At least one lessee required
- **Occupants:** Optional

### Lessee Validation
- **Email & Phone:** Required for all lessees
- **Inline Creation:** Can create person inline during lease creation
- **Existing Person:** Can reference existing person by personId

### Occupant Validation
- **Adult Occupants (`isAdult: true`):**
  - Email and phone REQUIRED
  - Full contact information needed
- **Child Occupants (`isAdult: false`):**
  - Email and phone NOT required
  - Only name information needed

### Date Validation
- If both startDate and endDate provided, startDate must be before endDate
- Dates validated via Zod schema in `@upkeep-io/validators`

## Supported Scenarios

### Scenario 1: New Tenant, One Year Lease
```json
{
  "propertyId": "uuid",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 2000,
  "lessees": [
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "phone": "555-0101"
    }
  ]
}
```

### Scenario 2: Convert to Month-to-Month
```json
{
  "status": "MONTH_TO_MONTH",
  "endDate": null,
  "notes": "Converted after initial year"
}
```

### Scenario 3: Couple Splits - One Moves Out
**Process:**
1. DELETE `/api/leases/{leaseId}/lessees/{personId}` with:
```json
{
  "voidedReason": "Couple separated",
  "newLeaseData": {
    "startDate": "2025-07-01",
    "monthlyRent": 1500,
    "notes": "Sole lessee after breakup"
  }
}
```
2. Old lease is voided (status: VOIDED)
3. New lease created with remaining lessee
4. Both leases preserved in history

### Scenario 4: Family with Children
```json
{
  "propertyId": "uuid",
  "startDate": "2025-02-01",
  "monthlyRent": 3000,
  "lessees": [
    {
      "firstName": "Bob",
      "lastName": "Johnson",
      "email": "bob@example.com",
      "phone": "555-0301"
    },
    {
      "firstName": "Alice",
      "lastName": "Johnson",
      "email": "alice@example.com",
      "phone": "555-0302"
    }
  ],
  "occupants": [
    {
      "firstName": "Tommy",
      "lastName": "Johnson",
      "isAdult": false
    },
    {
      "firstName": "Sally",
      "lastName": "Johnson",
      "isAdult": false
    }
  ]
}
```

### Scenario 5: Primary Lessee with Adult Occupant
```json
{
  "propertyId": "uuid",
  "startDate": "2025-03-01",
  "monthlyRent": 1800,
  "lessees": [
    {
      "firstName": "Sarah",
      "lastName": "Williams",
      "email": "sarah@example.com",
      "phone": "555-0401"
    }
  ],
  "occupants": [
    {
      "firstName": "Mike",
      "lastName": "Brown",
      "email": "mike@example.com",
      "phone": "555-0402",
      "isAdult": true
    }
  ]
}
```

## API Endpoints

### Core CRUD Operations

#### Create Lease
```http
POST /api/leases
Authorization: Bearer {token}
Content-Type: application/json

{
  "propertyId": "uuid",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 2000,
  "securityDeposit": 4000,
  "lessees": [...],
  "occupants": [...]
}
```

#### Get All Leases
```http
GET /api/leases
Authorization: Bearer {token}
```

#### Get Lease by ID
```http
GET /api/leases/{leaseId}
Authorization: Bearer {token}
```
Returns lease with full lessee and occupant details.

#### Get Leases by Property
```http
GET /api/leases/property/{propertyId}
Authorization: Bearer {token}
```

#### Update Lease
```http
PUT /api/leases/{leaseId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "monthlyRent": 2200,
  "status": "MONTH_TO_MONTH",
  "notes": "Updated terms"
}
```

#### Soft Delete Lease
```http
DELETE /api/leases/{leaseId}
Authorization: Bearer {token}
```
Sets `deletedAt` timestamp and soft-deletes all lessees and occupants.

### Lessee Management

#### Add Lessee to Lease
```http
POST /api/leases/{leaseId}/lessees
Authorization: Bearer {token}
Content-Type: application/json

{
  "personId": "existing-person-uuid",
  "signedDate": "2025-06-01"
}
```

#### Remove Lessee (Void & Recreate)
```http
DELETE /api/leases/{leaseId}/lessees/{personId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "voidedReason": "Person moved out",
  "newLeaseData": {
    "startDate": "2025-07-01",
    "monthlyRent": 1500
  }
}
```

**Behavior:**
1. Voids the current lease (sets status to VOIDED)
2. Creates new lease with remaining lessees
3. Copies occupants to new lease
4. Returns `{ newLeaseId: "uuid" }`

### Occupant Management

#### Add Occupant to Lease
```http
POST /api/leases/{leaseId}/occupants
Authorization: Bearer {token}
Content-Type: application/json

{
  "personId": "existing-person-uuid",
  "isAdult": false,
  "moveInDate": "2025-08-01"
}
```

#### Remove Occupant from Lease
```http
DELETE /api/leases/{leaseId}/occupants/{occupantId}
Authorization: Bearer {token}
```
Soft deletes the occupant (sets `deletedAt`).

## Soft Delete Behavior

### Philosophy
All lease-related data is preserved for historical and tax record purposes. Soft deletes allow:
- Historical tracking of lease changes
- Audit trails for financial records
- IRS documentation requirements
- Recovery of accidentally deleted data

### Implementation
- **Lease Soft Delete:** Sets `deletedAt` on lease and cascades to all lessees and occupants
- **Lessee Removal:** Voids lease (VOIDED status) rather than deleting, creates new lease
- **Occupant Removal:** Sets `deletedAt` on specific occupant record
- **Queries:** All repository queries filter `deletedAt: null` by default

### Database Indexes
- `deletedAt` indexed on all tables for query performance
- Unique constraints respect soft-deleted records (via `deletedAt IS NULL`)

## Business Logic

### Use Cases

All use cases follow Clean Architecture principles:

1. **CreateLeaseUseCase**
   - Validates property ownership
   - Creates Person entities for inline lessees/occupants
   - Validates adult occupants have email/phone
   - Creates lease with all relationships atomically

2. **GetLeaseByIdUseCase**
   - Verifies ownership
   - Returns lease with full lessee and occupant details

3. **UpdateLeaseUseCase**
   - Updates lease fields only (not lessees/occupants)
   - Validates ownership

4. **DeleteLeaseUseCase**
   - Soft deletes lease
   - Cascades to lessees and occupants

5. **ListLeasesUseCase / ListLeasesByPropertyUseCase**
   - Returns all non-deleted leases with relationships

6. **AddLesseeToLeaseUseCase**
   - Adds existing person to lease as lessee

7. **RemoveLesseeFromLeaseUseCase**
   - Voids current lease
   - Creates new lease with remaining lessees
   - Preserves occupants
   - Prevents removal of last lessee

8. **AddOccupantToLeaseUseCase**
   - Validates adult occupants have email/phone
   - Adds person to lease as occupant

9. **RemoveOccupantFromLeaseUseCase**
   - Soft deletes occupant from lease

## Testing

### Postman Collection
Import `Lease-API.postman_collection.json` for comprehensive API testing.

**Variables:**
- `{{baseUrl}}`: API base URL (default: http://localhost:3000)
- `{{token}}`: JWT authentication token

**Test Coverage:**
- All 5 lease scenarios
- CRUD operations
- Lessee management (add/remove)
- Occupant management (add/remove)
- Error cases

### Unit Tests
All use cases have unit tests with mocked repositories:
- Success paths
- Validation errors
- Ownership verification
- Not found errors
- Edge cases (last lessee removal, etc.)

## Migration from Tenant Entity

### Database Changes
- **Dropped:** `tenants` table, `pets` table
- **Created:** `leases`, `lease_lessees`, `lease_occupants` tables
- **Updated:** `persons` table (email/phone nullable, new PersonTypes)

### Breaking Changes
- Tenant API endpoints removed (`/api/tenants`)
- Tenant entity no longer exists
- Person email/phone now optional (was required)
- New PersonType values: LESSEE, OCCUPANT

### Data Migration
Since the system is in development, no data migration was performed. For production:
1. Create migration script to convert Tenants → Leases
2. Create Person records for each tenant
3. Create LeaseLessee relationships
4. Preserve original createdAt/updatedAt timestamps

## Architecture

### Clean Architecture Layers

**Domain Layer (`libs/domain`):**
- Pure TypeScript interfaces
- No external dependencies
- Shared across frontend and backend

**Application Layer (`apps/backend/src/application/lease`):**
- Use cases with business logic
- Depends only on domain interfaces
- Fully testable with mocked repositories

**Infrastructure Layer (`apps/backend/src/infrastructure/repositories`):**
- PrismaLeaseRepository implementation
- Handles database operations
- Manages relationships and includes

**Presentation Layer (`apps/backend/src/presentation`):**
- LeaseController (Express)
- Route definitions
- HTTP request/response handling

### Dependency Injection
All dependencies injected via Inversify:
```typescript
container.bind<ILeaseRepository>('ILeaseRepository')
  .to(PrismaLeaseRepository)
  .inTransientScope();
```

## Performance Considerations

### Database Indexes
- Primary keys: `id` on all tables
- Foreign keys: `leaseId`, `personId`, `propertyId`, `userId`
- Soft delete: `deletedAt` for fast filtering
- Unique constraint: `[leaseId, personId]` on LeaseLessee

### Query Optimization
- Eager loading: lessees and occupants included in lease queries
- Filtered queries: Always exclude soft-deleted records
- Indexed lookups: All relationship queries use indexed columns

### Caching Strategy (Future)
- Lease data rarely changes
- Consider caching lease details by ID
- Invalidate on update/delete
- TTL: 5-15 minutes

## Security

### Authorization
- All endpoints require JWT authentication
- Ownership verification on all operations
- Cannot access other users' leases

### Validation
- Zod schema validation on all inputs
- SQL injection prevention via Prisma
- XSS prevention via input sanitization

## Future Enhancements

1. **Lease Templates:** Reusable lease templates for common scenarios
2. **Lease Documents:** PDF generation and e-signature integration
3. **Rent Payment Tracking:** Link leases to payment records
4. **Lease Renewal:** Automatic renewal workflow
5. **Notification System:** Lease expiration alerts
6. **Lease Reporting:** Financial reports per lease
7. **Multi-property Leases:** Support for leases spanning multiple properties

## References

- **Prisma Schema:** `apps/backend/prisma/schema.prisma`
- **Domain Entities:** `libs/domain/src/entities/Lease.ts`
- **Validators:** `libs/validators/src/lease/`
- **Use Cases:** `apps/backend/src/application/lease/`
- **API Routes:** `apps/backend/src/presentation/routes/leaseRoutes.ts`
- **Postman Collection:** `Lease-API.postman_collection.json`
