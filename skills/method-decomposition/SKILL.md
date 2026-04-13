---
name: "method-decomposition"
description: "Breaks down methodology into numbered steps with explanations. Invoke when user needs to understand how a paper's method works step by step."
---

# Method Decomposition

Decompose the methodology section of a paper into clear, numbered steps. Each step should explain "what is done" and "why it's done that way."

## Instructions

1. **Input**: User wants to understand how a paper's methodology works
2. **Analysis**: Parse the Methodology section thoroughly
3. **Decompose**: Break down the method into discrete, ordered steps
4. **Explain**: For each step, provide:
   - **What**: What operation is performed
   - **Why**: Why this step is necessary or why this approach was chosen

## Output Format

```
## 方法拆解

### Step 1: [Step Name]
**做什么**: [Clear description of the operation]
**为什么**: [Rationale - why this step matters in the overall method]

### Step 2: [Step Name]
...

### Step N: [Step Name]
```

## Example

For a paper on image classification:

```
### Step 3: Feature Extraction
**做什么**: Apply convolutional filters to extract spatial features from input images
**为什么**: Raw pixels are too high-dimensional; convolution reduces dimensionality while preserving important spatial patterns like edges and textures
```

## Target Audience

This skill is particularly valuable for:
- **Cross-domain readers** (e.g., CV researcher reading NLP papers)
- **Graduate students** learning a new field
- **Researchers** evaluating methods outside their specialty
- Anyone who needs to understand the mechanistic details, not just the high-level idea

## Quality Standards

- Steps should be **mutually exclusive** and **collectively exhaustive**
- Order should reflect the actual execution order in the paper
- Avoid combining multiple sub-operations into one step
- Use consistent terminology with the paper
- If the paper presents multiple variants, focus on the main proposed method