---
name: "term-explainer"
description: "Explains selected terms/abbreviations in context of the paper. Invoke when user selects a term and asks for its meaning or encounters unfamiliar jargon in a paper."
---

# Term Explainer

When a user encounters an unfamiliar term, abbreviation, or acronym in a paper, use this skill to provide a contextual explanation.

## Instructions

1. **Input**: The user has selected a specific term from a paper
2. **Context**: Gather surrounding context from the paper (the paragraph or section where the term appears)
3. **Analysis**: Identify the term's meaning specifically as used in THIS paper (not a generic dictionary definition)
4. **Output**: Provide a clear, concise explanation covering:
   - What the term stands for (if abbreviated)
   - Its specific meaning in this paper's context
   - Why it's relevant to the paper's contribution

## Output Format

```
**术语**: [selected term]

**在这篇论文中的含义**: [specific contextual meaning]

**解释**: [2-3 sentence explanation connecting the term to the paper's content]

**如果适用，举例**: [example from the paper showing how it's used]
```

## Example

If user selects "transformer" from an NLP paper:
- Generic: "A neural network architecture" ❌
- Contextual: "In this paper, transformer refers to the encoder-decoder architecture introduced in 'Attention is All You Need', used to process sequential text data..." ✓

## Notes

- Always anchor explanations to the specific paper, not general knowledge
- If the term has multiple meanings in the paper, clarify which aspect is being explained
- For abbreviations, always expand them on first occurrence