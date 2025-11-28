# 📄 Lease Management Workflow

> *This workflow handles the complex relationships between properties, leases, lessees, and occupants.*

## Overview

The Lease Management system replaces the previous Tenant entity with a more comprehensive model that supports:
- Multiple lessees per lease
- Non-lessee occupants (including children)
- Lease history tracking
- Various lease scenarios (fixed-term, month-to-month)
- Person entity reuse across leases

## Entity Model

### Core Relationships
```
Property (1) ──── (M) Lease
Lease (M) ──── (M) Person (as Lessees via LeaseLessee)
Lease (1) ──── (M) LeaseOccupant
LeaseOccupant (M) ──── (1) Person
```

### Lease States
```typescript
enum LeaseStatus {
  ACTIVE = 'ACTIVE',                // Fixed-term active lease
  MONTH_TO_MONTH = 'MONTH_TO_MONTH', // No end date
  ENDED = 'ENDED',                   // Lease completed
  VOIDED = 'VOIDED'                  // Cancelled lease
}
```

---

## User Workflows

### Workflow 1: No Lease Exists

**Entry Point:** Property Detail Page

**Visual Indicators:**
- "No active lease" message
- Prominent "Add Lease" button
- Empty tenant information section

**User Journey:**

1. **Click "Add Lease" Button**
   - Navigate to `/properties/{id}/leases/new`
   - Form initialized with propertyId

2. **Fill Lease Form**
   ```
   Basic Information:
   ├── Start Date (required)
   ├── End Date (optional for month-to-month)
   ├── Monthly Rent
   └── Security Deposit

   Lessees (at least 1 required):
   ├── First Name, Last Name (required)
   ├── Email (required)
   ├── Phone (required)
   └── Signed Date

   Occupants (optional):
   ├── Name (required)
   ├── Is Adult? (checkbox)
   ├── Email (required if adult)
   └── Phone (required if adult)
   ```

3. **Submit Lease**
   - Validation runs (shared schemas)
   - Success: Redirect to property detail
   - Failure: Show inline errors

### Workflow 2: Lease Exists

**Entry Point:** Property Detail Page

**Visual Display:**
```
Lease Information:
├── Status Badge (Active/Month-to-Month/Ended)
├── Dates (Start - End or "Month-to-Month")
├── Monthly Rent
├── Security Deposit

Lessees:
├── [Name] - Primary
├── [Email] | [Phone]
└── Signed: [Date]

Other Occupants:
├── [Name] (Adult)
├── [Email] | [Phone]
└── [Child Name] (Child)
```

**Available Actions:**
- View full lease details
- End lease (future feature)
- Add/remove occupants (future feature)
- View lease history (future feature)

---

## Implementation Details

### Backend Architecture

#### 1. Domain Entities
```typescript
// core/entities/Lease.ts
export class Lease {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly propertyId: string,
    public readonly startDate: Date,
    public readonly endDate: Date | null,
    public readonly monthlyRent: number | null,
    public readonly securityDeposit: number | null,
    public readonly status: LeaseStatus,
    public readonly lessees: LeaseLessee[],
    public readonly occupants: LeaseOccupant[]
  ) {}

  isMonthToMonth(): boolean {
    return this.endDate === null;
  }

  isActive(): boolean {
    return this.status === LeaseStatus.ACTIVE ||
           this.status === LeaseStatus.MONTH_TO_MONTH;
  }
}
```

#### 2. Use Cases
```typescript
// application/lease/CreateLeaseUseCase.ts
@injectable()
export class CreateLeaseUseCase {
  constructor(
    @inject('ILeaseRepository') private leaseRepo: ILeaseRepository,
    @inject('IPersonRepository') private personRepo: IPersonRepository
  ) {}

  async execute(input: CreateLeaseInput): Promise<Lease> {
    // 1. Validate input
    const validation = createLeaseSchema.safeParse(input);
    if (!validation.success) {
      throw new ValidationError(validation.error);
    }

    // 2. Check for active lease
    const existingLease = await this.leaseRepo.findActiveByPropertyId(
      input.propertyId
    );
    if (existingLease) {
      throw new ConflictError('Property already has an active lease');
    }

    // 3. Create or find persons for lessees
    const lesseePersons = await this.createOrFindPersons(
      input.lessees,
      'LESSEE'
    );

    // 4. Create or find persons for occupants
    const occupantPersons = await this.createOrFindPersons(
      input.occupants,
      'OCCUPANT'
    );

    // 5. Create lease with relationships
    return await this.leaseRepo.createWithRelations({
      ...validation.data,
      lessees: lesseePersons,
      occupants: occupantPersons
    });
  }

  private async createOrFindPersons(
    persons: PersonInput[],
    type: PersonType
  ): Promise<Person[]> {
    const results: Person[] = [];

    for (const person of persons) {
      if (person.personId) {
        // Use existing person
        const existing = await this.personRepo.findById(person.personId);
        if (!existing) {
          throw new NotFoundError('Person not found');
        }
        results.push(existing);
      } else {
        // Create new person
        const created = await this.personRepo.create({
          ...person,
          personType: type
        });
        results.push(created);
      }
    }

    return results;
  }
}
```

#### 3. Repository Implementation
```typescript
// infrastructure/repositories/PrismaLeaseRepository.ts
@injectable()
export class PrismaLeaseRepository implements ILeaseRepository {
  async createWithRelations(data: CreateLeaseData): Promise<Lease> {
    return await prisma.$transaction(async (tx) => {
      // 1. Create lease
      const lease = await tx.lease.create({
        data: {
          userId: data.userId,
          propertyId: data.propertyId,
          startDate: data.startDate,
          endDate: data.endDate,
          monthlyRent: data.monthlyRent,
          securityDeposit: data.securityDeposit,
          status: data.endDate ? 'ACTIVE' : 'MONTH_TO_MONTH'
        }
      });

      // 2. Create lessee relationships
      for (const person of data.lessees) {
        await tx.leaseLessee.create({
          data: {
            leaseId: lease.id,
            personId: person.id,
            signedDate: person.signedDate
          }
        });
      }

      // 3. Create occupant relationships
      for (const occupant of data.occupants) {
        await tx.leaseOccupant.create({
          data: {
            leaseId: lease.id,
            personId: occupant.personId,
            isAdult: occupant.isAdult
          }
        });
      }

      // 4. Return with relationships
      return await this.findById(lease.id);
    });
  }

  async findActiveByPropertyId(propertyId: string): Promise<Lease | null> {
    const lease = await prisma.lease.findFirst({
      where: {
        propertyId,
        status: {
          in: ['ACTIVE', 'MONTH_TO_MONTH']
        },
        deletedAt: null
      },
      include: {
        lessees: {
          include: {
            person: true
          }
        },
        occupants: {
          include: {
            person: true
          }
        }
      }
    });

    return lease ? this.toDomainEntity(lease) : null;
  }
}
```

### Frontend Implementation

#### 1. Lease Form Component
```vue
<!-- LeaseFormView.vue -->
<template>
  <div class="lease-form">
    <h2>Create Lease</h2>

    <Form @submit="onSubmit" :validation-schema="validationSchema">
      <!-- Basic Information -->
      <section>
        <h3>Lease Details</h3>
        <FormInput
          name="startDate"
          label="Start Date"
          type="date"
        />

        <FormInput
          name="endDate"
          label="End Date"
          type="date"
          placeholder="Leave blank for month-to-month"
        />

        <FormInput
          name="monthlyRent"
          label="Monthly Rent"
          type="number"
          :format="formatPrice"
        />

        <FormInput
          name="securityDeposit"
          label="Security Deposit"
          type="number"
          :format="formatPrice"
        />
      </section>

      <!-- Lessees -->
      <section>
        <h3>Lessees (People on the Lease)</h3>
        <FieldArray name="lessees">
          <template #default="{ fields, push, remove }">
            <div v-for="(field, idx) in fields" :key="field.key">
              <PersonForm
                :name="`lessees[${idx}]`"
                :required-contact="true"
                @remove="remove(idx)"
              />
            </div>
            <button type="button" @click="push(emptyLessee())">
              Add Lessee
            </button>
          </template>
        </FieldArray>
      </section>

      <!-- Occupants -->
      <section>
        <h3>Other Occupants (Optional)</h3>
        <FieldArray name="occupants">
          <template #default="{ fields, push, remove }">
            <div v-for="(field, idx) in fields" :key="field.key">
              <OccupantForm
                :name="`occupants[${idx}]`"
                @remove="remove(idx)"
              />
            </div>
            <button type="button" @click="push(emptyOccupant())">
              Add Occupant
            </button>
          </template>
        </FieldArray>
      </section>

      <div class="form-actions">
        <button type="button" @click="cancel">Cancel</button>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating...' : 'Create Lease' }}
        </button>
      </div>
    </Form>
  </div>
</template>

<script setup lang="ts">
import { createLeaseSchema } from '@validators/lease';
import { useLeaseStore } from '@/stores/lease';
import { useFormSubmission } from '@/composables/useFormSubmission';

const props = defineProps<{
  propertyId: string;
}>();

const leaseStore = useLeaseStore();
const validationSchema = toTypedSchema(createLeaseSchema);

const { submitError, isSubmitting, submit } = useFormSubmission(
  async (data) => {
    const formattedData = {
      ...data,
      propertyId: props.propertyId,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null
    };
    await leaseStore.createLease(formattedData);
  },
  {
    successMessage: 'Lease created successfully',
    redirectTo: `/properties/${props.propertyId}`
  }
);
</script>
```

#### 2. Shared Validation
```typescript
// libs/validators/src/lease.ts
import { z } from 'zod';

const personSchema = z.object({
  personId: z.string().optional(), // Use existing person
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10)
});

const occupantSchema = z.object({
  personId: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  isAdult: z.boolean(),
  // Conditional validation based on isAdult
  email: z.string().email().optional(),
  phone: z.string().min(10).optional()
}).refine((data) => {
  if (data.isAdult) {
    return data.email && data.phone;
  }
  return true;
}, {
  message: "Email and phone required for adult occupants"
});

export const createLeaseSchema = z.object({
  propertyId: z.string().uuid(),
  startDate: z.date(),
  endDate: z.date().optional(),
  monthlyRent: z.number().positive().optional(),
  securityDeposit: z.number().positive().optional(),
  lessees: z.array(personSchema).min(1, "At least one lessee required"),
  occupants: z.array(occupantSchema).optional()
}).refine((data) => {
  if (data.endDate) {
    return data.startDate < data.endDate;
  }
  return true;
}, {
  message: "End date must be after start date"
});
```

---

## Complex Scenarios

### Scenario 1: Roommates
```json
{
  "propertyId": "uuid",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 3000,
  "lessees": [
    {
      "firstName": "John",
      "lastName": "Smith",
      "email": "john@example.com",
      "phone": "555-0001"
    },
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com",
      "phone": "555-0002"
    }
  ]
}
```

### Scenario 2: Family with Children
```json
{
  "propertyId": "uuid",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31",
  "monthlyRent": 2500,
  "lessees": [
    {
      "firstName": "Parent",
      "lastName": "Name",
      "email": "parent@example.com",
      "phone": "555-0001"
    }
  ],
  "occupants": [
    {
      "firstName": "Teen",
      "lastName": "Name",
      "isAdult": true,
      "email": "teen@example.com",
      "phone": "555-0002"
    },
    {
      "firstName": "Child",
      "lastName": "Name",
      "isAdult": false
    }
  ]
}
```

### Scenario 3: Month-to-Month
```json
{
  "propertyId": "uuid",
  "startDate": "2025-01-01",
  // No endDate - automatically MONTH_TO_MONTH status
  "monthlyRent": 2000,
  "lessees": [
    {
      "firstName": "Tenant",
      "lastName": "Name",
      "email": "tenant@example.com",
      "phone": "555-0001"
    }
  ]
}
```

---

## Testing Checklist

### Unit Tests
- [ ] CreateLeaseUseCase with valid input
- [ ] Validation for missing lessees
- [ ] Validation for adult occupants without contact info
- [ ] Conflict detection for active leases
- [ ] Person creation vs reuse logic

### Integration Tests
- [ ] Full lease creation flow
- [ ] Transaction rollback on failure
- [ ] Relationship creation verification
- [ ] Query performance with includes

### E2E Tests
- [ ] Navigate from property without lease
- [ ] Fill form with multiple lessees
- [ ] Add adult and child occupants
- [ ] Verify redirect after creation
- [ ] Display lease info on property page

---

## Future Enhancements

1. **Lease Editing**
   - Update rent amount
   - Add/remove occupants
   - Change lease dates

2. **Lease History**
   - View previous leases for property
   - Track tenant history across properties
   - Generate lease timeline

3. **Document Management**
   - Upload lease PDFs
   - Generate lease documents
   - Digital signatures

4. **Automated Workflows**
   - Lease renewal reminders
   - Rent increase notifications
   - End-of-lease procedures

5. **Reporting**
   - Occupancy rates
   - Lease turnover metrics
   - Revenue tracking

---

## Key Decisions & Rationale

### Why Separate Lessees and Occupants?
- Legal distinction matters for evictions
- Different contact requirements
- Supports complex family situations

### Why Reusable Person Entities?
- Track tenant history
- Avoid duplicate data
- Support person across multiple roles

### Why Soft Deletes?
- Maintain historical records
- Support lease history
- Audit trail requirements

### Why Transaction for Creation?
- Ensure data consistency
- All-or-nothing creation
- Prevent partial state

---

*This workflow demonstrates handling complex relational data with proper validation, transaction management, and user experience considerations.*