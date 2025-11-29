# Property Manager

A web application that transforms paper-based rental property expense tracking into organized, tax-ready Schedule E reports.

## Technology Stack

- **Frontend:** Angular 21 + @ngrx/signals + Angular Material
- **Backend:** .NET 10 + ASP.NET Core + Clean Architecture + CQRS/MediatR
- **Database:** PostgreSQL 16 + EF Core 10
- **API Client Generation:** NSwag

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 22 LTS](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Angular CLI](https://angular.io/cli) (`npm install -g @angular/cli`)

## Quick Start

### 1. Start Infrastructure

```bash
# Start PostgreSQL and MailHog
docker compose up -d db mailhog
```

### 2. Run Backend

```bash
cd backend
dotnet restore
dotnet ef database update --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api
dotnet run --project src/PropertyManager.Api
```

API will be available at: http://localhost:5000
Swagger UI: http://localhost:5000/swagger

### 3. Run Frontend

```bash
cd frontend
npm install
ng serve
```

Web app will be available at: http://localhost:4200

### 4. Access Services

| Service | URL |
|---------|-----|
| Web App | http://localhost:4200 |
| API | http://localhost:5000 |
| Swagger | http://localhost:5000/swagger |
| MailHog | http://localhost:8025 |
| PostgreSQL | localhost:5432 |

## Project Structure

```
property-manager/
├── backend/
│   ├── src/
│   │   ├── PropertyManager.Domain/        # Entities, value objects, interfaces
│   │   ├── PropertyManager.Application/   # Commands, queries, handlers
│   │   ├── PropertyManager.Infrastructure/# EF Core, persistence, identity
│   │   └── PropertyManager.Api/           # Controllers, middleware
│   ├── tests/
│   │   ├── PropertyManager.Domain.Tests/
│   │   ├── PropertyManager.Application.Tests/
│   │   └── PropertyManager.Api.Tests/
│   ├── Dockerfile
│   └── PropertyManager.sln
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/          # Auth, API services
│   │   │   ├── shared/        # Reusable components
│   │   │   └── features/      # Feature modules
│   │   ├── styles/
│   │   └── assets/
│   ├── e2e/
│   ├── Dockerfile
│   └── angular.json
├── postman/
│   ├── PropertyManager.postman_collection.json
│   └── environments/
├── docker-compose.yml
└── README.md
```

## Development

### Generate TypeScript API Client

```bash
cd frontend
npm run generate-api
```

### Run Tests

```bash
# Backend tests
cd backend
dotnet test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run e2e
```

### Database Migrations

```bash
cd backend

# Create migration
dotnet ef migrations add <MigrationName> --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api

# Apply migrations
dotnet ef database update --project src/PropertyManager.Infrastructure --startup-project src/PropertyManager.Api
```

## Environment Variables

See `.env.example` for required environment variables.

## License

Private - All rights reserved.
