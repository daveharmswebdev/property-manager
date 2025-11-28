# 📊 Domain Model Guide

> *"The domain model is the heart of the software. It is the reason the software is being written."*

## Overview

The Upkeep.io domain model represents the core business concepts for property management, focusing on maintenance tracking, expense management, and tax deduction optimization for rental property owners.

## Core Domain Entities

### Entity Relationship Diagram

```
User (Property Owner)
├── Property (1:M)
│   ├── Lease (1:M)
│   │   ├── LeaseLessee (M:M with Person)
│   │   └── LeaseOccupant (1:M)
│   ├── MaintenanceWork (1:M)
│   │   ├── WorkPerformer (1:M)
│   │   ├── Receipt (1:M)
│   │   └── TravelActivity (1:M)
│   └── RecurringService (1:M)
├── Person (1:M)
│   └── Types: OWNER | FAMILY_MEMBER | VENDOR | LESSEE | OCCUPANT
└── Vendor (1:M)
```

## Primary Entities

### Property
**Purpose:** Represents a rental property owned by the user

**Key Attributes:**
- `address`, `city`, `state`, `zipCode` - Location
- `purchaseDate`, `purchasePrice` - Acquisition details
- `currentValue` - For equity tracking
- `notes` - Additional information

**Business Rules:**
- Must have unique address per user
- Purchase price cannot be negative
- Soft delete for historical tracking

**Use Cases:**
- Track property portfolio
- Calculate property age
- Generate property reports

### MaintenanceWork
**Purpose:** Central aggregate root tying together all work, costs, and travel

**Key Attributes:**
- `propertyId` - Which property
- `description` - What work was done
- `startDate`, `endDate` - When work occurred
- `status` - PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
- `totalCost` - Calculated from receipts + labor

**Business Rules:**
- Must be associated with a property
- End date must be after start date
- Status transitions follow workflow

**Relationships:**
- Has many WorkPerformers (who did the work)
- Has many Receipts (material costs)
- Has many TravelActivities (mileage tracking)

### WorkPerformer
**Purpose:** Track who performed work and time spent

**Key Attributes:**
- `maintenanceWorkId` - Associated work
- `performerType` - OWNER | FAMILY | VENDOR
- `personId` or `vendorId` - Who did the work
- `hoursWorked` - Time tracking
- `hourlyRate` - For cost calculation

**Business Rules:**
- Must reference either Person or Vendor, not both
- Hours and rate must be non-negative
- Owner/family can have zero rate (DIY work)

**Tax Implications:**
- Vendor work is deductible
- Owner labor typically not deductible
- Family labor may be deductible if employed

### Receipt
**Purpose:** Track material purchases for tax deductions

**Key Attributes:**
- `maintenanceWorkId` - Associated work
- `storeName` - Where purchased
- `amount` - Purchase amount
- `purchaseDate` - When bought
- `description` - What was purchased
- `receiptImageUrl` - Digital receipt storage

**Business Rules:**
- Amount must be positive
- Purchase date cannot be future
- Should retain for 7 years (IRS requirement)

**Tax Tracking:**
- All receipts are potential deductions
- Categorization helps with Schedule E

### TravelActivity
**Purpose:** Track mileage for IRS deductions

**Key Attributes:**
- `maintenanceWorkId` - Associated work
- `date` - When travel occurred
- `startLocation`, `endLocation` - Trip endpoints
- `mileage` - Distance traveled
- `purpose` - Reason for travel

**Business Rules:**
- Mileage must be positive
- Purpose required for IRS
- Contemporary records preferred

**Tax Deduction:**
- Standard mileage rate (2024: $0.67/mile)
- Must be for property management purpose

### Lease
**Purpose:** Manage rental agreements and tenant information

**Key Attributes:**
- `propertyId` - Which property
- `startDate`, `endDate` - Lease term
- `monthlyRent` - Rental amount
- `securityDeposit` - Deposit held
- `status` - ACTIVE | MONTH_TO_MONTH | ENDED | VOIDED

**Business Rules:**
- One active lease per property
- Must have at least one lessee
- End date optional (month-to-month)

**Relationships:**
- Many-to-many with Person (as lessees)
- One-to-many with occupants

### Person
**Purpose:** Reusable entity for people in various roles

**Types:**
- `OWNER` - Property owner
- `FAMILY_MEMBER` - Family doing work
- `VENDOR` - Individual contractors
- `LESSEE` - People on lease
- `OCCUPANT` - People living at property

**Key Attributes:**
- `firstName`, `lastName`, `middleName`
- `email`, `phone` - Contact info
- `personType` - Role in system

**Business Rules:**
- Email/phone required for adult lessees/occupants
- Can have multiple roles over time
- Soft delete preserves history

### Vendor
**Purpose:** Track companies providing services

**Key Attributes:**
- `businessName` - Company name
- `contactName` - Primary contact
- `email`, `phone` - Contact information
- `businessType` - PLUMBING | ELECTRICAL | HVAC | etc.
- `taxId` - For 1099 reporting

**Business Rules:**
- Must have business name
- Tax ID required for payments > $600/year
- Can be referenced by multiple properties

**Use Cases:**
- Track preferred vendors
- Generate 1099 forms
- Compare vendor costs

### RecurringService
**Purpose:** Schedule regular vendor services

**Key Attributes:**
- `vendorId` - Who provides service
- `frequency` - MONTHLY | QUARTERLY | ANNUAL | CUSTOM
- `nextServiceDate` - When next due
- `estimatedCost` - Budget planning
- `properties` - Which properties covered

**Business Rules:**
- Must have at least one property
- Next date updates after completion
- Can pause/resume services

**Examples:**
- HVAC maintenance twice yearly
- Lawn service monthly
- Gutter cleaning quarterly

## Domain Aggregates

### MaintenanceWork Aggregate
Root: MaintenanceWork
Members:
- WorkPerformer[]
- Receipt[]
- TravelActivity[]

**Invariants:**
- Total cost = Sum of receipts + Sum of (performer hours × rate)
- All travel must occur between start and end dates
- Status transitions are one-way (except CANCELLED)

### Lease Aggregate
Root: Lease
Members:
- LeaseLessee[]
- LeaseOccupant[]

**Invariants:**
- At least one lessee required
- Adult occupants must have contact info
- Cannot overlap with other active leases

## Value Objects

### Address
```typescript
class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly state: string,
    public readonly zipCode: string
  ) {}

  toString(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}`;
  }

  equals(other: Address): boolean {
    return this.street === other.street &&
           this.city === other.city &&
           this.state === other.state &&
           this.zipCode === other.zipCode;
  }
}
```

### Money
```typescript
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'USD'
  ) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  format(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency
    }).format(this.amount);
  }
}
```

### DateRange
```typescript
class DateRange {
  constructor(
    public readonly start: Date,
    public readonly end: Date | null
  ) {
    if (end && start > end) {
      throw new Error('Start date must be before end date');
    }
  }

  isActive(date: Date = new Date()): boolean {
    return date >= this.start && (!this.end || date <= this.end);
  }

  overlaps(other: DateRange): boolean {
    // Implementation
  }
}
```

## Domain Events

### Property Events
- PropertyCreated
- PropertyUpdated
- PropertyDeleted

### Maintenance Events
- MaintenanceWorkScheduled
- MaintenanceWorkStarted
- MaintenanceWorkCompleted
- ReceiptAdded
- TravelLogged

### Lease Events
- LeaseCreated
- LeaseActivated
- LeaseEnded
- OccupantAdded
- OccupantRemoved

## Business Rules & Constraints

### Property Constraints
1. No duplicate addresses per user
2. Purchase price ≥ 0
3. Current value ≥ 0
4. Cannot delete with active lease

### Maintenance Constraints
1. Cannot complete before starting
2. Cannot add receipts to cancelled work
3. Travel must have positive mileage
4. Work performer must exist

### Lease Constraints
1. One active lease per property at a time
2. Lease cannot start in the past (for new leases)
3. Security deposit ≥ 0
4. Monthly rent > 0 (typically)

### Tax Compliance Rules
1. Receipts retained for 7 years
2. Mileage logs must include purpose
3. Vendor payments > $600/year need 1099
4. Depreciation tracking for properties

## Future Domain Concepts

### Phase 2 Entities
- **TenantPortal** - Tenant access to information
- **PaymentRecord** - Rent payment tracking
- **MaintenanceRequest** - Tenant-initiated repairs
- **Document** - Lease PDFs, receipts, etc.

### Phase 3 Entities
- **InsurancePolicy** - Coverage tracking
- **Mortgage** - Loan tracking
- **TaxReport** - Schedule E generation
- **Inspection** - Property inspection records

### Phase 4 Entities
- **Portfolio** - Group properties
- **Budget** - Financial planning
- **Forecast** - Revenue projections
- **Alert** - Automated notifications

## Domain Modeling Principles

### 1. Ubiquitous Language
Use terms that property managers understand:
- "Lease" not "Rental Agreement Entity"
- "Lessee" not "Tenant User"
- "Maintenance Work" not "Service Task"

### 2. Bounded Contexts
Current contexts:
- **Property Management** - Core domain
- **Authentication** - Supporting subdomain
- **Reporting** - Generic subdomain

### 3. Aggregate Design
- Small aggregates for consistency
- Reference by ID across aggregates
- One transaction per aggregate

### 4. Entity vs Value Object
Entities have identity:
- Property (identified by ID)
- Person (identified by ID)

Value Objects are compared by value:
- Address (same street/city/state/zip = same)
- Money (same amount/currency = same)

## Implementation Patterns

### Repository Pattern
```typescript
interface IMaintenanceWorkRepository {
  // Aggregate operations
  createWithDetails(
    work: MaintenanceWork,
    performers: WorkPerformer[],
    receipts: Receipt[]
  ): Promise<MaintenanceWork>;

  // Query operations
  findByPropertyId(propertyId: string): Promise<MaintenanceWork[]>;
  findInDateRange(start: Date, end: Date): Promise<MaintenanceWork[]>;
}
```

### Factory Pattern
```typescript
class MaintenanceWorkFactory {
  static createScheduled(
    propertyId: string,
    description: string,
    scheduledDate: Date
  ): MaintenanceWork {
    return new MaintenanceWork({
      propertyId,
      description,
      startDate: scheduledDate,
      status: 'PLANNED',
      // ... defaults
    });
  }
}
```

### Specification Pattern
```typescript
class ActiveLeaseSpecification {
  isSatisfiedBy(lease: Lease): boolean {
    return lease.status === 'ACTIVE' ||
           lease.status === 'MONTH_TO_MONTH';
  }
}
```

---

*The domain model is the foundation of the application. It captures the essential complexity of property management while remaining flexible for future enhancements.*