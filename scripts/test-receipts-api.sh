#!/bin/bash

# Receipt API Test Script
# Tests the S3 presigned URL infrastructure for receipt uploads
# Usage: ./test-receipts-api.sh [API_URL]
# Example: ./test-receipts-api.sh https://api.upkeep-io.dev

# Configuration
API_BASE_URL="${1:-https://api.upkeep-io.dev}"
TEST_EMAIL="${TEST_EMAIL:-claude@claude.com}"
TEST_PASSWORD="${TEST_PASSWORD:-1@mClaude}"

# Counters
PASSED=0
FAILED=0

pass() { echo "  ✓ PASS: $1"; PASSED=$((PASSED + 1)); }
fail() { echo "  ✗ FAIL: $1"; FAILED=$((FAILED + 1)); }
info() { echo "    $1"; }

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Receipt API Test Suite"
echo "════════════════════════════════════════════════════════════"
echo "API: $API_BASE_URL"
echo "Account: $TEST_EMAIL"
echo "Started: $(date)"
echo ""

# ─────────────────────────────────────────────────────────────
# Test 1: Authentication
# ─────────────────────────────────────────────────────────────
echo "▶ TEST: Authentication"

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken // empty')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    pass "Login successful"
else
    fail "Login failed: $LOGIN_RESPONSE"
    echo "Cannot continue without authentication. Exiting."
    exit 1
fi

# ─────────────────────────────────────────────────────────────
# Test 2: Generate Upload URL - Valid Request
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Generate Upload URL (valid JPEG)"

UPLOAD_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/receipts/upload-url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"contentType":"image/jpeg","fileSizeBytes":1048576}')

UPLOAD_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.uploadUrl // empty')
STORAGE_KEY=$(echo "$UPLOAD_RESPONSE" | jq -r '.storageKey // empty')

if [ -n "$UPLOAD_URL" ] && [ "$UPLOAD_URL" != "null" ]; then
    pass "Upload URL generated"
    info "Key: $STORAGE_KEY"
else
    fail "Failed to generate upload URL"
fi

# ─────────────────────────────────────────────────────────────
# Test 3: Validation - Invalid Content Type
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Validation - Invalid content type"

INVALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE_URL/api/v1/receipts/upload-url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"contentType":"image/gif","fileSizeBytes":1000}')

if [ "$INVALID_STATUS" = "400" ]; then
    pass "Invalid content type rejected (400)"
else
    fail "Expected 400, got $INVALID_STATUS"
fi

# ─────────────────────────────────────────────────────────────
# Test 4: Validation - File Too Large
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Validation - File too large"

LARGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE_URL/api/v1/receipts/upload-url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"contentType":"image/jpeg","fileSizeBytes":15000000}')

if [ "$LARGE_STATUS" = "400" ]; then
    pass "Oversized file rejected (400)"
else
    fail "Expected 400, got $LARGE_STATUS"
fi

# ─────────────────────────────────────────────────────────────
# Test 5: Full Flow - Upload to S3
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Upload file to S3"

FLOW_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/receipts/upload-url" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"contentType":"image/jpeg","fileSizeBytes":100}')

FLOW_UPLOAD_URL=$(echo "$FLOW_RESPONSE" | jq -r '.uploadUrl')
FLOW_STORAGE_KEY=$(echo "$FLOW_RESPONSE" | jq -r '.storageKey')

S3_STATUS=$(echo "test-image-data" | curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "$FLOW_UPLOAD_URL" \
    -H "Content-Type: image/jpeg" \
    --data-binary @-)

if [ "$S3_STATUS" = "200" ]; then
    pass "File uploaded to S3"
else
    fail "S3 upload failed ($S3_STATUS)"
fi

# ─────────────────────────────────────────────────────────────
# Test 6: Create Receipt
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Create receipt record"

CREATE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/receipts" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"storageKey\":\"$FLOW_STORAGE_KEY\",\"originalFileName\":\"test.jpg\",\"contentType\":\"image/jpeg\",\"fileSizeBytes\":100}")

RECEIPT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -n "$RECEIPT_ID" ] && [ "$RECEIPT_ID" != "null" ]; then
    pass "Receipt created"
    info "ID: $RECEIPT_ID"
else
    fail "Failed to create receipt"
fi

# ─────────────────────────────────────────────────────────────
# Test 7: Get Receipt
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Get receipt with view URL"

if [ -n "$RECEIPT_ID" ]; then
    GET_RESPONSE=$(curl -s "$API_BASE_URL/api/v1/receipts/$RECEIPT_ID" \
        -H "Authorization: Bearer $TOKEN")

    VIEW_URL=$(echo "$GET_RESPONSE" | jq -r '.viewUrl // empty')

    if [ -n "$VIEW_URL" ] && [ "$VIEW_URL" != "null" ]; then
        pass "Receipt retrieved with viewUrl"

        # Test download
        DL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VIEW_URL")
        if [ "$DL_STATUS" = "200" ]; then
            pass "File downloadable via presigned URL"
        else
            fail "Download failed ($DL_STATUS)"
        fi
    else
        fail "No viewUrl in response"
    fi
else
    fail "Skipped - no receipt ID"
fi

# ─────────────────────────────────────────────────────────────
# Test 8: Get Non-existent Receipt
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Get non-existent receipt"

NOT_FOUND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "$API_BASE_URL/api/v1/receipts/00000000-0000-0000-0000-000000000000" \
    -H "Authorization: Bearer $TOKEN")

if [ "$NOT_FOUND_STATUS" = "404" ]; then
    pass "Non-existent receipt returns 404"
else
    fail "Expected 404, got $NOT_FOUND_STATUS"
fi

# # ─────────────────────────────────────────────────────────────
# # Test 9: Delete Receipt
# # ─────────────────────────────────────────────────────────────
# echo ""
# echo "▶ TEST: Delete receipt"

# if [ -n "$RECEIPT_ID" ]; then
#     DEL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
#         -X DELETE "$API_BASE_URL/api/v1/receipts/$RECEIPT_ID" \
#         -H "Authorization: Bearer $TOKEN")

#     if [ "$DEL_STATUS" = "204" ]; then
#         pass "Receipt deleted (204)"
#     else
#         fail "Delete failed ($DEL_STATUS)"
#     fi
# else
#     fail "Skipped - no receipt ID"
# fi

# # ─────────────────────────────────────────────────────────────
# # Test 10: Verify Deletion
# # ─────────────────────────────────────────────────────────────
# echo ""
# echo "▶ TEST: Verify receipt deleted"

# if [ -n "$RECEIPT_ID" ]; then
#     VER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
#         "$API_BASE_URL/api/v1/receipts/$RECEIPT_ID" \
#         -H "Authorization: Bearer $TOKEN")

#     if [ "$VER_STATUS" = "404" ]; then
#         pass "Deleted receipt returns 404"
#     else
#         fail "Expected 404, got $VER_STATUS"
#     fi
# else
#     fail "Skipped - no receipt ID"
# fi

# ─────────────────────────────────────────────────────────────
# Test 11: Unauthorized Access
# ─────────────────────────────────────────────────────────────
echo ""
echo "▶ TEST: Unauthorized access"

UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_BASE_URL/api/v1/receipts/upload-url" \
    -H "Content-Type: application/json" \
    -d '{"contentType":"image/jpeg","fileSizeBytes":1000}')

if [ "$UNAUTH_STATUS" = "401" ]; then
    pass "Unauthorized rejected (401)"
else
    fail "Expected 401, got $UNAUTH_STATUS"
fi

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Test Results"
echo "════════════════════════════════════════════════════════════"
TOTAL=$((PASSED + FAILED))
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Total:  $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "  ✓ ALL TESTS PASSED!"
    echo ""
    exit 0
else
    echo "  ✗ SOME TESTS FAILED"
    echo ""
    exit 1
fi
