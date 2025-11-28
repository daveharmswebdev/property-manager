# 🚀 UPKEEP.IO Documentation - START HERE

## Project Overview

Upkeep.io is a property management system built to track maintenance activities, expenses, and vendors across rental property portfolios. This project demonstrates enterprise-grade engineering practices with Clean Architecture, SOLID principles, and maximum code reuse through a monorepo structure.

**Architecture Health Score: 8.8/10** (November 2024 Assessment)

## Quick Navigation

### 🎯 By Goal

**"I want to..."**

- **Learn from this project's lessons** → [📚 Lessons Learned](lessons-learned/README.md)
- **Deploy the application** → [🚀 Render Deployment Guide](guides/deployment/render-deployment.md)
- **Understand the architecture** → [🏗️ Clean Architecture Guide](guides/architecture/clean-architecture.md)
- **Add a new feature** → [➕ Feature Implementation Template](workflows/add-feature-template.md)
- **Fix a deployment issue** → [🔧 Troubleshooting Guide](guides/deployment/troubleshooting.md)
- **Set up local development** → [💻 Local Setup](guides/development/local-setup.md)
- **Review the domain model** → [📊 Domain Model](guides/architecture/domain-model.md)

### 📁 By Category

1. **[Lessons Learned](lessons-learned/README.md)** - Hard-won wisdom from building this system
2. **[Guides](guides/)** - How-to documentation for common tasks
3. **[Workflows](workflows/)** - Step-by-step implementation processes
4. **[Reference](reference/)** - Technical specifications and API docs
5. **[Archive](archive/)** - Historical documentation for context

## Tech Stack

### Core Technologies
- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Vue 3 (Composition API) + Vite
- **Database:** PostgreSQL with Prisma ORM
- **Deployment:** Render (formerly Railway)
- **Architecture:** Clean Architecture with Domain-Driven Design

### Key Architectural Decisions
- **Monorepo with npm workspaces** - Maximum code reuse
- **Shared validation schemas** - Single source of truth
- **Dependency Injection (inversify)** - Testable, swappable implementations
- **Domain-first design** - Business logic independent of framework

## Project Statistics

- **Lines of Code:** ~8,500
- **Test Coverage:** 100% unit tests on use cases and utilities
- **Shared Code:** 3 libraries (domain, validators, auth)
- **API Endpoints:** 15+ RESTful endpoints
- **Database Tables:** 7 core entities

## Key Achievements

✅ **Zero code duplication** through shared libraries
✅ **SOLID principles** properly implemented throughout
✅ **Clean Architecture** with proper layer separation
✅ **100% test coverage** on business logic
✅ **Production-ready** with full CI/CD pipeline
✅ **Extensible design** ready for new features

## Quick Start Guides

### For New Developers
1. Start with [Local Setup Guide](guides/development/local-setup.md)
2. Review [Clean Architecture Guide](guides/architecture/clean-architecture.md)
3. Study the [Property Workflow](workflows/add-property.md) as reference implementation
4. Use [Feature Template](workflows/add-feature-template.md) for new features

### For DevOps/Deployment
1. Read [Deployment Lessons Learned](lessons-learned/deployment-lessons.md)
2. Follow [Render Deployment Guide](guides/deployment/render-deployment.md)
3. Review [Branch Protection Setup](guides/deployment/github-branch-protection.md)
4. Keep [Troubleshooting Guide](guides/deployment/troubleshooting.md) handy

### For Architects/Tech Leads
1. Review [Architecture Decisions](lessons-learned/architecture-decisions.md)
2. Understand [Domain Model](guides/architecture/domain-model.md)
3. Check [Testing Strategies](lessons-learned/testing-strategies.md)

## Most Important Lessons

### 🎯 Top 5 Lessons for Future Projects

1. **Start with shared validation** - Having Zod schemas in shared libraries from day one prevents countless bugs and ensures frontend/backend consistency.

2. **Database URLs have formats** - Flyway needs JDBC format (`jdbc:postgresql://`), not standard PostgreSQL URLs. This caused hours of debugging.

3. **Plan for pagination early** - Adding pagination after the fact is harder than building it from the start.

4. **Integration tests catch what unit tests miss** - API contract changes, middleware issues, and database transaction problems only show up in integration tests.

5. **Document deployment immediately** - Every deployment issue and solution should be documented as it happens. Memory fades, but logs persist.

## Development Principles

### "Use What's in the Pantry"
Before writing new code, always check:
1. Frontend utilities (`apps/frontend/src/utils/`)
2. Shared libraries (`@domain/*`, `@validators/*`, `@auth/*`)
3. Existing patterns in similar features

### DRY Through Shared Libraries
- Validation schemas shared between frontend (VeeValidate) and backend (use cases)
- Domain entities used across all layers
- Single source of truth for types and business rules

### Clean Architecture Benefits
- **Swappable implementations** - Could switch from Prisma to MongoDB with zero business logic changes
- **Testable use cases** - Business logic tested without database or framework
- **Clear boundaries** - Each layer has distinct responsibilities

## Common Commands

```bash
# Development
npm run dev                    # Start all services
npm run dev:backend           # Backend only
npm run dev:frontend          # Frontend only

# Database
npm run migrate:dev           # Create and apply migrations
npm run generate              # Regenerate Prisma client

# Testing
npm test                      # Run all tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests

# Production
npm run build                # Build all packages
npm run start               # Start production server
```

## Project Timeline

- **Nov 2024**: Initial buildout, Railway deployment
- **Nov 2024**: Migration from Railway to Render
- **Nov 2024**: Architecture assessment (8.8/10 score)
- **Future**: Maintenance tracking, tenant portal, multi-tenancy

## Where to Go Next

👉 **Most developers should start with:** [Lessons Learned](lessons-learned/README.md)

This will give you the condensed wisdom from building this system, helping you avoid common pitfalls and apply proven patterns in your next project.

---

*Documentation reorganized November 2024 with focus on lessons learned for professional development*