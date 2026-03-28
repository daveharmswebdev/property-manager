# Story 5.1: Receipt Upload Infrastructure (S3 Presigned URLs)

Status: done
Completed: 2025-12-31

## Completion Summary

All 14 tasks completed successfully:
- AWS SDK integration with S3StorageService
- CQRS commands/queries for receipts (GenerateUploadUrl, CreateReceipt, GetReceipt, DeleteReceipt)
- ReceiptsController with all endpoints
- 38 unit tests passing
- 14 integration tests passing
- Environment configuration (.env.example, docker-compose.yml)
- Manual verification with real S3 bucket

## Story

As a developer,
I want receipt images uploaded directly to S3 via presigned URLs,
so that uploads are fast, secure, and don't burden the API server.

## Acceptance Criteria

1. **AC-5.1.1**: API generates presigned S3 upload URL
   - Endpoint `POST /api/v1/receipts/upload-url` returns a presigned S3 PUT URL
   - URL is valid for 60 minutes (configurable via settings)
   - Response includes: `uploadUrl`, `storageKey`, `expiresAt`, `httpMethod` ("PUT")
   - Storage key format: `{accountId}/{year}/{guid}.{extension}`
   - Requires JWT authentication

2. **AC-5.1.2**: Client uploads directly to S3 without passing through API
   - Frontend can PUT file bytes directly to the presigned URL
   - No multipart form data through the backend
   - S3 accepts the upload with correct Content-Type header

3. **AC-5.1.3**: Confirm upload and create receipt record
   - Endpoint `POST /api/v1/receipts` creates receipt record after S3 upload
   - Request body: `{ storageKey, originalFileName, contentType, fileSizeBytes, propertyId? }`
   - Receipt created with: AccountId (from JWT), CreatedByUserId, CreatedAt
   - PropertyId is optional (unprocessed receipts may not have a property yet)
   - Returns `{ id: "guid" }` with 201 Created

4. **AC-5.1.4**: API generates presigned download URL for viewing
   - Endpoint `GET /api/v1/receipts/{id}` returns receipt details with presigned view URL
   - Response includes `viewUrl` (presigned GET URL) valid for 60 minutes
   - Tenant isolation enforced - only receipts for user's AccountId accessible

5. **AC-5.1.5**: S3 bucket is private and secure
   - Bucket has no public access
   - Objects are encrypted at rest (S3 managed encryption)
   - Presigned URLs are the only access method
   - Credentials stored in environment variables (not in code)

6. **AC-5.1.6**: Supported file types and size limits
   - Allowed content types: `image/jpeg`, `image/png`, `application/pdf`
   - Maximum file size: 10MB (validated before generating upload URL)
   - Invalid content type returns 400 Bad Request with clear error

7. **AC-5.1.7**: Receipt can be deleted
   - Endpoint `DELETE /api/v1/receipts/{id}` soft-deletes the receipt
   - Optionally deletes the file from S3 (or marks for cleanup)
   - Returns 204 No Content on success
   - Tenant isolation enforced

## Tasks / Subtasks

- [ ] Task 1: Add AWS SDK NuGet Package (AC: 5.1.1)
  - [ ] Add `AWSSDK.S3` package to `PropertyManager.Infrastructure.csproj`
  - [ ] Verify package version compatible with .NET 10
  - [ ] Run `dotnet restore` to verify

- [ ] Task 2: Create Storage Settings and Interface (AC: 5.1.5)
  - [ ] Create `IStorageService.cs` interface in `Application/Common/Interfaces/`
    - Methods: `GeneratePresignedUploadUrlAsync()`, `GeneratePresignedDownloadUrlAsync()`, `DeleteFileAsync()`
  - [ ] Create `S3StorageSettings.cs` in `Infrastructure/Storage/`
    - Properties: `AccessKeyId`, `SecretAccessKey`, `BucketName`, `Region`, `PresignedUrlExpiryMinutes`
    - Add `SectionName = "AWS"` constant

- [ ] Task 3: Implement S3StorageService (AC: 5.1.1, 5.1.2, 5.1.4, 5.1.5)
  - [ ] Create `S3StorageService.cs` in `Infrastructure/Storage/`
  - [ ] Implement `GeneratePresignedUploadUrlAsync(string storageKey, string contentType, long fileSizeBytes)`
  - [ ] Implement `GeneratePresignedDownloadUrlAsync(string storageKey)`
  - [ ] Implement `DeleteFileAsync(string storageKey)`
  - [ ] Configure AmazonS3Client with credentials from settings
  - [ ] Handle AWS exceptions with appropriate error messages

- [ ] Task 4: Register Storage Service in DI (AC: 5.1.5)
  - [ ] Add `S3StorageSettings` configuration in `Program.cs`
  - [ ] Register `IStorageService` with `S3StorageService` implementation
  - [ ] Register in `DependencyInjection.cs` in Infrastructure layer

- [ ] Task 5: Create Upload URL Command (AC: 5.1.1, 5.1.6)
  - [ ] Create `Application/Receipts/` folder
  - [ ] Create `GenerateUploadUrl.cs` with:
    - `GenerateUploadUrlCommand(string ContentType, long FileSizeBytes, Guid? PropertyId)`
    - `GenerateUploadUrlHandler` using IStorageService and ICurrentUser
    - `UploadUrlResponse(string UploadUrl, string StorageKey, DateTime ExpiresAt, string HttpMethod)`
  - [ ] Create `GenerateUploadUrlValidator.cs` with FluentValidation
    - Validate ContentType is in allowed list
    - Validate FileSizeBytes <= 10MB

- [ ] Task 6: Create Receipt Confirmation Command (AC: 5.1.3)
  - [ ] Create `CreateReceipt.cs` with:
    - `CreateReceiptCommand(string StorageKey, string OriginalFileName, string ContentType, long FileSizeBytes, Guid? PropertyId)`
    - `CreateReceiptHandler` using AppDbContext and ICurrentUser
  - [ ] Create `CreateReceiptValidator.cs` with FluentValidation
    - Validate StorageKey is not empty
    - Validate OriginalFileName is not empty
    - Validate ContentType is in allowed list

- [ ] Task 7: Create Get Receipt Query (AC: 5.1.4)
  - [ ] Create `GetReceipt.cs` with:
    - `GetReceiptQuery(Guid Id)`
    - `GetReceiptHandler` using AppDbContext and IStorageService
    - `ReceiptDto(Guid Id, string OriginalFileName, string ContentType, long FileSizeBytes, Guid? PropertyId, Guid? ExpenseId, DateTime CreatedAt, DateTime? ProcessedAt, string ViewUrl)`
  - [ ] Generate presigned download URL for ViewUrl

- [ ] Task 8: Create Delete Receipt Command (AC: 5.1.7)
  - [ ] Create `DeleteReceipt.cs` with:
    - `DeleteReceiptCommand(Guid Id)`
    - `DeleteReceiptHandler` using AppDbContext and IStorageService
  - [ ] Soft-delete receipt record (set DeletedAt)
  - [ ] Optionally delete from S3 (or queue for cleanup)

- [ ] Task 9: Create ReceiptsController (AC: 5.1.1, 5.1.3, 5.1.4, 5.1.7)
  - [ ] Create `ReceiptsController.cs` in `Api/Controllers/`
  - [ ] `POST /api/v1/receipts/upload-url` → GenerateUploadUrlCommand
  - [ ] `POST /api/v1/receipts` → CreateReceiptCommand (returns 201 Created)
  - [ ] `GET /api/v1/receipts/{id}` → GetReceiptQuery
  - [ ] `DELETE /api/v1/receipts/{id}` → DeleteReceiptCommand (returns 204)
  - [ ] Add `[Authorize]` attribute for JWT authentication

- [ ] Task 10: Regenerate TypeScript API Client
  - [ ] Run NSwag to regenerate API client
  - [ ] Verify `UploadUrlResponse` type generated
  - [ ] Verify `ReceiptDto` type generated

- [ ] Task 11: Write Backend Unit Tests
  - [ ] `GenerateUploadUrlHandlerTests.cs`:
    - [ ] Generates valid presigned URL
    - [ ] Rejects invalid content type
    - [ ] Rejects file size over 10MB
    - [ ] Includes correct storage key format
  - [ ] `CreateReceiptHandlerTests.cs`:
    - [ ] Creates receipt with correct AccountId
    - [ ] Creates receipt without PropertyId
    - [ ] Creates receipt with PropertyId
  - [ ] `GetReceiptHandlerTests.cs`:
    - [ ] Returns receipt with presigned view URL
    - [ ] Throws NotFoundException for invalid ID
    - [ ] Enforces tenant isolation
  - [ ] `DeleteReceiptHandlerTests.cs`:
    - [ ] Soft-deletes receipt
    - [ ] Enforces tenant isolation

- [ ] Task 12: Write Backend Integration Tests
  - [ ] `ReceiptsControllerTests.cs`:
    - [ ] POST /upload-url returns presigned URL
    - [ ] POST /upload-url rejects invalid content type
    - [ ] POST /receipts creates receipt
    - [ ] GET /receipts/{id} returns receipt with view URL
    - [ ] DELETE /receipts/{id} soft-deletes
    - [ ] Unauthorized requests return 401
    - [ ] Account isolation enforced

- [ ] Task 13: Environment Configuration
  - [ ] Update `.env.example` with AWS settings (already has placeholders)
  - [ ] Add environment variables to local development setup
  - [ ] Document configuration in README or dev notes

- [ ] Task 14: Manual Verification
  - [ ] All backend tests pass (`dotnet test`)
  - [ ] API endpoints work in Swagger
  - [ ] Presigned URL upload works with curl/Postman
  - [ ] Presigned URL download works
  - [ ] Tenant isolation verified

## Dev Notes

### Architecture Patterns and Constraints

**Backend Clean Architecture:**
- Application Layer: Commands/Queries in `Receipts/` folder
- Infrastructure Layer: `S3StorageService` implements `IStorageService` interface
- Dependency injection via `Program.cs` and `DependencyInjection.cs`
- Use MediatR for command/query dispatch
- Global query filters enforce AccountId tenant isolation

**S3 Presigned URL Pattern (ADR-004):**
```
Client requests upload URL → API generates presigned PUT URL
Client PUTs file directly to S3 → No backend involvement
Client confirms upload → API creates receipt record
```

**Storage Key Format:**
```
{accountId}/{year}/{guid}.{extension}
Example: a1b2c3d4-e5f6/2025/f47ac10b-58cc-4372-a567-0e02b2c3d479.jpg
```

**IStorageService Interface:**
```csharp
public interface IStorageService
{
    Task<UploadUrlResult> GeneratePresignedUploadUrlAsync(
        string storageKey,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default);

    Task<string> GeneratePresignedDownloadUrlAsync(
        string storageKey,
        CancellationToken cancellationToken = default);

    Task DeleteFileAsync(
        string storageKey,
        CancellationToken cancellationToken = default);
}

public record UploadUrlResult(string Url, DateTime ExpiresAt);
```

**S3StorageSettings:**
```csharp
public class S3StorageSettings
{
    public const string SectionName = "AWS";

    public string AccessKeyId { get; set; } = string.Empty;
    public string SecretAccessKey { get; set; } = string.Empty;
    public string BucketName { get; set; } = string.Empty;
    public string Region { get; set; } = "us-east-1";
    public int PresignedUrlExpiryMinutes { get; set; } = 60;
}
```

**API Contracts:**
```
POST /api/v1/receipts/upload-url
Request:
{
  "contentType": "image/jpeg",
  "fileSizeBytes": 2048576,
  "propertyId": "optional-guid"
}

Response: 200 OK
{
  "uploadUrl": "https://bucket.s3.amazonaws.com/...",
  "storageKey": "accountId/2025/guid.jpg",
  "expiresAt": "2025-01-15T11:30:00Z",
  "httpMethod": "PUT"
}
```

```
POST /api/v1/receipts
Request:
{
  "storageKey": "accountId/2025/guid.jpg",
  "originalFileName": "receipt-123.jpg",
  "contentType": "image/jpeg",
  "fileSizeBytes": 2048576,
  "propertyId": "optional-guid"
}

Response: 201 Created
{
  "id": "new-receipt-guid"
}
Location: /api/v1/receipts/new-receipt-guid
```

```
GET /api/v1/receipts/{id}

Response: 200 OK
{
  "id": "guid",
  "originalFileName": "receipt-123.jpg",
  "contentType": "image/jpeg",
  "fileSizeBytes": 2048576,
  "propertyId": "optional-guid",
  "expenseId": null,
  "createdAt": "2025-01-15T10:30:00Z",
  "processedAt": null,
  "viewUrl": "https://bucket.s3.amazonaws.com/..."
}
```

```
DELETE /api/v1/receipts/{id}

Response: 204 No Content
```

### Project Structure Notes

**Backend files to create:**
```
backend/src/PropertyManager.Application/Common/Interfaces/
    └── IStorageService.cs

backend/src/PropertyManager.Application/Receipts/
    ├── GenerateUploadUrl.cs
    ├── CreateReceipt.cs
    ├── GetReceipt.cs
    ├── DeleteReceipt.cs
    └── Dtos/
        ├── UploadUrlResponse.cs
        └── ReceiptDto.cs

backend/src/PropertyManager.Infrastructure/Storage/
    ├── S3StorageService.cs
    └── S3StorageSettings.cs

backend/src/PropertyManager.Api/Controllers/
    └── ReceiptsController.cs

backend/tests/PropertyManager.Application.Tests/Receipts/
    ├── GenerateUploadUrlHandlerTests.cs
    ├── CreateReceiptHandlerTests.cs
    ├── GetReceiptHandlerTests.cs
    └── DeleteReceiptHandlerTests.cs

backend/tests/PropertyManager.Api.Tests/
    └── ReceiptsControllerTests.cs
```

**Backend files to modify:**
```
backend/src/PropertyManager.Infrastructure/PropertyManager.Infrastructure.csproj
    # Add AWSSDK.S3 package

backend/src/PropertyManager.Infrastructure/DependencyInjection.cs
    # Register IStorageService with S3StorageService

backend/src/PropertyManager.Api/Program.cs
    # Configure S3StorageSettings
```

### What Already Exists

**Receipt Entity (Domain Layer):**
- `Receipt.cs` with all required properties
- `StorageKey`, `OriginalFileName`, `ContentType`, `FileSizeBytes`
- `AccountId`, `PropertyId`, `CreatedByUserId`, `ExpenseId`
- Soft delete via `DeletedAt`

**EF Core Configuration (Infrastructure Layer):**
- `ReceiptConfiguration.cs` fully configured
- `DbSet<Receipt> Receipts` in AppDbContext
- Global query filter for tenant isolation and soft delete

**Environment Variables (already in .env.example):**
```
AWS__AccessKeyId=your_access_key
AWS__SecretAccessKey=your_secret_key
AWS__BucketName=property-manager-receipts
AWS__Region=us-east-1
```

**Expense Entity Integration:**
- `Expense.ReceiptId` nullable foreign key exists
- Ready for linking in Story 5.4

### Learnings from Previous Stories

**From Story 4.4 (Dashboard Income and Net Income Totals):**
- Follow existing controller patterns (DashboardController, ExpensesController)
- Use `[Authorize(AuthenticationSchemes = JwtBearerDefaults.AuthenticationScheme)]`
- Return 201 Created with Location header for create operations
- Follow existing test patterns in `PropertyManager.Api.Tests/`

**From Story 3.1 (Expense Workspace):**
- MediatR command/query pattern is established
- FluentValidation is registered automatically via pipeline behavior
- ICurrentUser provides AccountId and UserId from JWT

**Existing Service Registration Pattern:**
```csharp
// In DependencyInjection.cs
services.Configure<S3StorageSettings>(configuration.GetSection(S3StorageSettings.SectionName));
services.AddScoped<IStorageService, S3StorageService>();
```

### Testing Strategy

**Unit Tests (xUnit):**
- Mock `IStorageService` for handler tests
- Mock `AppDbContext` for CRUD operations
- Mock `ICurrentUser` for tenant context
- Test validation rules (content type, file size)

**Integration Tests (xUnit):**
- Use mock S3 or LocalStack for storage tests
- Test full request/response cycle
- Verify tenant isolation
- Verify 401 for unauthorized requests

**Manual Verification Checklist:**
```markdown
## Smoke Test: Receipt Upload Infrastructure

### API Verification
- [ ] POST /upload-url returns presigned URL with correct format
- [ ] Presigned URL works with curl PUT
- [ ] POST /receipts creates record in database
- [ ] GET /receipts/{id} returns receipt with viewUrl
- [ ] DELETE /receipts/{id} soft-deletes receipt
- [ ] Unauthorized requests return 401
- [ ] Invalid content type returns 400
- [ ] File size over 10MB returns 400

### Database Verification
- [ ] Receipt record created with correct AccountId
- [ ] Receipt record has correct StorageKey format
- [ ] Soft delete sets DeletedAt timestamp
- [ ] Query filters exclude deleted receipts

### S3 Verification
- [ ] File uploads successfully via presigned URL
- [ ] File accessible via presigned download URL
- [ ] Bucket is private (no public access)
- [ ] Storage key matches expected format
```

### AWS S3 Setup Notes

**Bucket Policy (for reference - not in code):**
- Private bucket, no public access
- IAM user with minimal permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
- Server-side encryption enabled (AES-256 or KMS)

**CORS Configuration (if frontend uploads directly):**
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["http://localhost:4200", "https://your-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-004: S3 Direct Upload]
- [Source: _bmad-output/planning-artifacts/architecture.md#Receipt Storage]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Contracts - Receipts]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1: Receipt Upload Infrastructure]
- [Source: backend/src/PropertyManager.Domain/Entities/Receipt.cs]
- [Source: backend/src/PropertyManager.Infrastructure/Persistence/Configurations/ReceiptConfiguration.cs]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

