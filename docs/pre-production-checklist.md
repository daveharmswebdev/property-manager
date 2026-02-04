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
- [ ] Health check endpoint (`/health` or `/api/health`)
- [ ] Render zero-downtime deploys enabled
- [ ] Auto-restart on crash configured
- [ ] Rate limiting on API endpoints

---

## 2. Security

### Authentication & Authorization
- [x] JWT authentication implemented
- [ ] Token refresh mechanism working
- [ ] Password reset flow tested end-to-end
- [ ] Account lockout after failed attempts
- [ ] Session timeout configured appropriately

### Application Security
- [x] CodeQL scanning enabled
- [x] Dependabot enabled
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] CORS properly restricted to known origins
- [ ] SQL injection protection verified (EF Core parameterization)
- [ ] XSS protection verified (Angular's built-in sanitization)
- [ ] CSRF protection for state-changing operations
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
- [ ] Structured logging implemented (Serilog)
- [ ] Log levels appropriate (no sensitive data in logs)
- [ ] Log aggregation service (Render logs, or Papertrail/Logtail)
- [ ] Log retention policy set

### Metrics & Uptime
- [ ] Uptime monitoring (UptimeRobot, Pingdom, or Better Uptime - free tiers available)
- [ ] Response time tracking
- [ ] Database query performance monitoring
- [ ] Alerting for downtime (SMS/email)

### Health Checks
- [ ] `/api/health` endpoint returns system status
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
- [ ] Business entity formed (LLC recommended)
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

## Priority Order Suggestion

**Do Now (Development Phase):**
1. Health check endpoint
2. Structured logging
3. Versioning/conventional commits
4. Security headers

**Do Before Beta:**
1. Error tracking (Sentry)
2. Uptime monitoring
3. Staging/Production environment split
4. Basic load testing

**Do Before Paid Launch:**
1. Everything in Security section
2. Stripe integration
3. Legal documents
4. Pro PostgreSQL with backups
5. Rollback runbook

---

*Last updated: 2026-02-03*
*Owner: Dave*
