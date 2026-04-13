---
name: "contribution-extractor"
description: "Extracts structured Problem/Method/Result from a paper. Invoke when user wants to quickly understand a paper's key contributions before reading in detail."
---

# Contribution Extractor

Quickly extract the three core elements of a paper's contribution in a structured format. Use this when a user needs to decide "is this paper worth reading in detail?"

## Instructions

1. **Input**: The user wants to understand a paper's key contributions
2. **Analysis**: Read the paper's abstract, introduction, and results sections
3. **Extract** three structured components:
   - **Problem**: What gap or challenge does this paper address?
   - **Method**: What novel approach or technique does it propose?
   - **Result**: What improvements or outcomes does it achieve over prior work?

## Output Format

```
## 贡献速览

### 🎯 Problem（问题）
[What problem does this paper solve? What gap exists in prior work?]

### 🔧 Method（方法）
[What does the paper propose? What's novel about the approach?]

### 📊 Result（结果）
[What improvements? How much better? Compared to what baseline?]
```

## Quality Standards

- **Problem**: Should be specific, not generic. "Training deep networks is difficult" is too vague; "Vanishing gradients in RNNs make it hard to capture long-range dependencies" is better.
- **Method**: Highlight what's NOVEL, not just what was done. "Uses attention mechanism" is generic; "Proposes multi-head self-attention to capture different semantic relationships simultaneously" is better.
- **Result**: Must include **quantitative comparisons** when available. "Better than existing methods" is useless; "Achieves 2.3% improvement over previous state-of-the-art on ImageNet" is useful.

## When to Use

- User receives a new paper and wants a quick summary
- During literature review to screen many papers
- Before deciding to read a paper in depth
- When preparing to write related work section