---
name: "critical-reading"
description: "Provides peer-review style critique of paper arguments. Invoke when user selects an argument/experiment and asks for potential weaknesses or limitations."
---

# Critical Reading

Analyze selected text (argument, experiment design, or claim) from a paper and provide a peer-review style critique. Identify potential weaknesses, questionable assumptions, and limitations.

## Instructions

1. **Input**: User has selected a passage (argument, experiment, or claim) for critique
2. **Analysis**: Examine the selected text for:
   - Logical fallacies or unsupported assumptions
   - Methodological issues in experimental design
   - Threats to validity (internal/external)
   - Scope limitations
   - Potential overgeneralization
3. **Output**: Provide constructive critical analysis

## Output Format

```
## 批判性分析

### 📌 核心观点
[Restate the claim or argument being critiqued]

### ⚠️ 潜在局限性

1. **[Limitation Name]**
   **问题**: [Description of the issue]
   **影响**: [How this affects the validity of the claim]

2. **[Limitation Name]**
   ...

### 🔍 假设前提
[Explicit or implicit assumptions that may not hold]

### 🌐 Generalizability 问题
[How broadly do the results/claims apply? What population/settings would this fail for?]

### 💡 改进建议
[How could the authors address this limitation?]
```

## When to Use

- **Peer review preparation**: Identify weaknesses before submitting your own paper
- **Literature review**: Evaluate strength of claims before citing
- **Related work writing**: Understand limitations of compared methods
- **Research design**: Learn what to avoid in your own experiments

## Critical Dimensions to Consider

| Dimension | Questions to Ask |
|-----------|------------------|
| **Internal Validity** | Confounding variables? Causal claims justified? |
| **External Validity** | Generalizes to other domains/populations? |
| **Construct Validity** | Measures what it claims to measure? |
| **Reliability** | Results reproducible? Statistical tests appropriate? |
| **Assumptions** | What must be true for conclusions to hold? |

## Tone Guidelines

- Be **constructive**, not destructive
- Acknowledge strengths before weaknesses
- Frame criticism as "potential concerns" or "areas for clarification"
- Suggest improvements when possible