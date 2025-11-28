# Tenant API Documentation

## Overview

The Tenant API provides endpoints for managing tenants in the property management system. Each tenant is associated with a person (created inline) and a property. The API supports soft delete functionality, meaning deleted tenants are marked as deleted but not removed from the database.

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. Create Tenant

Creates a new tenant with inline person creation. Both the person and tenant are created atomically.

**Endpoint:** `POST /tenants`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "middleName": "M",
  "email": "john.doe@example.com",
  "phone": "5551234567",
  "personNotes": "Prefers email contact",
  "propertyId": "550e8400-e29b-41d4-a716-446655440000",
  "leaseStartDate": "2024-01-01T00:00:00.000Z",
  "leaseEndDate": "2024-12-31T23:59:59.999Z",
  "monthlyRent": 2000.00,
  "securityDeposit": 4000.00,
  "tenantNotes": "First-time renter, excellent credit"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "middleName": "M",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "personNotes": "Prefers email contact",
    "propertyId": "550e8400-e29b-41d4-a716-446655440000",
    "leaseStartDate": "2024-01-01T00:00:00.000Z",
    "leaseEndDate": "2024-12-31T23:59:59.999Z",
    "monthlyRent": 2000.00,
    "securityDeposit": 4000.00,
    "tenantNotes": "First-time renter, excellent credit"
  }'
```

**Response (201 Created):**
```json
{
  "id": "tenant-uuid",
  "userId": "user-uuid",
  "personId": "person-uuid",
  "propertyId": "550e8400-e29b-41d4-a716-446655440000",
  "leaseStartDate": "2024-01-01T00:00:00.000Z",
  "leaseEndDate": "2024-12-31T23:59:59.999Z",
  "monthlyRent": 2000.00,
  "securityDeposit": 4000.00,
  "notes": "First-time renter, excellent credit",
  "deletedAt": null,
  "createdAt": "2024-11-15T10:00:00.000Z",
  "updatedAt": "2024-11-15T10:00:00.000Z"
}
```

### 2. List All Tenants

Retrieves all tenants for the authenticated user (excluding soft-deleted tenants).

**Endpoint:** `GET /tenants`

**curl Example:**
```bash
curl -X GET http://localhost:3000/api/tenants \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
[
  {
    "id": "tenant-uuid-1",
    "userId": "user-uuid",
    "personId": "person-uuid-1",
    "propertyId": "property-uuid-1",
    "leaseStartDate": "2024-01-01T00:00:00.000Z",
    "leaseEndDate": "2024-12-31T23:59:59.999Z",
    "monthlyRent": 2000.00,
    "securityDeposit": 4000.00,
    "notes": "First-time renter",
    "deletedAt": null,
    "createdAt": "2024-11-15T10:00:00.000Z",
    "updatedAt": "2024-11-15T10:00:00.000Z"
  },
  {
    "id": "tenant-uuid-2",
    "userId": "user-uuid",
    "personId": "person-uuid-2",
    "propertyId": "property-uuid-2",
    "leaseStartDate": "2023-06-01T00:00:00.000Z",
    "monthlyRent": 1500.00,
    "createdAt": "2024-11-15T10:00:00.000Z",
    "updatedAt": "2024-11-15T10:00:00.000Z"
  }
]
```

### 3. Get Tenant by ID

Retrieves a specific tenant by ID (only if owned by the authenticated user and not soft-deleted).

**Endpoint:** `GET /tenants/:id`

**curl Example:**
```bash
curl -X GET http://localhost:3000/api/tenants/tenant-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "id": "tenant-uuid",
  "userId": "user-uuid",
  "personId": "person-uuid",
  "propertyId": "property-uuid",
  "leaseStartDate": "2024-01-01T00:00:00.000Z",
  "leaseEndDate": "2024-12-31T23:59:59.999Z",
  "monthlyRent": 2000.00,
  "securityDeposit": 4000.00,
  "notes": "First-time renter",
  "deletedAt": null,
  "createdAt": "2024-11-15T10:00:00.000Z",
  "updatedAt": "2024-11-15T10:00:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "Tenant with id tenant-uuid not found"
}
```

### 4. Update Tenant

Updates an existing tenant's information (ownership verification required).

**Endpoint:** `PUT /tenants/:id`

**Request Body:** (all fields optional)
```json
{
  "propertyId": "550e8400-e29b-41d4-a716-446655440001",
  "leaseStartDate": "2024-02-01T00:00:00.000Z",
  "leaseEndDate": "2025-01-31T23:59:59.999Z",
  "monthlyRent": 2200.00,
  "securityDeposit": 4400.00,
  "tenantNotes": "Updated notes"
}
```

**curl Example:**
```bash
curl -X PUT http://localhost:3000/api/tenants/tenant-uuid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "monthlyRent": 2200.00,
    "securityDeposit": 4400.00,
    "tenantNotes": "Rent increased for 2025"
  }'
```

**Response (200 OK):**
```json
{
  "id": "tenant-uuid",
  "userId": "user-uuid",
  "personId": "person-uuid",
  "propertyId": "property-uuid",
  "leaseStartDate": "2024-01-01T00:00:00.000Z",
  "leaseEndDate": "2024-12-31T23:59:59.999Z",
  "monthlyRent": 2200.00,
  "securityDeposit": 4400.00,
  "notes": "Rent increased for 2025",
  "deletedAt": null,
  "createdAt": "2024-11-15T10:00:00.000Z",
  "updatedAt": "2024-11-15T14:30:00.000Z"
}
```

### 5. Delete Tenant (Soft Delete)

Soft deletes a tenant by setting the `deletedAt` timestamp. The tenant remains in the database but is excluded from all queries.

**Endpoint:** `DELETE /tenants/:id`

**curl Example:**
```bash
curl -X DELETE http://localhost:3000/api/tenants/tenant-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (204 No Content)**

No response body returned on successful deletion.

### 6. List Tenants by Property

Retrieves all tenants for a specific property (excluding soft-deleted tenants). This includes both current and historical tenants.

**Endpoint:** `GET /properties/:propertyId/tenants`

**curl Example:**
```bash
curl -X GET http://localhost:3000/api/properties/property-uuid/tenants \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
[
  {
    "id": "tenant-uuid-1",
    "userId": "user-uuid",
    "personId": "person-uuid-1",
    "propertyId": "property-uuid",
    "leaseStartDate": "2024-01-01T00:00:00.000Z",
    "leaseEndDate": null,
    "monthlyRent": 2000.00,
    "notes": "Current tenant",
    "createdAt": "2024-11-15T10:00:00.000Z",
    "updatedAt": "2024-11-15T10:00:00.000Z"
  },
  {
    "id": "tenant-uuid-2",
    "userId": "user-uuid",
    "personId": "person-uuid-2",
    "propertyId": "property-uuid",
    "leaseStartDate": "2023-01-01T00:00:00.000Z",
    "leaseEndDate": "2023-12-31T23:59:59.999Z",
    "monthlyRent": 1800.00,
    "notes": "Previous tenant",
    "createdAt": "2024-11-15T10:00:00.000Z",
    "updatedAt": "2024-11-15T10:00:00.000Z"
  }
]
```

## Field Descriptions

### Person Fields (used during tenant creation)

- **firstName** (required): First name of the tenant
- **lastName** (required): Last name of the tenant
- **middleName** (optional): Middle name or initial
- **email** (required): Email address (must be valid format)
- **phone** (required): Phone number (minimum 10 digits)
- **personNotes** (optional): Additional notes about the person (e.g., contact preferences, Zelle info)

### Tenant Fields

- **propertyId** (required): UUID of the property this tenant is renting
- **leaseStartDate** (required): Start date of the lease (ISO 8601 format)
- **leaseEndDate** (optional): End date of the lease (null for month-to-month or current tenant)
- **monthlyRent** (optional): Monthly rent amount in dollars
- **securityDeposit** (optional): Security deposit amount in dollars
- **tenantNotes** (optional): Additional notes about the tenancy
- **deletedAt** (system): Timestamp when tenant was soft deleted (null for active tenants)

## Soft Delete Behavior

The Tenant API implements soft delete functionality:

1. When a tenant is deleted via `DELETE /tenants/:id`, the record is **not** removed from the database
2. Instead, the `deletedAt` field is set to the current timestamp
3. All query operations automatically filter out soft-deleted tenants:
   - `GET /tenants` - Returns only active tenants
   - `GET /tenants/:id` - Returns 404 for soft-deleted tenants
   - `PUT /tenants/:id` - Returns 404 for soft-deleted tenants
   - `GET /properties/:propertyId/tenants` - Returns only active tenants

This ensures historical data is preserved while keeping the active tenant list clean.

## Error Responses

### 400 Bad Request
Returned when validation fails:
```json
{
  "error": "Email is invalid"
}
```

### 401 Unauthorized
Returned when authentication fails or token is missing:
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
Returned when a tenant or property is not found or user doesn't have access:
```json
{
  "error": "Tenant with id tenant-uuid not found"
}
```

## Example Workflows

### Creating a New Tenant

1. First, ensure you have a property created
2. Obtain your JWT token via login
3. Call POST /tenants with tenant and person information
4. The API will:
   - Validate all input fields
   - Verify the property exists and belongs to you
   - Create a Person record
   - Create a Tenant record linked to the Person
   - Return the complete tenant object

### Finding Current Tenants

To find all current tenants (those without a lease end date or with a future end date):
1. Call GET /tenants to get all your tenants
2. Filter client-side for tenants where `leaseEndDate` is null or in the future

### Updating Rent

To update a tenant's rent:
1. Call PUT /tenants/:id with just the `monthlyRent` field
2. All other fields remain unchanged
3. The `updatedAt` timestamp is automatically updated

### Ending a Tenancy

To end a tenancy:
1. Call PUT /tenants/:id to set the `leaseEndDate`
2. Optionally, call DELETE /tenants/:id to soft delete the tenant if you want to remove them from active listings

## Notes

- All dates should be in ISO 8601 format
- Monetary amounts are stored with 2 decimal precision
- Person records are created inline during tenant creation and cannot be updated via the Tenant API
- The Person record is **not** deleted when a tenant is soft deleted
- UUIDs are auto-generated for all IDs
- All timestamps are in UTC
