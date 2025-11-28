# New Property Workflow

## Overview
This workflow describes the complete user journey for adding a new rental property to the property management system, from initial login through successful property creation and viewing details.

---

## Workflow Steps

### 1. User Login & Dashboard
- **Actor**: User (property owner)
- **Entry Point**: Application login page
- **Action**: User authenticates with email/password
- **Success Condition**: User credentials are valid
- **Result**: User is redirected to Dashboard
- **Dashboard Elements**:
  - Navigation menu (visible on all pages)
  - "Add Property" button prominently displayed
  - Quick stats or welcome message (optional)

### 2. Navigate to Add Property Form
- **Trigger**: User clicks "Add Property" button on Dashboard
- **Action**: Application navigates to `/properties/add` route
- **Form Displayed**: Blank Property Form with following fields:
  - Street address (required)
  - Address line 2 (optional)
  - City (required)
  - State (required)
  - Zip Code (required)
- **Validation Behavior**:
  - Form displays with NO visible error messages
  - All fields appear clean and ready for input
  - Submit button ("Create") is disabled (grayed out)
- **Available Actions**:
  - Fill in form fields
  - Cancel (returns to Dashboard)

### 3. Fill Property Form
- **User Actions**:
  - User types into form fields
  - Fields validate on blur (when user leaves the field)
  - Real-time validation feedback as user types after first blur
- **Validation Rules**:
  - **Street**: Required, minimum 1 character
  - **Address 2**: Optional field
  - **City**: Required, minimum 1 character
  - **State**: Required, minimum 1 character
  - **Zip Code**: Required, valid format (5+ characters)
- **Error Display**:
  - Errors appear ONLY after a field is touched (focused and blurred)
  - Invalid fields show red error text below the field
  - Invalid fields may have red border highlight
  - User can correct errors and see them disappear in real-time
- **Submit Button**:
  - Remains disabled until all required fields are valid
  - Cannot be clicked if any field is invalid
  - Shows as grayed out/disabled state

### 4a. Submit Valid Form (Success Path)
- **Trigger**: User clicks "Create" button with valid form
- **Actions**:
  - Submit button enters loading state (shows spinner or "Creating...")
  - Form fields become read-only (disabled) during submission
  - Application sends `POST /api/properties` request with form data
- **Server Response - Success**:
  - Server validates data and creates property in database
  - Server returns 201 status with created property object
- **Client Response**:
  - Loading state clears
  - Success toast notification displays: **"Property created successfully"**
  - Toast appears for 3-5 seconds then auto-dismisses
  - Application automatically navigates to `/properties` (List View)
- **List View Display**:
  - List shows all properties as cards
  - Newly created property appears in the list
  - Cards display: full address, vacancy status badge, clickable area

### 4b. Submit Valid Form (Error Path)
- **Trigger**: User clicks "Create" button with valid form, but server error occurs
- **Server Response - Error**:
  - Server returns error (e.g., 400, 409 Conflict, 500)
  - Server includes error message (e.g., "Property address already exists")
- **Client Response**:
  - Loading state clears
  - Form remains on page with all user data intact
  - Error message displays (at top of form or in error banner)
  - Error toast may display: **"Failed to create property: [error message]"**
  - Submit button re-enables for user retry
- **User Options**:
  - Correct form data and resubmit
  - Click "Cancel" to return to Dashboard without saving

### 5. Invalid Form Submission Attempt
- **Trigger**: User attempts to click "Create" button with invalid form
- **Result**: 
  - Button is disabled and non-clickable
  - User cannot submit invalid form
  - User sees which fields have errors (red text visible if touched)
  - User must correct errors before submission is possible

### 6a. Navigate to Property Details (Success Path)
- **Trigger**: User clicks on property card in List View
- **Route**: Application navigates to `/properties/:id` (Property Detail page)
- **Detail Page Displays**:
  - Full property address
  - Vacancy status
  - Tenant history section (empty if new property)
  - Maintenance record history section (empty if new property)
  - "Edit" button (routes to `/properties/:id/edit`)
  - "Delete" button (routes to delete confirmation)
  - "Back" button (returns to Property List)

### 6b. Edit Property Workflow
- **Trigger**: User clicks "Edit" button on Property Detail page
- **Route**: Application navigates to `/properties/:id/edit` (Edit Property Form)
- **Form Behavior**: 
  - Same validation rules as Add Property form
  - Form pre-populated with existing property data
  - All fields appear touched (validation errors show if data is invalid)
  - Submit button enabled if form valid
- **On Edit Success**:
  - Server validates and updates property in database
  - Server returns 200 status with updated property object
  - Success toast displays: **"Property updated successfully"**
  - Application automatically navigates back to `/properties/:id` (Detail View)
  - User sees updated property information
- **On Edit Error**:
  - Form remains on page with all user data intact
  - Error message displays on form
  - Submit button re-enables for retry
  - User can cancel to return to Detail View without saving
- **On Cancel**:
  - Application navigates back to `/properties/:id` (Detail View)
  - All changes are discarded

### 6c. Delete Property Workflow
- **Trigger**: User clicks "Delete" button on Property Detail page
- **Confirmation Modal**:
  - Modal displays: **"Are you sure you want to delete this property?"**
  - Shows property address for confirmation
  - Two buttons: "Cancel" and "Delete"
- **On Delete Confirmation**:
  - Server deletes property from database
  - Server returns 204 No Content
  - Application navigates to `/properties` (List View)
  - Deleted property no longer appears in list
  - Optional: Success toast displays: **"Property deleted successfully"**
- **On Delete Cancel**:
  - Modal closes
  - User remains on Property Detail page
  - Property is not deleted

### 6d. Cancel Form (Any Point)
- **Trigger**: User clicks "Cancel" button on Add or Edit Property Form
- **Action**: Application navigates back (Add → Dashboard, Edit → Detail View)
- **Form Data**: All form data is discarded
- **No Saving**: Property changes are not saved if form is abandoned

### 7. Form Validation Rules Summary

| Field | Type | Required | Validation | Error Message |
|-------|------|----------|-----------|---|
| Street | Text | Yes | Min 1 char | "Street address is required" |
| Address 2 | Text | No | N/A | N/A |
| City | Text | Yes | Min 1 char | "City is required" |
| State | Text | Yes | Min 1 char | "State is required" |
| Zip Code | Text | Yes | Min 5 chars | "Valid zip code is required" |

---

## User Interface Elements

### Add Property Form
```
┌─────────────────────────────────┐
│  Add New Property               │
├─────────────────────────────────┤
│                                 │
│  Street Address *               │
│  [________________] ✗ Required  │
│                                 │
│  Address Line 2                 │
│  [________________]             │
│                                 │
│  City *                         │
│  [________________] ✗ Required  │
│                                 │
│  State *                        │
│  [________________] ✗ Required  │
│                                 │
│  Zip Code *                     │
│  [________________] ✗ Required  │
│                                 │
│  [Cancel]  [Create] (disabled)  │
│                                 │
└─────────────────────────────────┘
```

### Property Card (List View)
```
┌──────────────────────────┐
│  123 Oak Street          │
│  Springfield, IL 62701   │
│                          │
│  [Vacant]               │
│                          │
│  View Details →         │
└──────────────────────────┘
```

### Notifications
```
Success Toast:
┌─────────────────────────────────┐
│ ✓ Property created successfully │
│                                 │
│ [Auto-dismiss 3-5 seconds]      │
└─────────────────────────────────┘

Error Toast (if applicable):
┌──────────────────────────────────┐
│ ✗ Failed to create property      │
│   Property address already exists │
│ [Auto-dismiss or click to close] │
└──────────────────────────────────┘
```

---

## API Endpoints Used

### Create Property
```
POST /api/properties
Content-Type: application/json

Body:
{
  "street": "123 Oak Street",
  "address2": "",
  "city": "Springfield",
  "state": "IL",
  "zipCode": "62701"
}

Success Response (201):
{
  "id": "uuid-123",
  "street": "123 Oak Street",
  "address2": "",
  "city": "Springfield",
  "state": "IL",
  "zipCode": "62701",
  "createdAt": "2024-11-19T15:30:00Z"
}

Error Response (400/409/500):
{
  "error": "Property address already exists"
}
```

### Get Properties List
```
GET /api/properties

Success Response (200):
[
  {
    "id": "uuid-123",
    "street": "123 Oak Street",
    "address2": "",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701"
  },
  ...
]
```

### Get Property Details
```
GET /api/properties/:id

Success Response (200):
{
  "id": "uuid-123",
  "street": "123 Oak Street",
  "address2": "",
  "city": "Springfield",
  "state": "IL",
  "zipCode": "62701",
  "tenants": [],
  "maintenanceRecords": [],
  "createdAt": "2024-11-19T15:30:00Z"
}
```

### Update Property
```
PUT /api/properties/:id
Content-Type: application/json

Body:
{
  "street": "123 Oak Street",
  "address2": "Apt A",
  "city": "Springfield",
  "state": "IL",
  "zipCode": "62701"
}

Success Response (200):
{
  "id": "uuid-123",
  "street": "123 Oak Street",
  "address2": "Apt A",
  "city": "Springfield",
  "state": "IL",
  "zipCode": "62701",
  "updatedAt": "2024-11-19T16:00:00Z"
}

Error Response (400/409/500):
{
  "error": "Property address already exists"
}
```

### Delete Property
```
DELETE /api/properties/:id

Success Response (204 No Content):
(empty response body)

Error Response (404/500):
{
  "error": "Property not found"
}
```

---

## Error Scenarios

### Scenario 1: Invalid Field (Blank Required Field)
- **User State**: User leaves required field blank and moves to next field
- **Validation Feedback**: Red error text appears below field: "Street address is required"
- **Submit Button**: Remains disabled
- **Resolution**: User enters value, error clears, button enables

### Scenario 2: Invalid Zip Code Format
- **User State**: User enters "12345" (valid) or "123" (invalid)
- **Validation Feedback**: If 4 digits or less, error shows: "Valid zip code is required"
- **Resolution**: User enters 5+ digits, error clears

### Scenario 3: Duplicate Address
- **User State**: User submits form with address that already exists in database
- **Server Response**: Returns 409 Conflict with message: "Property address already exists"
- **Client Response**: Error message displays on form, form remains filled
- **Resolution**: User checks address details, corrects if needed, or navigates away

### Scenario 4: Network Error During Submission
- **User State**: User clicks "Create" on valid form
- **Network Response**: Network request fails (no internet, server down)
- **Client Response**: 
  - Loading state clears
  - Error message displays: "Failed to create property. Please check your connection and try again."
  - Submit button re-enables
  - Form data remains intact
- **Resolution**: User retries submission or navigates away

### Scenario 5: User Navigates Away Without Saving
- **User State**: User fills partial form, clicks "Cancel"
- **Action**: Application navigates to Dashboard
- **Form Data**: Lost (not saved)
- **Result**: If user clicks "Add Property" again, they see blank form

---

## Business Rules

1. **All properties start with "Vacant" status** when created
2. **Street + City + State + Zip Code combination should be unique** (prevent duplicates)
3. **Address 2 is optional** (apartment number, unit number, etc.)
4. **Properties are immediately accessible** after successful creation
5. **User can only view/edit properties** they own (implied permission model)

---

## Accessibility Considerations

1. Form labels are associated with input fields (for screen readers)
2. Error messages are linked to fields (aria-describedby)
3. Disabled button is clearly indicated (disabled state visible)
4. Toast notifications are announced to screen readers
5. Keyboard navigation works throughout the form
6. Color is not the only indicator of errors (also use text and icons)

---

## Performance Considerations

1. Form validation is client-side (instant feedback)
2. Server validation happens on submit only
3. Property list loads with pagination (if many properties)
4. No auto-save on form (explicit submit button only)
5. Toast notifications auto-dismiss to keep UI clean

---

## Future Enhancements

1. Address autocomplete/Google Places integration
2. Property photos upload on creation
3. Tenant assignment during property creation
4. Bulk property import from CSV
5. Form save-to-draft (if user closes form unintentionally)
6. Address validation via USPS or similar service
7. Property type selection (single-family, multi-unit, commercial)
8. Map view of properties

