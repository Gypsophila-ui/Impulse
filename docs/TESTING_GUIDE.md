# Impulse Testing Guide

> **Date**: 2026-04-02
> **Version**: Phase 2 Complete

## 📋 Pre-Test Checklist

### ✅ Environment Setup

1. **Node.js & npm** - Verified installed
2. **Dependencies** - All packages installed (`npm install`)
3. **Git Status** - All changes committed
4. **Chrome Browser** - Version 90+ required

---

## 🚀 Quick Start

### Method 1: Using Plasmo Dev Server (Recommended)

```bash
cd /root/Impulse
npm run dev
```

**Expected Output:**
```
🟣 Plasmo v0.90.5
🔴 The Browser Extension Framework
🔵 INFO | Starting the extension development server...
✅ Ready in [X]s
```

**Then:**
1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select folder: `/root/Impulse/build/chrome-mv3-dev`

### Method 2: Production Build

```bash
npm run build
```

**Then:**
1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select folder: `/root/Impulse/build/chrome-mv3-prod`

---

## 🧪 Test Plan

### Test 1: Basic Setup ✅

**Objective**: Verify extension loads correctly

**Steps:**
1. Load extension in Chrome
2. Click extension icon in toolbar
3. Verify side panel opens

**Expected Results:**
- ✅ Extension appears in toolbar with ⚡ icon
- ✅ Clicking icon opens side panel on right
- ✅ Blue gradient header visible
- ✅ Four tabs displayed: Summary, Translate, Highlight, Comment

**Status**: [ ] Pass  [ ] Fail

---

### Test 2: Options Page Configuration ✅

**Objective**: Configure OpenAI API Key

**Steps:**
1. Right-click extension icon
2. Select "Options"
3. Enter API Key: `sk-...`
4. Select Model: "GPT-4o Mini"
5. Click "💾 Save Configuration"

**Expected Results:**
- ✅ Options page opens in new tab
- ✅ Blue gradient card design
- ✅ Show/hide API key toggle (👁️/🙈) works
- ✅ Success message: "✅ Configuration saved successfully! 🎉"
- ✅ Message auto-dismisses after 3 seconds

**Status**: [ ] Pass  [ ] Fail

**Notes**:
- If you don't have an OpenAI API key, get one from: https://platform.openai.com/api-keys
- Minimum cost: ~$0.01 per 100 requests with GPT-4o-mini

---

### Test 3: Text Selection & Refresh ✅

**Objective**: Verify text selection works

**Steps:**
1. Open a PDF in browser (e.g., https://arxiv.org/pdf/2301.00234.pdf)
2. Select a paragraph of text (50-200 words)
3. Click extension icon
4. Click "🔄 Refresh" button

**Expected Results:**
- ✅ Selected text appears in "📄 Selected Text" area
- ✅ Character count displayed (e.g., "523 characters selected")
- ✅ Text is readonly but scrollable
- ✅ Blue focus border when clicked

**Status**: [ ] Pass  [ ] Fail

**Common Issues:**
- ⚠️ No text appears → Check if `activeTab` permission is granted
- ⚠️ Empty string → Try selecting text again
- ⚠️ For local PDFs (`file://`): Enable "Allow access to file URLs" in extension settings

---

### Test 4: Summary Feature 📝

**Objective**: Generate AI summary

**Steps:**
1. Select text from PDF (100-300 words recommended)
2. Click "🔄 Refresh"
3. Verify text appears
4. Go to "Summary" tab
5. Click "📝 Generate Summary"
6. Wait for response

**Expected Results:**
- ✅ Button shows "Generating..." with spinner
- ✅ Output area shows: "✨ Generating summary..."
- ✅ After 2-5 seconds, Chinese summary appears
- ✅ Summary is concise (3-5 sentences)
- ✅ Key points are highlighted

**Status**: [ ] Pass  [ ] Fail

**Expected Summary Format:**
```
本文主要讨论了...
关键技术包括...
实验结果表明...
```

**Failure Cases:**
- ❌ "⚠️ API Key Not Configured" → Go to Options page
- ❌ "❌ Failed to generate summary: API error" → Check API key validity
- ❌ Long wait time (>10s) → May be API rate limit

---

### Test 5: Translation Feature 🌐

**Objective**: Translate text to Chinese

**Steps:**
1. Select English text from PDF
2. Click "🔄 Refresh"
3. Go to "Translate" tab
4. Click "🌐 Translate to Chinese"
5. Wait for response

**Expected Results:**
- ✅ Button shows "Translating..." with spinner
- ✅ Output area shows: "🌐 Translating to Chinese..."
- ✅ After 2-5 seconds, Chinese translation appears
- ✅ Translation maintains academic tone
- ✅ Technical terms properly translated

**Status**: [ ] Pass  [ ] Fail

**Sample Text for Testing:**
```
Neural networks have revolutionized machine learning by enabling
deep hierarchical feature extraction from raw data.
```

**Expected Translation:**
```
神经网络通过从原始数据中提取深层次的层次化特征，
彻底改变了机器学习领域。
```

---

### Test 6: Highlight Feature ✨

**Objective**: Generate and apply AI highlights

**Steps:**
1. Select a paragraph (100-500 words) containing technical terms
2. Click "🔄 Refresh"
3. Go to "Highlight" tab
4. Click "✨ Generate Highlights"
5. Wait for AI analysis
6. Observe page and side panel

**Expected Results:**
- ✅ Button shows "Generating..." with spinner
- ✅ After 3-7 seconds, success message appears
- ✅ Message shows: "✅ Generated X highlights!"
- ✅ Key phrases listed (3-7 items)
- ✅ **Page Effect**: Yellow highlights appear on PDF
- ✅ Highlight list shows all phrases with timestamps
- ✅ Each highlight has 🟡 dot indicator and 🗑️ button

**Status**: [ ] Pass  [ ] Fail

**Sample Output:**
```
✅ Generated 5 highlights!

Key phrases:
1. convolutional neural networks
2. backpropagation algorithm
3. gradient descent
4. activation functions
5. regularization techniques
```

**Visual Check on Page:**
- Key terms should have yellow background (#fef08a)
- Multiple occurrences are all highlighted
- Highlights visible in iframe PDFs

**Highlight Management:**
- ✅ Click "Reapply" → Highlights refresh on page
- ✅ Click "Clear All" → All highlights removed (with confirmation)
- ✅ Click 🗑️ on individual highlight → That phrase removed + page updated

---

### Test 7: Comment/Notes Feature 💬

**Objective**: Create and manage notes

**Steps:**
1. Select text from PDF
2. Click "🔄 Refresh"
3. Go to "Comment" tab
4. Type a note in text area (e.g., "Important concept to review")
5. Click "💾 Save Note"
6. Observe notes list

**Expected Results:**
- ✅ Success message: "✅ Note saved successfully!"
- ✅ Note appears in "📚 Saved Notes" section
- ✅ Note shows:
  - Quoted selected text (max 150 chars)
  - User comment
  - Relative timestamp ("Just now", "5m ago", etc.)
  - ✏️ Edit button
  - 🗑️ Delete button
- ✅ Counter shows total: "📚 Saved Notes (1)"

**Status**: [ ] Pass  [ ] Fail

**Test Edit Functionality:**
1. Click ✏️ on a note
2. Text appears in input area
3. Modify text
4. Click "💾 Update Note"
5. ✅ Note updated in list

**Test Delete Functionality:**
1. Click 🗑️ on a note
2. ✅ Confirmation dialog appears
3. Click "OK"
4. ✅ Note removed from list

**Test Clear All:**
1. Create 2-3 notes
2. Click "Clear All"
3. ✅ Confirmation asks to delete all X notes
4. Click "OK"
5. ✅ All notes removed

---

### Test 8: Cross-Page Persistence 💾

**Objective**: Verify data persists across sessions

**Steps:**
1. On Page A (e.g., arXiv paper 1):
   - Create 2 highlights
   - Create 1 note
2. Switch to Page B (different PDF)
3. Create 1 highlight on Page B
4. Close extension
5. Re-open extension
6. Check Page B → Should see 1 highlight
7. Navigate back to Page A → Should see 2 highlights + 1 note

**Expected Results:**
- ✅ Highlights are page-specific (URL-based)
- ✅ Notes are page-specific
- ✅ Data survives browser restart
- ✅ Each page shows only its own data

**Status**: [ ] Pass  [ ] Fail

---

### Test 9: Error Handling ⚠️

**Objective**: Verify graceful error handling

**Test Cases:**

**9.1: No API Key**
- Go to Summary tab without configuring API key
- Click "Generate Summary"
- ✅ Should show: "⚠️ API Key Not Configured" with instructions

**9.2: No Selected Text**
- Don't select any text
- Try to generate highlights
- ✅ Should show: "⚠️ Please select text first"

**9.3: Empty Note**
- Try to save note without typing anything
- ✅ Save button should be disabled (gray)

**9.4: Invalid API Key**
- Enter wrong API key in options
- Try to generate summary
- ✅ Should show API error message

**Status**: [ ] Pass  [ ] Fail

---

### Test 10: UI/UX Quality 🎨

**Objective**: Verify visual polish and interactions

**Checklist:**

**Colors & Theme:**
- ✅ Blue gradient header (#3b82f6 → #1e40af)
- ✅ Consistent blue accents throughout
- ✅ Yellow theme for highlights (#fef08a)
- ✅ Green for success messages (#d1fae5)
- ✅ Red for error messages (#fee2e2)

**Animations:**
- ✅ Fade-in when switching tabs
- ✅ Spinner rotates smoothly
- ✅ Buttons lift on hover
- ✅ Smooth transitions (0.2-0.4s)

**Typography:**
- ✅ Readable font sizes (12-14px body, 18-28px headers)
- ✅ Proper line height (1.5-1.8)
- ✅ Good contrast ratios

**Interactions:**
- ✅ All buttons show hover effects
- ✅ Disabled states are clear
- ✅ Loading states visible
- ✅ Focus states with blue border
- ✅ Cursor changes (pointer/not-allowed)

**Status**: [ ] Pass  [ ] Fail

---

## 🐛 Known Issues & Workarounds

### Issue 1: Parcel Build Error
**Symptom**: `Could not resolve module "@parcel/transformer-js-linux-x64-gnu"`

**Workaround**:
```bash
rm -rf node_modules .parcel-cache
npm install
npm run dev
```

### Issue 2: Highlights Not Appearing
**Symptom**: AI generates phrases but page doesn't highlight

**Causes**:
1. PDF viewer prevents DOM manipulation
2. Content script not loaded

**Workaround**:
1. Refresh the PDF page
2. Click extension icon to reload content script
3. Try "Reapply" button

### Issue 3: Local File Access
**Symptom**: Can't select text from local PDF (`file://`)

**Solution**:
1. Go to `chrome://extensions/`
2. Find Impulse extension
3. Enable "Allow access to file URLs"

---

## 📊 Test Results Template

### Test Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Basic Setup | ⬜ | |
| 2. Options Config | ⬜ | |
| 3. Text Selection | ⬜ | |
| 4. Summary | ⬜ | |
| 5. Translation | ⬜ | |
| 6. Highlights | ⬜ | |
| 7. Comments | ⬜ | |
| 8. Persistence | ⬜ | |
| 9. Error Handling | ⬜ | |
| 10. UI/UX | ⬜ | |

**Overall Status**: [ ] All Pass [ ] Some Failed [ ] Blocked

**Tested By**: ___________
**Date**: ___________
**Environment**:
- OS: Linux / macOS / Windows
- Chrome Version: _______
- Node Version: _______

---

## 🔍 Debugging Tips

### Check Console Logs
```javascript
// Open Chrome DevTools (F12)
// Check for errors in:
1. Extension background page
2. Side panel page
3. PDF page content script
```

### Check Chrome Storage
```javascript
// In DevTools Console:
chrome.storage.local.get(null, console.log)

// Should show:
{
  llm_config: { apiKey: "sk-...", model: "gpt-4o-mini" },
  notes: [...],
  highlights: [...]
}
```

### Verify Permissions
```javascript
// In DevTools Console:
chrome.permissions.getAll(console.log)

// Should include:
{
  permissions: ["sidePanel", "scripting", "activeTab", "storage"],
  origins: ["https://*/*", "http://*/*", "file://*/*"]
}
```

---

## 🎯 Success Criteria

**✅ All tests pass if:**

1. ✅ Extension loads without errors
2. ✅ API key can be configured
3. ✅ Text selection works on PDFs
4. ✅ Summary generates Chinese summary
5. ✅ Translation produces accurate Chinese text
6. ✅ Highlights appear on page (yellow background)
7. ✅ Notes can be created, edited, deleted
8. ✅ Data persists across page changes
9. ✅ Errors are handled gracefully
10. ✅ UI is polished with smooth animations

**Minimum Viable Test:**
- Configure API key ✅
- Select text + Generate summary ✅
- Generate highlights (see yellow on page) ✅
- Create one note ✅

If these 4 work, core functionality is validated! 🎉

---

## 📝 Testing Notes

_Use this space to record observations, bugs found, or improvement ideas:_

```
Date: ___________

Bugs Found:
1.
2.

Suggestions:
1.
2.

Performance:
- Summary generation time: _____ seconds
- Translation time: _____ seconds
- Highlight generation: _____ seconds
```

---

**Happy Testing! 🚀**
