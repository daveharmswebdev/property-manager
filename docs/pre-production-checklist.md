# Pre-Production Checklist: Upkeep SaaS

> Living checklist for production readiness. Work through incrementally—not a launch-day panic list.

## Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## 1. Infrastructure & Reliability

### Hosting & Environments
- [ ] Production environment on Render (upkeep-io.com)
- [ ] Staging environment on Render (upkeep-io.dev) - currently in use
- [ ] Environment variables documented and secured (not in repo)
- [ ] Custom domains configured with SSL (Render handles certs)
- [ ] CDN for static assets (Render CDN or Cloudflare)

### Database
- [ ] Render Pro PostgreSQL ($20/mo) for point-in-time recovery
- [ ] Automated daily backups verified
- [ ] Manual backup process documented (pre-risky-deploy)
- [ ] Connection pooling configured (PgBouncer or Render's built-in)
- [ ] Database migration rollback strategy documented

### High Availability
- [x] Health check endpoint (`/health` or `/api/health`)
- [ ] Render zero-downtime deploys enabled
- [ ] Auto-restart on crash configured
- [ ] Rate limiting on API endpoints

---

## 2. Security

### Authentication & Authorization
- [x] JWT authentication implemented
- [x] Token refresh mechanism working
- [ ] Password reset flow tested end-to-end
- [x] Account lockout after failed attempts
- [x] Session timeout configured appropriately

### Application Security
- [x] CodeQL scanning enabled
- [x] Dependabot enabled
- [x] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] CORS properly restricted to known origins
- [x] SQL injection protection verified (EF Core parameterization)
- [x] XSS protection verified (Angular's built-in sanitization)
- [x] CSRF protection for state-changing operations
- [ ] Secrets rotated from development values
- [ ] API rate limiting per user/IP

### Data Protection
- [ ] Sensitive data encrypted at rest (Render PostgreSQL default)
- [ ] PII handling documented
- [ ] Data retention policy defined
- [ ] User data export capability (GDPR/CCPA)
- [ ] User data deletion capability (GDPR/CCPA)

---

## 3. Monitoring & Observability

### Error Tracking
- [ ] Error tracking service integrated (Sentry recommended)
- [ ] Unhandled exceptions captured with context
- [ ] Frontend errors captured
- [ ] Error alerting configured (email/Slack)

### Logging
- [x] Structured logging implemented (Serilog)
- [x] Log levels appropriate (no sensitive data in logs)
- [ ] Log aggregation service (Render logs, or Papertrail/Logtail)
- [ ] Log retention policy set

### Metrics & Uptime
- [ ] Uptime monitoring (UptimeRobot, Pingdom, or Better Uptime - free tiers available)
- [ ] Response time tracking
- [ ] Database query performance monitoring
- [ ] Alerting for downtime (SMS/email)

### Health Checks
- [x] `/api/health` endpoint returns system status
- [ ] Database connectivity check included
- [ ] External service checks (email, etc.)

---

## 4. Performance

### Backend
- [ ] Response times acceptable (<500ms for API calls)
- [ ] N+1 query issues identified and fixed
- [ ] Database indexes on frequently queried columns
- [ ] Pagination on list endpoints
- [ ] Async operations where appropriate

### Frontend
- [ ] Lighthouse score >80 (Performance, Accessibility, Best Practices, SEO)
- [ ] Bundle size analyzed and optimized
- [ ] Lazy loading for feature modules
- [ ] Image optimization
- [ ] Caching headers configured

### Load Testing
- [ ] Basic load test performed (k6, Artillery, or similar)
- [ ] Concurrent user capacity known
- [ ] Database connection limits tested

---

## 5. Release Process

### Versioning & Changelog
- [ ] Versioning strategy decided (SemVer or CalVer)
- [ ] Conventional commits adopted
- [ ] Changelog automation configured (release-please or similar)
- [ ] GitHub Releases used for production deploys
- [ ] Public changelog page at upkeep-io.com/changelog (nice-to-have)

### Deployment
- [ ] Deployment runbook documented
- [ ] Rollback procedure documented and tested
- [ ] Database migration procedure documented
- [ ] Pre-deploy checklist (backup DB, notify if needed)
- [ ] Post-deploy verification checklist

### CI/CD
- [x] CI pipeline with tests (backend, frontend, e2e)
- [x] Docker build verification
- [ ] Staging auto-deploy from main branch
- [ ] Production deploy from git tags (manual trigger)
- [ ] Deploy notifications (Slack/Discord)

---

## 6. Legal & Compliance

### Legal Documents
- [ ] Terms of Service drafted
- [ ] Privacy Policy drafted (GDPR/CCPA compliant)
- [ ] Cookie policy (if using cookies beyond essential)
- [ ] Acceptable Use Policy (optional but recommended)
- [ ] Legal review completed (can use services like Termly, Iubenda for templates)

### Business Entity
- [x] Business entity formed (LLC recommended) — UPKEEP DEVELOPMENT LLC (Tennessee)
- [ ] Business bank account
- [ ] EIN obtained (if US)
- [ ] Business insurance considered (optional for MVP)

### Compliance
- [ ] GDPR compliance if serving EU customers
- [ ] CCPA compliance if serving CA customers
- [ ] Data processing agreements with third parties
- [ ] Accessibility compliance (WCAG 2.1 AA target)

---

## 7. Payments & Billing

### Payment Processing
- [ ] Stripe account created and verified
- [ ] Subscription plans defined
- [ ] Pricing page designed
- [ ] Payment flow tested end-to-end
- [ ] Webhook handlers for subscription events
- [ ] Failed payment handling (dunning)
- [ ] Invoice generation
- [ ] Refund process documented

### Subscription Management
- [ ] Plan upgrade/downgrade flow
- [ ] Cancellation flow (with feedback collection)
- [ ] Trial period configured (if offering)
- [ ] Usage limits enforced per plan
- [ ] Grace period for failed payments

---

## 8. Customer Operations

### Support
- [ ] Support email configured (support@upkeep-io.com)
- [ ] Help documentation / FAQ started
- [ ] Support ticket system (can start with email, graduate to Intercom/Zendesk)
- [ ] Response time expectations set

### Onboarding
- [ ] New user onboarding flow designed
- [ ] Welcome email configured
- [ ] Sample data or guided setup
- [ ] Video walkthrough (nice-to-have)

### Communication
- [ ] Transactional email service (SendGrid, Postmark, Resend)
- [ ] Email templates designed (welcome, password reset, receipts)
- [ ] Email deliverability tested (SPF, DKIM, DMARC)
- [ ] Status page for outages (Instatus, Statuspage - free tiers available)

---

## 9. Analytics & Business Intelligence

### Product Analytics
- [ ] Analytics service integrated (Plausible, PostHog, or GA4)
- [ ] Key user actions tracked
- [ ] Conversion funnel defined
- [ ] User retention tracking

### Business Metrics
- [ ] MRR tracking
- [ ] Churn tracking
- [ ] Customer acquisition source tracking

---

## 10. Launch Readiness

### Pre-Launch
- [ ] Beta testers recruited (5-10 real users)
- [ ] Beta feedback collected and addressed
- [ ] Launch marketing planned (landing page, social, PH)
- [ ] Backup and recovery tested
- [ ] All secrets rotated to production values

### Launch Day
- [ ] Database backed up
- [ ] Team available for monitoring (just you!)
- [ ] Support channels monitored
- [ ] Rollback procedure ready

### Post-Launch
- [ ] Monitoring dashboards reviewed daily (first week)
- [ ] User feedback channels open
- [ ] Quick iteration plan for critical issues

---

## Execution Strategy

> Phased approach prioritized by **risk, dependencies, and revenue gates** — not just effort. Each phase has a clear gate: what must be true before you cross it.

### Key Dependency Chains (Do Not Ignore)

These items have sequential dependencies — starting late on the first link delays everything downstream:

1. **LLC → EIN → Bank Account → Stripe Account → Payment Flow**
   Calendar time: 4-8 weeks end-to-end. Start during Phase 2 even though Stripe is Phase 3.

2. **SendGrid Setup → Password Reset Flow → Email Templates → SPF/DKIM/DMARC**
   Transactional email is infrastructure, not polish. Password reset doesn't work without it.

3. **Pro PostgreSQL → Automated Backups → Manual Backup Docs → Pre-Deploy Checklist**
   No backups + real user data = catastrophic. This is Phase 1, not Phase 3.

4. **Health Endpoint → Uptime Monitoring → Alerting for Downtime**
   You can't monitor what doesn't expose its status.

### Cost Summary

| Phase | Monthly Cost | One-Time Cost |
|-------|-------------|---------------|
| Phase 1 | ~$20/mo (Pro PostgreSQL) | $0 |
| Phase 2 | ~$0 (free tiers) | $50-500 (LLC filing) + ~$12/yr (domain) |
| Phase 3 | ~$10-20/mo (legal templates) | Stripe: 2.9% + $0.30/txn (no monthly) |
| Phase 4 | ~$0-20/mo (optional upgrades) | $0 |

---

### Phase 1 — Before Beta Users (Harden & Observe)

**Gate:** No real user should touch this app until these are done.
**Theme:** If it breaks or leaks, you need to know immediately and it shouldn't be exploitable.
**Cost:** ~$20/mo | **Effort:** ~2 sprints of focused work

#### Security Hardening (§2) — Free, Code-Only
- [x] Token refresh mechanism working
- [x] Account lockout after failed attempts
- [x] Session timeout configured appropriately
- [x] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] CORS properly restricted to known origins
- [x] SQL injection protection verified (EF Core parameterization)
- [x] XSS protection verified (Angular's built-in sanitization)
- [x] CSRF protection for state-changing operations
- [ ] API rate limiting per user/IP

#### Observability (§3) — Free Tiers
- [ ] Sentry error tracking integrated (free tier: 5K events/mo)
- [ ] Unhandled exceptions captured with context
- [ ] Frontend errors captured
- [ ] Error alerting configured (email)
- [x] Structured logging implemented (Serilog)
- [x] Log levels appropriate (no sensitive data in logs)
- [ ] UptimeRobot configured (free tier: 50 monitors)
- [ ] Alerting for downtime (email)

#### Infrastructure (§1) — $20/mo
- [x] Health check endpoint (`/api/health`) with DB connectivity check
- [ ] Render zero-downtime deploys enabled
- [ ] Auto-restart on crash configured
- [ ] Render Pro PostgreSQL ($20/mo) for point-in-time recovery
- [ ] Automated daily backups verified
- [ ] Connection pooling configured (PgBouncer or Render's built-in)

#### Quick Performance Wins (§4) — Free
- [ ] Database indexes on frequently queried columns
- [ ] Pagination on list endpoints
- [ ] Lazy loading for feature modules

#### Release Process Foundation (§5) — Free
- [ ] Versioning strategy decided (SemVer recommended)
- [ ] Conventional commits adopted
- [ ] Staging auto-deploy from main branch

#### Email Infrastructure (§8) — Free Tier
- [ ] Transactional email service configured (SendGrid: 100 emails/day free)
- [ ] Password reset flow tested end-to-end (§2 — depends on email)

---

### Phase 2 — During Beta (Calendar-Time Items, Run in Parallel)

**Gate:** Start these as soon as Phase 1 begins. They run on *calendar time*, not dev time.
**Theme:** Legal, business, and environment setup that takes weeks of waiting.
**Cost:** $50-500 one-time (LLC) + ~$12/yr (domain) | **Effort:** Paperwork + ~1 sprint

#### Business Entity (§6) — START IMMEDIATELY
> These take 2-6 weeks of calendar time. If you wait until Phase 3, Stripe is blocked.

- [x] Business entity formed (LLC recommended) — UPKEEP DEVELOPMENT LLC (Tennessee)
- [ ] EIN obtained (if US)
- [ ] Business bank account (needs LLC + EIN first)

#### Legal Documents (§6) — Draft During Beta
- [ ] Terms of Service drafted
- [ ] Privacy Policy drafted (GDPR/CCPA compliant)
- [ ] Cookie policy (if using cookies beyond essential)
- [ ] Legal review completed (Termly or Iubenda for templates)

#### Environment Setup (§1)
- [ ] Staging environment on Render (upkeep-io.dev)
- [ ] Production environment on Render (upkeep-io.com)
- [ ] Environment variables documented and secured (not in repo)
- [ ] Custom domains configured with SSL (Render handles certs)

#### Deployment Readiness (§5)
- [ ] Deployment runbook documented
- [ ] Rollback procedure documented and tested
- [ ] Database migration procedure documented
- [ ] Manual backup process documented (pre-risky-deploy)
- [ ] Pre-deploy checklist (backup DB, notify if needed)
- [ ] Post-deploy verification checklist

#### Customer Ops Foundation (§8)
- [ ] Support email configured (support@upkeep-io.com)
- [ ] Help documentation / FAQ started
- [ ] Email templates designed (welcome, password reset, receipts)
- [ ] Email deliverability tested (SPF, DKIM, DMARC)

#### Beta Validation (§10)
- [ ] Beta testers recruited (5-10 real users)
- [ ] Beta feedback collected and addressed

---

### Phase 3 — Before Paid Launch (Money & Compliance)

**Gate:** No money changes hands until ALL of these are complete.
**Theme:** Payment infrastructure, compliance, and production hardening.
**Cost:** Stripe per-txn + ~$10-20/mo (legal templates) | **Effort:** ~2-3 sprints

#### Payments (§7) — Requires LLC + Bank Account from Phase 2
- [ ] Stripe account created and verified
- [ ] Subscription plans defined
- [ ] Pricing page designed
- [ ] Payment flow tested end-to-end
- [ ] Webhook handlers for subscription events
- [ ] Failed payment handling (dunning)
- [ ] Invoice generation
- [ ] Refund process documented
- [ ] Plan upgrade/downgrade flow
- [ ] Cancellation flow (with feedback collection)
- [ ] Trial period configured (if offering)
- [ ] Usage limits enforced per plan
- [ ] Grace period for failed payments

#### Data Protection & Compliance (§2, §6)
- [ ] Secrets rotated from development values
- [ ] Sensitive data encrypted at rest (Render PostgreSQL default)
- [ ] PII handling documented
- [ ] Data retention policy defined
- [ ] User data export capability (GDPR/CCPA)
- [ ] User data deletion capability (GDPR/CCPA)
- [ ] CCPA compliance if serving CA customers
- [ ] GDPR compliance if serving EU customers
- [ ] Data processing agreements with third parties

#### Load & Performance Verification (§4)
- [ ] Basic load test performed (k6 or Artillery)
- [ ] Concurrent user capacity known
- [ ] Database connection limits tested
- [ ] Response times acceptable (<500ms for API calls)
- [ ] N+1 query issues identified and fixed

#### Production Release Pipeline (§5)
- [ ] Changelog automation configured (release-please or similar)
- [ ] GitHub Releases used for production deploys
- [ ] Production deploy from git tags (manual trigger)

#### Launch Prep (§10)
- [ ] All secrets rotated to production values
- [ ] Backup and recovery tested
- [ ] Database backed up
- [ ] Rollback procedure ready

---

### Phase 4 — Post-Launch Iteration (Polish & Optimize)

**Gate:** Revenue is flowing. Now optimize and professionalize.
**Theme:** These make the product *better* but aren't launch blockers.
**Cost:** Mostly free tiers | **Effort:** Ongoing

#### Performance Optimization (§4)
- [ ] Lighthouse score >80 (Performance, Accessibility, Best Practices, SEO)
- [ ] Bundle size analyzed and optimized
- [ ] Image optimization
- [ ] Caching headers configured
- [ ] Async operations where appropriate

#### Advanced Monitoring (§3)
- [ ] Log aggregation service (Papertrail/Logtail)
- [ ] Log retention policy set
- [ ] Response time tracking
- [ ] Database query performance monitoring

#### Infrastructure Polish (§1)
- [ ] CDN for static assets (Cloudflare free tier)
- [ ] Database migration rollback strategy documented

#### Release Polish (§5)
- [ ] Public changelog page at upkeep-io.com/changelog
- [ ] Deploy notifications (Slack/Discord)

#### Customer Experience (§8)
- [ ] Support ticket system (graduate from email to Intercom/Zendesk)
- [ ] Response time expectations set
- [ ] New user onboarding flow designed
- [ ] Welcome email configured
- [ ] Sample data or guided setup
- [ ] Video walkthrough
- [ ] Status page for outages (Instatus free tier)

#### Analytics & Business Intelligence (§9)
- [ ] Analytics service integrated (Plausible or PostHog free tier)
- [ ] Key user actions tracked
- [ ] Conversion funnel defined
- [ ] User retention tracking
- [ ] MRR tracking
- [ ] Churn tracking
- [ ] Customer acquisition source tracking

#### Remaining Legal & Compliance (§6)
- [ ] Acceptable Use Policy
- [ ] Business insurance considered (optional for MVP)
- [ ] Accessibility compliance (WCAG 2.1 AA target)

#### Post-Launch Ops (§10)
- [ ] Team available for monitoring (just you!)
- [ ] Support channels monitored
- [ ] Monitoring dashboards reviewed daily (first week)
- [ ] User feedback channels open
- [ ] Quick iteration plan for critical issues
- [ ] Launch marketing planned (landing page, social, PH)

---

*Last updated: 2026-02-07*
*Owner: Dave*
