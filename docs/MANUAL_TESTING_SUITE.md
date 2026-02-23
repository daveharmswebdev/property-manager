# Property Manager - Manual Testing Suite

**Version:** 1.0
**Last Updated:** 2026-02-05
**Test Environment:** Development (localhost)

---

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Test Account Information](#test-account-information)
3. [Authentication & Account Management](#1-authentication--account-management)
4. [Dashboard & Navigation](#2-dashboard--navigation)
5. [Property Management](#3-property-management)
6. [Expense Management](#4-expense-management)
7. [Income Management](#5-income-management)
8. [Receipt Processing](#6-receipt-processing)
9. [Work Order Management](#7-work-order-management)
10. [Vendor Management](#8-vendor-management)
11. [Tax Reports (Schedule E)](#9-tax-reports-schedule-e)
12. [Cross-Feature Integration Tests](#10-cross-feature-integration-tests)
13. [Edge Cases & Boundary Testing](#11-edge-cases--boundary-testing)
14. [Mobile & Responsive Testing](#12-mobile--responsive-testing)

---

## Test Environment Setup

### Prerequisites
```bash
# Start infrastructure
docker compose up -d db mailhog

# Backend (from /backend)
dotnet run --project src/PropertyManager.Api

# Frontend (from /frontend)
ng serve
```

### Service URLs
| Service | URL |
|---------|-----|
| Angular App | http://localhost:4200 |
| .NET API | http://localhost:5292 |
| Swagger UI | http://localhost:5292/swagger |
| MailHog (email testing) | http://localhost:8025 |

---

## Test Account Information

| Email | Password | Notes |
|-------|----------|-------|
| claude@claude.com | 1@mClaude | Primary test account with existing data |

**Note:** You may need to create additional test accounts for multi-user scenarios.

---

## 1. Authentication & Account Management

### 1.1 Login Flow

#### TC-AUTH-001: Successful Login
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to http://localhost:4200 | Redirected to login page |
| 2 | Enter email: `claude@claude.com` | Email field populated |
| 3 | Enter password: `1@mClaude` | Password field populated (masked) |
| 4 | Click "Login" button | Loading indicator appears |
| 5 | Wait for response | Redirected to dashboard |
| 6 | Verify user menu in header | Shows user email/name |

#### TC-AUTH-002: Login with Invalid Credentials
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to login page | Login form displayed |
| 2 | Enter email: `wrong@email.com` | Email field populated |
| 3 | Enter password: `wrongpassword` | Password field populated |
| 4 | Click "Login" button | Loading indicator appears |
| 5 | Wait for response | Error message: "Invalid credentials" or similar |
| 6 | Verify still on login page | Not redirected |

#### TC-AUTH-003: Login Form Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to login page | Login form displayed |
| 2 | Leave email empty, enter password | Email validation error shown |
| 3 | Enter invalid email format (e.g., "notanemail") | Invalid email format error |
| 4 | Enter valid email, leave password empty | Password required error |
| 5 | Click login with invalid form | Button disabled or submission prevented |

#### TC-AUTH-004: Session Persistence
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login successfully | Redirected to dashboard |
| 2 | Close browser tab | - |
| 3 | Open new tab, navigate to http://localhost:4200 | Should auto-redirect to dashboard (session persisted) |
| 4 | OR redirected to login if session expired | Token refresh may be required |

#### TC-AUTH-005: Logout
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login successfully | On dashboard |
| 2 | Click user menu in header | Dropdown menu appears |
| 3 | Click "Logout" option | Loading indicator |
| 4 | Wait for logout | Redirected to login page |
| 5 | Try to navigate to /dashboard directly | Redirected back to login |

### 1.2 Password Management

#### TC-AUTH-006: Forgot Password Request
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to login page | Login form displayed |
| 2 | Click "Forgot Password" link | Forgot password form displayed |
| 3 | Enter registered email | Email field populated |
| 4 | Click "Send Reset Link" | Success message displayed |
| 5 | Open MailHog (http://localhost:8025) | Email received with reset link |

#### TC-AUTH-007: Password Reset
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete TC-AUTH-006 | Have reset email |
| 2 | Click reset link in email | Reset password form displayed |
| 3 | Enter new password | Password field populated |
| 4 | Confirm new password | Passwords match |
| 5 | Click "Reset Password" | Success message |
| 6 | Login with new password | Login successful |

#### TC-AUTH-008: Password Reset with Invalid Token
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to reset URL with invalid/expired token | Error message displayed |
| 2 | Attempt to submit form | Reset fails with clear error |

### 1.3 Protected Route Access

#### TC-AUTH-009: Unauthenticated Route Protection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure logged out | On login page |
| 2 | Navigate directly to /dashboard | Redirected to login |
| 3 | Navigate directly to /properties | Redirected to login |
| 4 | Navigate directly to /expenses | Redirected to login |

https://www.upkeep-io.dev/login?returnUrl=%2Fproperties

#### TC-AUTH-010: Guest Route Redirect
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login successfully | On dashboard |
| 2 | Navigate directly to /login | Redirected to dashboard (already logged in) |

this all checks out

---

## 2. Dashboard & Navigation

### 2.1 Dashboard Display

#### TC-DASH-001: Dashboard Initial Load
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login and land on dashboard | Dashboard displays |
| 2 | Verify stats bar visible | Shows: Total Expenses, Total Income, Net Income, Property Count |
| 3 | Verify property list visible | List of properties displayed |
| 4 | Verify year selector in header | Current year selected by default |

#### TC-DASH-002: Stats Bar Accuracy
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note dashboard stats | Record values |
| 2 | Navigate to Expenses page | View expense totals |
| 3 | Navigate to Income page | View income totals |
| 4 | Compare with dashboard stats | Values match |

#### TC-DASH-003: Year Selector Impact
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On dashboard, note current stats | Record values |
| 2 | Change year selector to previous year | Stats update |
| 3 | Verify stats reflect selected year data | Different values (or $0 if no data) |
| 4 | Navigate to Expenses | Expenses filtered by selected year |
| 5 | Navigate back to Dashboard | Selected year persisted |

#### TC-DASH-004: Empty Dashboard State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new test account (no properties) | Account created |
| 2 | Login with new account | Dashboard displays |
| 3 | Verify empty state message | "No properties" or similar message |
| 4 | Verify "Add Property" button prominent | CTA clearly visible |

### 2.2 Navigation

#### TC-NAV-001: Sidebar Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify sidebar links visible | Dashboard, Properties, Expenses, Income, Receipts, Reports, Work Orders, Vendors, Settings |
| 2 | Click "Properties" | Navigates to /properties |
| 3 | Click "Expenses" | Navigates to /expenses |
| 4 | Click "Income" | Navigates to /income |
| 5 | Click "Receipts" | Navigates to /receipts |
| 6 | Click "Reports" | Navigates to /reports |
| 7 | Click "Work Orders" | Navigates to /work-orders |
| 8 | Click "Vendors" | Navigates to /vendors |
| 9 | Click "Dashboard" | Returns to dashboard |

#### TC-NAV-002: Active Route Indication
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Properties | "Properties" link highlighted in sidebar |
| 2 | Navigate to Expenses | "Expenses" link highlighted |
| 3 | Navigate to Dashboard | "Dashboard" link highlighted |

this all checks out

---

## 3. Property Management

### 3.1 Property List

#### TC-PROP-001: View Property List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Properties | Property list page displayed |
| 2 | Verify property cards visible | Shows name, address, thumbnail |
| 3 | Verify YTD totals on cards | Expense and income amounts displayed |
| 4 | Verify "Add Property" button | Button accessible |

#### TC-PROP-002: Property Search/Filter (if implemented)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On property list, find search input | Search field present |
| 2 | Enter partial property name | List filters to matching properties |
| 3 | Clear search | All properties shown again |

### 3.2 Create Property

#### TC-PROP-003: Create Property - Happy Path
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Property" button | Create property form/dialog opens |
| 2 | Enter property name: "Test Beach House" | Field populated |
| 3 | Enter street: "123 Ocean Drive" | Field populated |
| 4 | Enter city: "Miami" | Field populated |
| 5 | Enter state: "FL" | Field populated |
| 6 | Enter zip: "33139" | Field populated |
| 7 | Click "Save" or "Create" | Loading indicator |
| 8 | Wait for response | Success message, property created |
| 9 | Verify property in list | New property appears |

this works


#### TC-PROP-004: Create Property - Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create property form | Form displayed |
| 2 | Leave property name empty | Validation error on name field |
| 3 | Try to submit | Submission prevented |
| 4 | Enter only property name | May require other fields |
| 5 | Verify all required field indicators | Required fields marked |

this works

#### TC-PROP-005: Create Property - Cancel
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Property" | Form opens |
| 2 | Enter some data | Fields populated |
| 3 | Click "Cancel" or close dialog | Form closes |
| 4 | Verify no property created | List unchanged |

this works

### 3.3 View Property Details

#### TC-PROP-006: Property Detail View
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | From property list, click a property | Property detail page loads |
| 2 | Verify address displayed | Full address shown |
| 3 | Verify photo gallery (if photos exist) | Photos displayed |
| 4 | Verify expense summary | YTD expenses shown |
| 5 | Verify income summary | YTD income shown |
| 6 | Verify work orders section | Recent work orders listed |

#### TC-PROP-007: Property Detail - No Data State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new property (no expenses/income) | Property created |
| 2 | View property details | Detail page loads |
| 3 | Verify expense section | Shows $0 or "No expenses" |
| 4 | Verify income section | Shows $0 or "No income" |
| 5 | Verify work orders | "No work orders" message |

### 3.4 Edit Property

#### TC-PROP-008: Edit Property
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View property details | On detail page |
| 2 | Click "Edit" button | Edit form opens |
| 3 | Change property name | Name field updated |
| 4 | Change city | City field updated |
| 5 | Click "Save" | Loading indicator |
| 6 | Wait for response | Success message |
| 7 | Verify changes persisted | Updated values displayed |

checked out

#### TC-PROP-009: Edit Property - Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open edit form | Form with current values |
| 2 | Clear property name | Validation error |
| 3 | Try to save | Submission prevented |

checked out

### 3.5 Delete Property

#### TC-PROP-010: Delete Property
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View property details | On detail page |
| 2 | Click "Delete" button | Confirmation dialog appears |
| 3 | Read confirmation message | Warns about consequences |
| 4 | Click "Confirm Delete" | Property deleted |
| 5 | Verify redirected to list | Property list displayed |
| 6 | Verify property removed | Property no longer in list |

checks out

#### TC-PROP-011: Delete Property - Cancel
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Delete" button | Confirmation dialog |
| 2 | Click "Cancel" | Dialog closes |
| 3 | Verify property still exists | Property unchanged |

checks out


### 3.6 Property Photos

#### TC-PROP-012: Upload Property Photo
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View property details | On detail page |
| 2 | Find photo upload section | Upload button/area visible |
| 3 | Click upload or drag-drop image | File picker opens |
| 4 | Select image file (JPG/PNG) | File selected |
| 5 | Wait for upload | Progress indicator |
| 6 | Verify photo appears | Photo in gallery |
| 7 | Verify thumbnail created | Thumbnail visible |

#### TC-PROP-013: Upload Multiple Photos
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload first photo | Photo appears |
| 2 | Upload second photo | Second photo added |
| 3 | Upload third photo | Third photo added |
| 4 | Verify all photos in gallery | All three visible |

checks out

#### TC-PROP-014: Set Primary Photo
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Property has multiple photos | Gallery visible |
| 2 | Click "Set as Primary" on non-primary photo | Action triggered |
| 3 | Verify primary indicator moves | New photo marked primary |
| 4 | Navigate to property list | List view displayed |
| 5 | Verify thumbnail updated | Shows new primary photo |

checks out

#### TC-PROP-015: Delete Photo
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Property has photos | Gallery visible |
| 2 | Click delete on a photo | Confirmation prompt |
| 3 | Confirm delete | Photo removed |
| 4 | Verify photo gone from gallery | Photo no longer displayed |

checks out

#### TC-PROP-016: Delete Primary Photo
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Property has multiple photos | Primary photo identified |
| 2 | Delete the primary photo | Photo removed |
| 3 | Verify next photo becomes primary | New primary auto-assigned |

checks out

#### TC-PROP-017: Photo Reorder (if drag-drop implemented)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Property has multiple photos | Gallery visible |
| 2 | Drag photo to new position | Visual feedback during drag |
| 3 | Drop photo | Order updated |
| 4 | Refresh page | Order persisted |

checls out

---

## 4. Expense Management

### 4.1 Expense List

#### TC-EXP-001: View Expense List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Expenses | Expense list displayed |
| 2 | Verify table/list shows: | Date, Description, Amount, Category, Property |
| 3 | Verify pagination | Page controls visible |
| 4 | Verify total count | "X expenses" indicator |

#### TC-EXP-002: Expense List - Year Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On expense list, note current year | Year in selector |
| 2 | Change year selector | List updates |
| 3 | Verify expenses match selected year | Only selected year expenses shown |
| 4 | Change to year with no data | Empty state or "No expenses" message |

#### TC-EXP-003: Expense List - Category Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find category filter | Filter dropdown/chips |
| 2 | Select "Repairs" category | List filters |
| 3 | Verify only repairs shown | All visible expenses are "Repairs" |
| 4 | Select additional category "Utilities" | Both categories shown |
| 5 | Clear filters | All expenses returned |

#### TC-EXP-004: Expense List - Date Range Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find date range filter | From/To date inputs |
| 2 | Set date range (e.g., Jan 1 - Jan 31) | Dates set |
| 3 | Apply filter | List updates |
| 4 | Verify expenses within range | All dates between Jan 1-31 |
| 5 | Clear date filter | All expenses returned |

#### TC-EXP-005: Expense List - Search
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find search input | Search field present |
| 2 | Enter search term from description | Term entered |
| 3 | Wait for/trigger search | List filters |
| 4 | Verify matching expenses | Description contains search term |
| 5 | Clear search | All expenses returned |

#### TC-EXP-006: Expense List - Pagination
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View expense list with >50 items | First page displayed |
| 2 | Click "Next Page" | Page 2 displayed |
| 3 | Verify different expenses | New expense items shown |
| 4 | Click "Previous Page" | Returns to page 1 |
| 5 | Change page size (if option exists) | List length changes |

checks out

### 4.2 Create Expense

#### TC-EXP-007: Create Expense - Happy Path
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Expense" button | Create expense form opens |
| 2 | Select property | Property dropdown populated |
| 3 | Enter amount: 150.00 | Amount field populated |
| 4 | Select category: "Repairs" | Category selected |
| 5 | Enter date | Date picker or input |
| 6 | Enter description: "Fixed leaky faucet" | Description entered |
| 7 | Click "Save" | Loading indicator |
| 8 | Wait for response | Success message |
| 9 | Verify expense in list | New expense appears |

#### TC-EXP-008: Create Expense - All Categories
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create expense form | Form displayed |
| 2 | Open category dropdown | All 15 IRS Schedule E categories visible |
| 3 | Verify categories: | Advertising, Auto/Travel, Cleaning/Maintenance, Commissions, Insurance, Legal/Professional, Management fees, Mortgage interest, Other, Repairs, Supplies, Taxes/Licenses, Utilities, HOA Fees, Other |

#### TC-EXP-009: Create Expense - Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create expense form | Form displayed |
| 2 | Try to save without property | Validation error |
| 3 | Try to save without amount | Validation error |
| 4 | Try to save without category | Validation error |
| 5 | Try to save without date | Validation error |
| 6 | Enter negative amount | Validation error |
| 7 | Enter non-numeric amount | Input prevented or error |

checks out

#### TC-EXP-010: Create Expense - With Work Order
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure work order exists for property | Work order available |
| 2 | Open create expense form | Form displayed |
| 3 | Select property | Property selected |
| 4 | Find work order dropdown | Work order selector visible |
| 5 | Select work order | Work order linked |
| 6 | Save expense | Expense created |
| 7 | View expense details | Work order association shown |

checks out

#### TC-EXP-011: Duplicate Expense Warning
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense: Property A, $100 | Expense created |
| 2 | Within 24 hours, create another: Property A, $100 | Form submitted |
| 3 | Verify warning dialog | "Potential duplicate" warning |
| 4 | View existing expense details in warning | Shows original expense |
| 5 | Choose to proceed anyway | Expense created |
| 6 | OR choose to cancel | No duplicate created |



### 4.3 View Expense Details

#### TC-EXP-012: Expense Detail View
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | From expense list, click an expense | Detail view opens |
| 2 | Verify property displayed | Property name/address shown |
| 3 | Verify amount | Correct amount displayed |
| 4 | Verify category | Category displayed |
| 5 | Verify date | Date displayed |
| 6 | Verify description | Description shown |
| 7 | Verify receipt link (if from receipt) | Receipt image/link available |
| 8 | Verify work order (if linked) | Work order reference shown |

### 4.4 Edit Expense

#### TC-EXP-013: Edit Expense
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View expense details | On detail view |
| 2 | Click "Edit" | Edit form opens |
| 3 | Change amount: 175.00 | Amount updated |
| 4 | Change category: "Supplies" | Category updated |
| 5 | Update description | Description updated |
| 6 | Save changes | Loading indicator |
| 7 | Verify changes saved | Updated values displayed |

there is not expense detail page.

#### TC-EXP-014: Edit Expense - Property Immutable
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit expense | Edit form open |
| 2 | Verify property field | Should be disabled/read-only |
| 3 | Cannot change property | Field not editable |

### 4.5 Delete Expense

#### TC-EXP-015: Delete Expense
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View expense details | On detail view |
| 2 | Click "Delete" | Confirmation dialog |
| 3 | Confirm delete | Expense deleted |
| 4 | Verify removed from list | Expense no longer visible |

#### TC-EXP-016: Unlink Receipt from Expense
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View expense created from receipt | Receipt link visible |
| 2 | Click "Unlink Receipt" | Confirmation prompt |
| 3 | Confirm unlink | Receipt unlinked |
| 4 | Verify receipt returns to queue | Receipt in unprocessed list |
| 5 | Verify expense still exists | Expense unchanged except receipt link |

https://github.com/daveharmswebdev/property-manager/issues/210. requires retest

### 4.6 Property Expense Workspace

#### TC-EXP-017: Property-Specific Expenses
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View property details | On property detail page |
| 2 | Find expenses section/link | Expense area visible |
| 3 | Click to view all property expenses | Property expense workspace |
| 4 | Verify only this property's expenses | All expenses for one property |
| 5 | Verify YTD total | Sum of visible expenses |

checks out

---

## 5. Income Management

### 5.1 Income List

#### TC-INC-001: View Income List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Income | Income list displayed |
| 2 | Verify columns: | Date, Amount, Property, Source, Notes |
| 3 | Verify year filter active | Current year by default |
| 4 | Verify total income displayed | Sum shown |

#### TC-INC-002: Income List - Year Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change year selector | List updates |
| 2 | Verify income matches year | Only selected year shown |

checks out

#### TC-INC-003: Income List - Property Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find property filter | Filter available |
| 2 | Select specific property | List filters |
| 3 | Verify only property income shown | Single property income |

checks out

### 5.2 Create Income

#### TC-INC-004: Create Income - Happy Path
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Income" | Create form opens |
| 2 | Select property | Property selected |
| 3 | Enter amount: 1500.00 | Amount entered |
| 4 | Enter date | Date selected |
| 5 | Enter source: "Monthly rent" | Source entered |
| 6 | Enter notes: "January rent payment" | Notes entered |
| 7 | Click "Save" | Income created |
| 8 | Verify in list | New income appears |

checks out but there is a date issue

https://github.com/daveharmswebdev/property-manager/issues/217

#### TC-INC-005: Create Income - Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create income form | Form displayed |
| 2 | Try to save without property | Validation error |
| 3 | Try to save without amount | Validation error |
| 4 | Try to save without date | Validation error |
| 5 | Enter negative amount | Validation error or prevented |

checks out

#### TC-INC-006: Create Income - Optional Fields
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create income with only required fields | Property, amount, date |
| 2 | Leave source empty | No error |
| 3 | Leave notes empty | No error |
| 4 | Save | Income created successfully |

checks out

### 5.3 Edit Income

#### TC-INC-007: Edit Income
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View income entry | Detail view |
| 2 | Click "Edit" | Edit form opens |
| 3 | Change amount | Amount updated |
| 4 | Change date | Date updated |
| 5 | Save | Changes persisted |

checks out

### 5.4 Delete Income

#### TC-INC-008: Delete Income
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View income entry | Detail view |
| 2 | Click "Delete" | Confirmation dialog |
| 3 | Confirm | Income deleted |
| 4 | Verify removed from list | No longer visible |

checks out

### 5.5 Property Income Workspace

#### TC-INC-009: Property-Specific Income
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View property details | Property detail page |
| 2 | Navigate to income section | Property income workspace |
| 3 | Verify only property's income | Filtered to one property |
| 4 | Verify YTD income total | Sum displayed |



---

## 6. Receipt Processing

### 6.1 Receipt Capture

#### TC-REC-001: Upload Receipt via FAB
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find floating action button (FAB) | Camera/upload icon visible |
| 2 | Click FAB | File picker or camera opens |
| 3 | Select image file | File chosen |
| 4 | Wait for upload | Progress indicator |
| 5 | Verify receipt created | Success message |
| 6 | Navigate to Receipts | Receipt in queue |

checks out

#### TC-REC-002: Upload Receipt from Receipts Page
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Receipts | Receipt queue page |
| 2 | Find upload button | Upload option visible |
| 3 | Upload receipt image | File selected |
| 4 | Wait for upload | Progress shown |
| 5 | Verify in unprocessed queue | New receipt appears |

checks out

#### TC-REC-003: Upload Multiple Receipts
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload first receipt | Receipt in queue |
| 2 | Upload second receipt | Second receipt added |
| 3 | Upload third receipt | Third receipt added |
| 4 | Verify all in queue | Three unprocessed receipts |

checks out

### 6.2 Receipt Queue

#### TC-REC-004: View Unprocessed Receipts
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Receipts | Receipt queue displayed |
| 2 | Verify unprocessed receipts shown | List of receipts |
| 3 | Verify thumbnails | Thumbnail images visible |
| 4 | Verify sorted by date | Newest first |

checks out, but raised time stamp issue

#### TC-REC-005: Empty Receipt Queue
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Process all receipts | Queue empty |
| 2 | Verify empty state | Checkmark or "All processed" message |
| 3 | No receipts in list | Empty list display |

checks out

### 6.3 Receipt Processing

#### TC-REC-006: Process Receipt to Expense - Happy Path
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click unprocessed receipt | Processing view opens |
| 2 | View receipt image | Full image in lightbox |
| 3 | Select property | Property dropdown |
| 4 | Enter amount: 75.50 | Amount entered |
| 5 | Select category: "Supplies" | Category selected |
| 6 | Enter date (from receipt) | Date entered |
| 7 | Enter description | Description entered |
| 8 | Click "Create Expense" | Processing completes |
| 9 | Verify receipt removed from queue | No longer unprocessed |
| 10 | Verify expense created | Expense in list |
| 11 | Verify receipt linked to expense | Receipt link on expense |

#### TC-REC-007: Process Receipt - With Work Order
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open receipt for processing | Processing form |
| 2 | Select property | Property selected |
| 3 | Find work order dropdown | Work orders for property shown |
| 4 | Select work order | Work order linked |
| 5 | Complete expense creation | Expense with work order link |

checks out

#### TC-REC-008: Process Receipt - Inline Vendor Creation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open receipt for processing | Processing form |
| 2 | Find vendor field (if present) | Vendor selector |
| 3 | Click "Add New Vendor" | Vendor creation dialog |
| 4 | Enter vendor info | First/last name |
| 5 | Save vendor | Vendor created |
| 6 | Vendor auto-selected | New vendor in field |
| 7 | Complete expense | Expense linked to vendor |

this feature is not available.
that is a good question.  should there be vendor assignment to a vendor?
sort of makes sense.

#### TC-REC-009: Receipt Processing - Duplicate Warning
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense manually | Property A, $50, today |
| 2 | Upload and process receipt | Same property, $50 |
| 3 | Verify duplicate warning | Warning dialog appears |
| 4 | Choose to proceed or cancel | Appropriate action |

### 6.4 Receipt Management

#### TC-REC-010: Delete Unprocessed Receipt
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View unprocessed receipt | Receipt visible |
| 2 | Click "Delete" | Confirmation dialog |
| 3 | Confirm | Receipt deleted |
| 4 | Verify removed from queue | No longer in list |
| 5 | Verify S3 file deleted | (Backend verification) |

#### TC-REC-011: View Receipt on Expense
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View expense created from receipt | Expense detail |
| 2 | Click receipt link/thumbnail | Receipt image displays |
| 3 | Verify full image viewable | Lightbox or new tab |

checks out

---

## 7. Work Order Management

### 7.1 Work Order List

#### TC-WO-001: View Work Order List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Work Orders | Work order list displayed |
| 2 | Verify columns: | Description, Property, Status, Category, Vendor |
| 3 | Verify status indicators | Color coding or badges |

#### TC-WO-002: Work Order - Status Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find status filter | Filter options |
| 2 | Select "Reported" | Only reported work orders |
| 3 | Select "Assigned" | Only assigned work orders |
| 4 | Select "Completed" | Only completed work orders |
| 5 | Clear filter | All work orders shown |

#### TC-WO-003: Work Order - Property Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find property filter | Filter dropdown |
| 2 | Select specific property | Only property's work orders |
| 3 | Clear filter | All work orders shown |

### 7.2 Create Work Order

#### TC-WO-004: Create Work Order - Happy Path
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Work Order" | Create form opens |
| 2 | Select property | Property chosen |
| 3 | Enter description: "Replace kitchen faucet" | Description entered |
| 4 | Select category: "Repairs" | Category selected |
| 5 | Select status: "Reported" | Status set |
| 6 | Click "Save" | Work order created |
| 7 | Verify in list | New work order appears |

#### TC-WO-005: Create Work Order - With Vendor
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create work order form | Form displayed |
| 2 | Fill required fields | Property, description, category |
| 3 | Select vendor from dropdown | Vendor selected |
| 4 | Set status to "Assigned" | Status set |
| 5 | Save | Work order with vendor |
| 6 | View work order details | Vendor displayed |

#### TC-WO-006: Create Work Order - DIY (Self)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create work order form | Form displayed |
| 2 | Select "DIY" or "Self" option | No vendor selected |
| 3 | Save work order | Work order created |
| 4 | View details | Shows "Self (DIY)" |

#### TC-WO-007: Create Work Order - With Tags
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create work order form | Form displayed |
| 2 | Find tags/trade tags field | Tag selector |
| 3 | Select multiple tags (e.g., Plumbing, Electrical) | Tags added |
| 4 | Save work order | Work order with tags |
| 5 | View details | Tags displayed |

### 7.3 Work Order Details

#### TC-WO-008: View Work Order Details
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click work order in list | Detail view opens |
| 2 | Verify description | Full description shown |
| 3 | Verify property info | Property name/address |
| 4 | Verify status | Current status |
| 5 | Verify category | Category displayed |
| 6 | Verify vendor | Vendor name or "Self (DIY)" |
| 7 | Verify tags | Tags displayed |
| 8 | Verify photo gallery | Photos if uploaded |
| 9 | Verify notes section | Notes displayed |
| 10 | Verify linked expenses | Expenses shown |

### 7.4 Edit Work Order

#### TC-WO-009: Edit Work Order
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order details | On detail page |
| 2 | Click "Edit" | Edit form opens |
| 3 | Change description | Updated |
| 4 | Change status | Reported → Assigned → Completed |
| 5 | Change vendor | New vendor selected |
| 6 | Save | Changes persisted |

#### TC-WO-010: Work Order Status Workflow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create work order (Reported) | Status = Reported |
| 2 | Edit, change to Assigned | Status = Assigned |
| 3 | Edit, change to Completed | Status = Completed |
| 4 | Verify status history (if tracked) | Status changes logged |

### 7.5 Delete Work Order

#### TC-WO-011: Delete Work Order
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order | Detail page |
| 2 | Click "Delete" | Confirmation dialog |
| 3 | Confirm | Work order deleted |
| 4 | Verify removed from list | No longer visible |
| 5 | Verify linked expenses unaffected | Expenses still exist |

### 7.6 Work Order Photos

#### TC-WO-012: Upload Work Order Photo
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order details | Photo section visible |
| 2 | Click upload | File picker |
| 3 | Select image | Upload starts |
| 4 | Wait for upload | Progress indicator |
| 5 | Verify photo in gallery | Photo displayed |

#### TC-WO-013: Multiple Work Order Photos
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload photo 1 | Photo added |
| 2 | Upload photo 2 | Second photo added |
| 3 | Upload photo 3 | Third photo added |
| 4 | Verify gallery | All photos visible |

#### TC-WO-014: Set Primary Work Order Photo
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Work order has multiple photos | Gallery visible |
| 2 | Click "Set Primary" on non-primary | Action triggered |
| 3 | Verify primary changed | New primary indicated |

#### TC-WO-015: Delete Work Order Photo
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click delete on photo | Confirmation |
| 2 | Confirm | Photo removed |
| 3 | Verify removed from gallery | Photo gone |

### 7.7 Work Order Notes

#### TC-WO-016: Add Note to Work Order
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order details | Notes section |
| 2 | Find "Add Note" input | Text input visible |
| 3 | Enter note: "Contacted vendor, awaiting response" | Note text entered |
| 4 | Click "Add" or press Enter | Note saved |
| 5 | Verify note appears | Note in list with timestamp |

#### TC-WO-017: Edit Work Order Note
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order with notes | Notes visible |
| 2 | Click "Edit" on note | Edit mode |
| 3 | Change note text | Text updated |
| 4 | Save | Note updated |

#### TC-WO-018: Delete Work Order Note
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order with notes | Notes visible |
| 2 | Click "Delete" on note | Confirmation |
| 3 | Confirm | Note removed |

### 7.8 Work Order - Expense Linking

#### TC-WO-019: View Linked Expenses
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order with linked expense | Detail page |
| 2 | Find "Linked Expenses" section | Expenses listed |
| 3 | Click expense | Navigate to expense detail |

#### TC-WO-020: Create Expense from Work Order
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View work order | Detail page |
| 2 | Click "Add Expense" | Expense form pre-filled |
| 3 | Verify property pre-selected | Same as work order |
| 4 | Verify work order linked | Work order in dropdown |
| 5 | Complete expense | Expense linked to work order |

---

## 8. Vendor Management

### 8.1 Vendor List

#### TC-VEND-001: View Vendor List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Vendors | Vendor list displayed |
| 2 | Verify columns: | Name, Phone, Email, Trades |
| 3 | Verify "Add Vendor" button | Button visible |

### 8.2 Create Vendor

#### TC-VEND-002: Create Vendor - Happy Path
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Add Vendor" | Create form opens |
| 2 | Enter first name: "John" | Field populated |
| 3 | Enter last name: "Smith" | Field populated |
| 4 | Click "Save" | Vendor created |
| 5 | Verify in list | "John Smith" appears |

#### TC-VEND-003: Create Vendor - Full Details
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create vendor form | Form displayed |
| 2 | Enter first name: "Jane" | Field populated |
| 3 | Enter middle name: "Marie" | Field populated |
| 4 | Enter last name: "Doe" | Field populated |
| 5 | Add phone: (555) 123-4567, Mobile | Phone added |
| 6 | Add email: jane@example.com | Email added |
| 7 | Add trade tags: Plumbing, HVAC | Tags selected |
| 8 | Save | Vendor with all details |

#### TC-VEND-004: Create Vendor - Validation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create vendor form | Form displayed |
| 2 | Try to save without first name | Validation error |
| 3 | Try to save without last name | Validation error |
| 4 | Enter invalid phone format | Validation error |
| 5 | Enter invalid email format | Validation error |

### 8.3 Vendor Details

#### TC-VEND-005: View Vendor Details
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click vendor in list | Detail view opens |
| 2 | Verify full name | Formatted name displayed |
| 3 | Verify phone numbers | All phones with labels |
| 4 | Verify email addresses | All emails shown |
| 5 | Verify trade tags | Tags displayed |
| 6 | Verify associated work orders | Work order list |

### 8.4 Edit Vendor

#### TC-VEND-006: Edit Vendor Name
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View vendor details | Detail page |
| 2 | Click "Edit" | Edit form |
| 3 | Change first name | Name updated |
| 4 | Save | Changes persisted |

#### TC-VEND-007: Add Phone to Vendor
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit vendor | Edit form |
| 2 | Click "Add Phone" | Phone input added |
| 3 | Enter number and label | Phone filled |
| 4 | Save | Phone added to vendor |

#### TC-VEND-008: Remove Phone from Vendor
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit vendor with multiple phones | Phone list visible |
| 2 | Click "Remove" on phone | Phone removed |
| 3 | Save | Phone no longer on vendor |

#### TC-VEND-009: Add/Remove Email
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit vendor | Edit form |
| 2 | Add email address | Email input |
| 3 | Save | Email added |
| 4 | Edit again, remove email | Email removed |

#### TC-VEND-010: Update Trade Tags
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Edit vendor | Edit form |
| 2 | Add new trade tags | Tags selected |
| 3 | Remove existing tags | Tags deselected |
| 4 | Save | Tag changes persisted |

### 8.5 Delete Vendor

#### TC-VEND-011: Delete Vendor
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | View vendor details | Detail page |
| 2 | Click "Delete" | Confirmation dialog |
| 3 | Confirm | Vendor deleted |
| 4 | Verify removed from list | No longer visible |
| 5 | Verify work orders unaffected | Work orders still exist |

### 8.6 Inline Vendor Creation

#### TC-VEND-012: Create Vendor from Work Order Form
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create work order form | Form displayed |
| 2 | Click "Add New Vendor" in vendor field | Dialog opens |
| 3 | Enter vendor details | Name filled |
| 4 | Save new vendor | Vendor created |
| 5 | Verify vendor auto-selected | In work order form |
| 6 | Complete work order | Work order with new vendor |

---

## 9. Tax Reports (Schedule E)

### 9.1 Single Property Report

#### TC-RPT-001: Generate Single Property Schedule E
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Reports | Reports page |
| 2 | Find "Generate Schedule E" | Generation options |
| 3 | Select single property | Property selected |
| 4 | Select tax year | Year selected |
| 5 | Click "Generate" | Processing starts |
| 6 | Wait for generation | Progress indicator |
| 7 | Verify success message | Report generated |
| 8 | Verify report in list | New report entry |

#### TC-RPT-002: View Single Property Report Content
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Generate report per TC-RPT-001 | Report exists |
| 2 | Click "Preview" | PDF viewer opens |
| 3 | Verify property address | Correct address |
| 4 | Verify total rent received | Matches income total |
| 5 | Verify expenses by category | Category breakdown |
| 6 | Verify net income calculation | Income - Expenses |

### 9.2 Batch Report Generation

#### TC-RPT-003: Generate Batch Schedule E
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Reports | Reports page |
| 2 | Click "Batch Generate" | Batch dialog opens |
| 3 | Select multiple properties (checkboxes) | 2+ properties selected |
| 4 | Select tax year | Year selected |
| 5 | Click "Generate" | Processing starts |
| 6 | Wait for completion | Progress shown |
| 7 | Verify ZIP file generated | "All Properties" report |

#### TC-RPT-004: Download Batch Report
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Batch report exists | In report list |
| 2 | Click "Download" | ZIP download starts |
| 3 | Extract ZIP | PDFs inside |
| 4 | Verify each property PDF | One per property |

### 9.3 Report Management

#### TC-RPT-005: View Generated Reports List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Reports | Reports page |
| 2 | Verify report table | Previous reports listed |
| 3 | Verify columns: | Name, Year, Date, Type, Size |
| 4 | Verify sorting | By date or column headers |

#### TC-RPT-006: Preview Report
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find PDF report in list | Single property report |
| 2 | Click "Preview" | PDF viewer opens |
| 3 | Verify PDF renders | Content visible |
| 4 | Close preview | Returns to list |

#### TC-RPT-007: Download Report
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find report in list | Report visible |
| 2 | Click "Download" | Download starts |
| 3 | Verify file downloads | PDF or ZIP saved |
| 4 | Open downloaded file | File valid |

#### TC-RPT-008: Delete Report
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find report in list | Report visible |
| 2 | Click "Delete" | Confirmation dialog |
| 3 | Confirm | Report deleted |
| 4 | Verify removed from list | No longer visible |

### 9.4 Report Edge Cases

#### TC-RPT-009: Generate Report - No Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select property with no expenses/income | Empty property |
| 2 | Generate Schedule E | Processing |
| 3 | Verify report generates | Report created |
| 4 | Verify content shows $0 | Zero values |

#### TC-RPT-010: Generate Report - Year With No Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select year with no transactions | Old/future year |
| 2 | Generate report | Processing |
| 3 | Verify handles gracefully | Report or informative message |

---

## 10. Cross-Feature Integration Tests

### 10.1 Complete Property Lifecycle

#### TC-INT-001: Property Setup to Tax Report
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create new property | Property created |
| 2 | Upload property photos | Photos attached |
| 3 | Create income entry (rent) | Income recorded |
| 4 | Create expense (repair) | Expense recorded |
| 5 | Generate Schedule E | Report includes property |
| 6 | Verify report accuracy | Income/expense correct |

### 10.2 Receipt to Report Flow

#### TC-INT-002: Receipt → Expense → Report
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Upload receipt | Receipt in queue |
| 2 | Process receipt to expense | Expense created |
| 3 | Verify expense in list | With receipt link |
| 4 | Generate Schedule E | Expense included |
| 5 | Verify category in report | Correct category |

### 10.3 Work Order Complete Flow

#### TC-INT-003: Work Order → Expense → Report
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create work order | Status: Reported |
| 2 | Add vendor | Status: Assigned |
| 3 | Upload work order photos | Photos attached |
| 4 | Create expense linked to work order | Expense created |
| 5 | Mark work order completed | Status: Completed |
| 6 | Generate Schedule E | Expense included |

### 10.4 Dashboard Accuracy

#### TC-INT-004: Dashboard Stats Accuracy
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Note dashboard stats | Record values |
| 2 | Add new expense | Expense created |
| 3 | Return to dashboard | Stats updated |
| 4 | Verify expense total increased | By expense amount |
| 5 | Add income | Income created |
| 6 | Verify income total increased | By income amount |
| 7 | Verify net income updated | Recalculated |

### 10.5 Year Filtering Consistency

#### TC-INT-005: Year Filter Across Features
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set year to 2025 in header | Year selected |
| 2 | View Dashboard stats | 2025 data |
| 3 | View Expenses | 2025 expenses |
| 4 | View Income | 2025 income |
| 5 | View Property details | 2025 totals |
| 6 | Generate report | 2025 report |
| 7 | Change year to 2024 | All views update |

### 10.6 Property Deletion Impact

#### TC-INT-006: Delete Property with Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Property has expenses, income, work orders | Data exists |
| 2 | Delete property | Confirmation shown |
| 3 | Verify deletion cascades appropriately | Data handling correct |
| 4 | Check expenses list | Property expenses gone/soft deleted |
| 5 | Check work orders | Property work orders gone |

---

## 11. Edge Cases & Boundary Testing

### 11.1 Data Boundary Tests

#### TC-EDGE-001: Very Large Expense Amount
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense | Open form |
| 2 | Enter amount: 999999999.99 | Large amount |
| 3 | Save | Either accepts or shows max error |
| 4 | Verify display formatting | Currency format maintained |

#### TC-EDGE-002: Zero Amount Expense
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense | Open form |
| 2 | Enter amount: 0.00 | Zero amount |
| 3 | Try to save | Validation error or prevented |

#### TC-EDGE-003: Very Long Description
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense | Open form |
| 2 | Enter 500+ character description | Long text |
| 3 | Save | Either truncates or accepts |
| 4 | Verify display handles long text | No UI breaking |

#### TC-EDGE-004: Special Characters in Names
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create property | Open form |
| 2 | Name: "O'Brien's Beach House & Grill" | Special chars |
| 3 | Save | Property created |
| 4 | Verify display | Characters preserved |

#### TC-EDGE-005: Unicode Characters
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense description | Open form |
| 2 | Include emoji or unicode: "Fixed 🔧 pipe" | Unicode chars |
| 3 | Save | Accepts or rejects gracefully |
| 4 | If accepted, verify display | Characters render |

### 11.2 Date Edge Cases

#### TC-EDGE-006: Future Date Expense
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense | Open form |
| 2 | Set date to next year | Future date |
| 3 | Save | Either accepts or warns |
| 4 | Verify year filter impact | Shows in future year |

#### TC-EDGE-007: Very Old Date
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create expense | Open form |
| 2 | Set date to 10 years ago | Old date |
| 3 | Save | Accepts |
| 4 | Filter by that year | Expense visible |

#### TC-EDGE-008: Date Range Filter - Same Day
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On expense list | Filter visible |
| 2 | Set from date = to date | Same day |
| 3 | Apply filter | Only that day's expenses |

### 11.3 Empty State Handling

#### TC-EDGE-009: No Properties Empty State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | New account, no properties | Dashboard |
| 2 | Verify dashboard message | "Add your first property" |
| 3 | Try to create expense | Property required |
| 4 | Try to generate report | No properties message |

#### TC-EDGE-010: Filter Returns No Results
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On expense list | Expenses visible |
| 2 | Apply filter that matches nothing | e.g., search "xyz123abc" |
| 3 | Verify empty state | "No results" message |
| 4 | Clear filter option visible | Can reset easily |

### 11.4 Concurrent Operations

#### TC-EDGE-011: Edit Same Entity Twice
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open expense edit in tab 1 | Edit form |
| 2 | Open same expense edit in tab 2 | Edit form |
| 3 | Save in tab 1 | Success |
| 4 | Save in tab 2 | Either: latest wins, or conflict error |

### 11.5 Network/Error Scenarios

#### TC-EDGE-012: Submit Form During Network Lag
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open create form | Form displayed |
| 2 | Fill out form | Data entered |
| 3 | Click save | Loading state |
| 4 | Verify button disabled during save | Prevents double-submit |

#### TC-EDGE-013: API Error Handling
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger API error (if possible) | e.g., invalid request |
| 2 | Verify error message | User-friendly error |
| 3 | Verify app doesn't crash | Can continue using |

### 11.6 Photo Upload Edge Cases

#### TC-EDGE-014: Upload Very Large Image
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select large image (10MB+) | File selected |
| 2 | Upload | Progress indicator |
| 3 | Verify handling | Either accepts with resize or shows size error |

#### TC-EDGE-015: Upload Non-Image File
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Try to upload .pdf or .doc | File selected |
| 2 | Attempt upload | Validation error |
| 3 | Verify rejected gracefully | Clear error message |

#### TC-EDGE-016: Upload Invalid Image
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Rename .txt to .jpg | Fake image |
| 2 | Try to upload | File selected |
| 3 | Verify rejection | Error during upload |

---

## 12. Mobile & Responsive Testing

### 12.1 Mobile Viewport Tests

#### TC-MOBILE-001: Dashboard on Mobile
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resize browser to 375px width | Mobile viewport |
| 2 | View dashboard | Responsive layout |
| 3 | Verify stats visible | May stack vertically |
| 4 | Verify property cards | Single column |
| 5 | Verify navigation | Hamburger menu or bottom nav |

#### TC-MOBILE-002: Navigation on Mobile
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On mobile viewport | Responsive view |
| 2 | Find nav toggle (hamburger) | Icon visible |
| 3 | Click to open nav | Menu opens |
| 4 | Navigate to Expenses | Navigation works |
| 5 | Menu closes after selection | Returns to content |

#### TC-MOBILE-003: Forms on Mobile
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mobile viewport | Responsive view |
| 2 | Open create expense form | Form displays |
| 3 | Verify inputs are full-width | Touch-friendly |
| 4 | Verify date picker works | Mobile date picker |
| 5 | Complete form submission | Form submits |

#### TC-MOBILE-004: Receipt Capture on Mobile
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mobile viewport | Responsive view |
| 2 | Find FAB button | Camera icon visible |
| 3 | Click FAB | Camera/upload options |
| 4 | Upload image | Works on mobile |

### 12.2 Tablet Viewport Tests

#### TC-MOBILE-005: Tablet Layout (768px)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resize to tablet width (768px) | Tablet viewport |
| 2 | Verify sidebar behavior | May collapse or stay |
| 3 | Verify property grid | 2-column layout |
| 4 | Test all main features | All functional |

### 12.3 Touch Interaction Tests

#### TC-MOBILE-006: Touch-Friendly Buttons
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Mobile viewport or touch device | Touch mode |
| 2 | Verify button sizes | Min 44px touch target |
| 3 | Verify spacing between actions | No accidental taps |

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Docker containers running (db, mailhog)
- [ ] Backend API running on :5292
- [ ] Frontend running on :4200
- [ ] Test account accessible
- [ ] MailHog accessible for email tests

### Test Completion Tracking

| Section | Total Tests | Passed | Failed | Blocked |
|---------|-------------|--------|--------|---------|
| 1. Authentication | 10 | | | |
| 2. Dashboard & Nav | 6 | | | |
| 3. Properties | 17 | | | |
| 4. Expenses | 17 | | | |
| 5. Income | 9 | | | |
| 6. Receipts | 11 | | | |
| 7. Work Orders | 20 | | | |
| 8. Vendors | 12 | | | |
| 9. Reports | 10 | | | |
| 10. Integration | 6 | | | |
| 11. Edge Cases | 16 | | | |
| 12. Mobile | 6 | | | |
| **TOTAL** | **140** | | | |

---

## Bug Report Template

When you find an issue, document it using this template:

```markdown
### Bug ID: BUG-XXX

**Summary:** [Brief description]

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**

**Actual Result:**

**Environment:**
- Browser:
- Screen Size:
- Test Account:

**Severity:** Critical / High / Medium / Low

**Screenshots/Evidence:** [Attach if available]
```

---

## Notes

- This test suite is designed for the development environment
- Some tests may need adjustment based on actual UI implementation
- Edge cases may reveal behaviors not yet specified
- Report any unclear requirements discovered during testing
