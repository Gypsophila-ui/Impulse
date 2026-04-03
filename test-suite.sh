#!/bin/bash

# Impulse Automated Test Suite
# 自动化测试脚本

echo "======================================"
echo "🧪 Impulse Automated Test Suite"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Test function
test_check() {
    local test_name="$1"
    local command="$2"
    
    echo -n "Testing: $test_name ... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAIL++))
        return 1
    fi
}

echo "📁 File Integrity Tests"
echo "------------------------"

# Test 1: Core files exist
test_check "sidepanel.tsx exists" "[ -f sidepanel.tsx ]"
test_check "options.tsx exists" "[ -f options.tsx ]"
test_check "background.ts exists" "[ -f background.ts ]"
test_check "package.json exists" "[ -f package.json ]"

echo ""
echo "📦 Utils Files"
echo "------------------------"

test_check "utils/storage.ts exists" "[ -f utils/storage.ts ]"
test_check "utils/llm-client.ts exists" "[ -f utils/llm-client.ts ]"
test_check "utils/get-selection.ts exists" "[ -f utils/get-selection.ts ]"

echo ""
echo "📜 Content Scripts"
echo "------------------------"

test_check "contents/selection.ts exists" "[ -f contents/selection.ts ]"
test_check "contents/highlight.ts exists" "[ -f contents/highlight.ts ]"

echo ""
echo "📚 Documentation"
echo "------------------------"

test_check "CLAUDE.md exists" "[ -f CLAUDE.md ]"
test_check "TEST_CHECKLIST.md exists" "[ -f TEST_CHECKLIST.md ]"
test_check "docs/TESTING_GUIDE.md exists" "[ -f docs/TESTING_GUIDE.md ]"
test_check "docs/DEVELOPMENT_PLAN.md exists" "[ -f docs/DEVELOPMENT_PLAN.md ]"

echo ""
echo "🔍 Code Quality Checks"
echo "------------------------"

# Test: TypeScript syntax (basic check)
test_check "sidepanel.tsx syntax" "grep -q 'export default function' sidepanel.tsx"
test_check "options.tsx syntax" "grep -q 'export default function' options.tsx"

# Test: Required imports
test_check "OpenAI imported in llm-client" "grep -q 'import OpenAI' utils/llm-client.ts"
test_check "React imported in sidepanel" "grep -q 'import React' sidepanel.tsx"
test_check "Chrome storage used" "grep -q 'chrome.storage' utils/storage.ts"

echo ""
echo "⚙️  Configuration Tests"
echo "------------------------"

# Test: package.json structure
test_check "openai dependency" "grep -q '\"openai\"' package.json"
test_check "plasmo dependency" "grep -q '\"plasmo\"' package.json"
test_check "react dependency" "grep -q '\"react\"' package.json"

# Test: Permissions
test_check "activeTab permission" "grep -q 'activeTab' package.json"
test_check "storage permission" "grep -q 'storage' package.json"
test_check "scripting permission" "grep -q 'scripting' package.json"
test_check "sidePanel permission" "grep -q 'sidePanel' package.json"

echo ""
echo "🎨 UI/UX Components"
echo "------------------------"

# Test: UI elements present
test_check "Blue theme colors" "grep -q '#3b82f6' sidepanel.tsx"
test_check "Spinner component" "grep -q 'const Spinner' sidepanel.tsx"
test_check "Tab list defined" "grep -q 'const tabList' sidepanel.tsx"
test_check "Animations defined" "grep -q '@keyframes' sidepanel.tsx"

echo ""
echo "🤖 AI Features"
echo "------------------------"

# Test: LLM functions
test_check "summarize function" "grep -q 'export async function summarize' utils/llm-client.ts"
test_check "translate function" "grep -q 'export async function translate' utils/llm-client.ts"
test_check "generateHighlights function" "grep -q 'export async function generateHighlights' utils/llm-client.ts"

echo ""
echo "💾 Storage Functions"
echo "------------------------"

# Test: Storage API
test_check "saveNote function" "grep -q 'export async function saveNote' utils/storage.ts"
test_check "getNotesByUrl function" "grep -q 'export async function getNotesByUrl' utils/storage.ts"
test_check "saveHighlights function" "grep -q 'export async function saveHighlights' utils/storage.ts"
test_check "getHighlightsByUrl function" "grep -q 'export async function getHighlightsByUrl' utils/storage.ts"

echo ""
echo "🎯 Content Script Tests"
echo "------------------------"

# Test: Highlight content script
test_check "highlightText function" "grep -q 'function highlightText' contents/highlight.ts"
test_check "clearHighlights function" "grep -q 'function clearHighlights' contents/highlight.ts"
test_check "Message listener" "grep -q 'chrome.runtime.onMessage.addListener' contents/highlight.ts"
test_check "PlasmoCSConfig exported" "grep -q 'export const config: PlasmoCSConfig' contents/highlight.ts"

echo ""
echo "======================================"
echo "📊 Test Results Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo "Total:  $((PASS + FAIL))"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo "Status: Ready for manual browser testing"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    echo "Please review the failures above"
    exit 1
fi
