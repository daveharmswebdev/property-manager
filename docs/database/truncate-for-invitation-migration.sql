-- TRUNCATE SCRIPT FOR INVITATION-ONLY MIGRATION
-- Run this on the Render PostgreSQL database BEFORE deploying the new code
-- The OwnerAccountSeeder will recreate the owner account on first startup
--
-- WARNING: This deletes ALL user data. Only run on databases you want to reset.

-- Disable FK constraints temporarily (PostgreSQL)
SET session_replication_role = 'replica';

-- Truncate in dependency order (children first)
-- Identity tables
TRUNCATE TABLE "AspNetUserLogins" CASCADE;
TRUNCATE TABLE "AspNetUserTokens" CASCADE;
TRUNCATE TABLE "AspNetUserClaims" CASCADE;
TRUNCATE TABLE "AspNetUserRoles" CASCADE;
TRUNCATE TABLE "AspNetRoleClaims" CASCADE;
TRUNCATE TABLE "AspNetRoles" CASCADE;

-- Application data tables
TRUNCATE TABLE "Expenses" CASCADE;
TRUNCATE TABLE "Income" CASCADE;
TRUNCATE TABLE "Receipts" CASCADE;
TRUNCATE TABLE "RefreshTokens" CASCADE;

-- User and tenant tables
TRUNCATE TABLE "AspNetUsers" CASCADE;
TRUNCATE TABLE "Properties" CASCADE;
TRUNCATE TABLE "Invitations" CASCADE;
TRUNCATE TABLE "Accounts" CASCADE;

-- DO NOT truncate ExpenseCategories (seed data shared across all accounts)

-- Re-enable FK constraints
SET session_replication_role = 'default';

-- Verify tables are empty
SELECT 'Accounts' as table_name, COUNT(*) as count FROM "Accounts"
UNION ALL SELECT 'AspNetUsers', COUNT(*) FROM "AspNetUsers"
UNION ALL SELECT 'Properties', COUNT(*) FROM "Properties"
UNION ALL SELECT 'Expenses', COUNT(*) FROM "Expenses"
UNION ALL SELECT 'Income', COUNT(*) FROM "Income";
