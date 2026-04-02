# 🧪 Impulse Quick Test Checklist

## ⚡ Quick Start (5 Minutes)

### Prerequisites
- [ ] Chrome browser installed
- [ ] OpenAI API key ready (get from: https://platform.openai.com/api-keys)

### Build & Load Extension

**Option 1: Manual Build (if npm run dev fails)**
```bash
# The build may have some warnings - that's OK
# Just load the extension manually
```

**Option 2: Load from existing build**
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Navigate to: `/root/Impulse/build/chrome-mv3-dev` (or `chrome-mv3-prod`)
6. Click "Select Folder"

---

## ✅ Core Functionality Tests (Must Pass)

### Test 1: Extension Loaded? (1 min)
- [ ] Extension icon (⚡) appears in Chrome toolbar
- [ ] Click icon → Side panel opens on right side
- [ ] See blue gradient header with "⚡ Impulse"
- [ ] Four tabs visible: Summary, Translate, Highlight, Comment

**If fails**: Check console for errors

---

### Test 2: Configure API Key (1 min)
- [ ] Right-click extension icon → Options
- [ ] New tab opens with blue card design
- [ ] Enter API key: `sk-proj-...`
- [ ] Click show/hide toggle (👁️) → Works
- [ ] Click "💾 Save Configuration"
- [ ] See: "✅ Configuration saved successfully! 🎉"

**If fails**: Check chrome.storage permission

---

### Test 3: Text Selection Works? (1 min)
- [ ] Open PDF: https://arxiv.org/pdf/1706.03762.pdf (Attention is All You Need)
- [ ] Select any paragraph (5-10 lines)
- [ ] Click extension icon
- [ ] Click "🔄 Refresh" button
- [ ] Selected text appears in text area
- [ ] Character count shown below

**If fails**: 
- Check activeTab permission
- For local PDFs: Enable "Allow access to file URLs" in extension settings

---

### Test 4: AI Summary (2 min) 📝
- [ ] After selecting text (Test 3)
- [ ] Go to "Summary" tab
- [ ] Click "📝 Generate Summary"
- [ ] See: Spinner + "Generating..."
- [ ] After 2-5 seconds: Chinese summary appears
- [ ] Summary is concise (3-5 sentences)

**Expected format:**
```
本文介绍了 Transformer 架构...
该模型基于注意力机制...
实验表明...
```

**If fails**:
- "API Key Not Configured" → Redo Test 2
- Timeout → Check internet connection
- API error → Verify API key has credits

---

### Test 5: AI Translation (2 min) 🌐
- [ ] Select English paragraph
- [ ] Click "🔄 Refresh"
- [ ] Go to "Translate" tab
- [ ] Click "🌐 Translate to Chinese"
- [ ] After 2-5 seconds: Chinese translation appears
- [ ] Translation maintains technical accuracy

**Sample text**:
```
The Transformer model architecture is based on self-attention mechanisms
and does not require recurrence or convolutions.
```

**Expected**:
```
Transformer 模型架构基于自注意力机制，
不需要递归或卷积操作。
```

---

### Test 6: AI Highlights ✨ (3 min) - THE COOLEST FEATURE!
- [ ] Select a paragraph with technical terms (10-20 lines)
- [ ] Click "🔄 Refresh"
- [ ] Go to "Highlight" tab
- [ ] Click "✨ Generate Highlights"
- [ ] Wait 3-7 seconds
- [ ] **CHECK PAGE**: Yellow highlights appear on PDF! 🎯
- [ ] See message: "✅ Generated X highlights!"
- [ ] Phrases listed (3-7 items)
- [ ] Each phrase has 🟡 dot + timestamp + 🗑️

**Example phrases generated**:
```
1. attention mechanisms
2. self-attention layer
3. multi-head attention
4. positional encoding
5. encoder-decoder architecture
```

**Visual check**:
- Key terms have **yellow background** on the actual PDF page
- If term appears multiple times, all are highlighted
- Works even if PDF is in an iframe

**Test Highlight Management**:
- [ ] Click "Reapply" → Highlights refresh
- [ ] Click 🗑️ on one highlight → That phrase removed from page
- [ ] Click "Clear All" → Confirmation → All removed

**If fails**:
- No yellow on page → Refresh PDF, try "Reapply"
- "No key phrases found" → Select longer text (100+ words)

---

### Test 7: Notes/Comments 💬 (2 min)
- [ ] Select text from PDF
- [ ] Click "🔄 Refresh"
- [ ] Go to "Comment" tab
- [ ] Type note: "Important concept - review for exam"
- [ ] Click "💾 Save Note"
- [ ] See: "✅ Note saved successfully!"
- [ ] Note appears in list with:
  - Quoted text (gray box with blue left border)
  - Your comment
  - Timestamp ("Just now")

**Test Edit**:
- [ ] Click ✏️ → Text loads in editor
- [ ] Modify text
- [ ] Click "💾 Update Note" → Updated

**Test Delete**:
- [ ] Click 🗑️ → Confirmation → Deleted

---

## 🎨 Visual Quality Check (Quick Scan)

- [ ] **Colors**: Blue gradient header, yellow highlights, consistent theme
- [ ] **Animations**: Smooth fade-ins, spinner rotates, buttons lift on hover
- [ ] **Typography**: Readable fonts, good contrast
- [ ] **Interactions**: Hover effects work, disabled states clear

---

## 💾 Persistence Test (2 min)

### Test Data Survives:
1. Create 2 highlights on Page A
2. Create 1 note on Page A
3. Switch to different PDF (Page B)
4. Create 1 highlight on Page B
5. Close extension (click icon to close panel)
6. Re-open extension on Page B
   - [ ] See only Page B's 1 highlight
7. Navigate back to Page A
   - [ ] See Page A's 2 highlights + 1 note

**If fails**: Check chrome.storage.local

---

## 🏆 Success Criteria

**Minimum Required (MVP Test)**:
- ✅ Extension loads
- ✅ API key saved
- ✅ Text selection works
- ✅ Summary generates
- ✅ Highlights appear on page (YELLOW BACKGROUND!)
- ✅ Notes can be saved

**If these 6 work → SHIP IT! 🚀**

---

## 🐛 Common Issues & Fixes

### Issue: "Build failed" error
**Fix**: Just load the extension manually from build folder (see Quick Start)

### Issue: No text selected
**Fix**: 
1. Refresh the PDF page
2. Try selecting text again
3. For local files: Enable "Allow access to file URLs"

### Issue: Highlights not showing
**Fix**:
1. Click "Reapply" button
2. Refresh PDF page
3. Try on different PDF (some viewers block DOM manipulation)

### Issue: API errors
**Fix**:
1. Verify API key is correct
2. Check you have credits: https://platform.openai.com/usage
3. Try again (may be rate limit)

---

## 📊 Quick Test Results

**Date**: ___________
**Tester**: ___________

| Feature | Status | Notes |
|---------|--------|-------|
| Extension loads | ⬜ PASS / ❌ FAIL | |
| API config | ⬜ PASS / ❌ FAIL | |
| Text selection | ⬜ PASS / ❌ FAIL | |
| Summary | ⬜ PASS / ❌ FAIL | |
| Translation | ⬜ PASS / ❌ FAIL | |
| **Highlights** | ⬜ PASS / ❌ FAIL | Most important! |
| Notes | ⬜ PASS / ❌ FAIL | |
| Persistence | ⬜ PASS / ❌ FAIL | |

**Overall**: ⬜ ALL PASS ⬜ SOME FAILED ⬜ BLOCKED

---

## 🎯 What to Focus On

**Most Important Test**: **Highlight Feature** (Test 6)
- This is the newest and most complex feature
- Verify yellow highlights actually appear on the PDF page
- Test all management functions (delete, reapply, clear)

**Second Priority**: Summary + Translation
- These are the core value propositions
- Check output quality and accuracy

**Third Priority**: Notes
- Basic CRUD functionality
- Persistence across sessions

---

## 📸 Screenshot Checklist

Take screenshots of:
1. [ ] Extension loaded in toolbar
2. [ ] Side panel with all 4 tabs
3. [ ] Options page (can blur API key)
4. [ ] **Highlights on actual PDF page (YELLOW BACKGROUND)**
5. [ ] Notes list with saved notes
6. [ ] Highlight list showing multiple phrases

---

**Testing Time**: ~15 minutes total
**Critical Path**: Tests 1-6 (especially Test 6!)

Good luck! 🍀
