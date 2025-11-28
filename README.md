# Props.io

Props.io is a property management system built to track maintenance activities, expenses, and vendors across rental property portfolios. This project demonstrates enterprise-grade engineering practices with Clean Architecture, SOLID principles, and maximum code reuse through a monorepo structure.

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

