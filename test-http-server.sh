#!/bin/bash

# Test script for the DataMerge MCP HTTP server
# Usage: ./test-http-server.sh <your-datamerge-api-key>

if [ -z "$1" ]; then
    echo "Usage: $0 <your-datamerge-api-key>"
    echo ""
    echo "Example: $0 abc123xyz456"
    exit 1
fi

TOKEN="$1"
BASE_URL="http://localhost:3000"

echo "Testing DataMerge MCP HTTP Server"
echo "================================"
echo ""

# Test 1: Health check without auth (should fail)
echo "Test 1: Health check without authentication (should fail)"
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/health"
echo ""
echo ""

# Test 2: Health check with auth (should succeed)
echo "Test 2: Health check with authentication (should succeed)"
curl -s -w "\nHTTP Status: %{http_code}\n" -H "Authorization: Token $TOKEN" "$BASE_URL/health"
echo ""
echo ""

# Test 3: SSE endpoint without auth (should fail)
echo "Test 3: SSE endpoint without authentication (should fail)"
curl -s -w "\nHTTP Status: %{http_code}\n" "$BASE_URL/sse"
echo ""
echo ""

# Test 4: SSE endpoint with auth (should establish connection)"
echo "Test 4: SSE endpoint with authentication (should establish connection)"
echo "Note: This will stream data. Press Ctrl+C to stop."
echo ""
curl -N -H "Authorization: Token $TOKEN" "$BASE_URL/sse"

