/**
 * Skill registry — slash-command shortcuts for the Agent chat input.
 * Each skill maps to a /trigger that fills the input with a ready-to-send prompt.
 */

export interface Skill {
  /** Slash command trigger, e.g. "contribution" → user types /contribution */
  trigger: string
  /** Short label shown in the picker */
  label: string
  /** One-line description shown in the picker */
  description: string
  /** The prompt text injected into the chat input when the skill is selected */
  prompt: string
}

export const SKILLS: Skill[] = [
  {
    trigger: "contribution",
    label: "贡献速览",
    description: "提取论文的核心问题、方法和结果",
    prompt:
      "请帮我提取这篇论文的三个核心要素，按以下格式输出：\n\n## 贡献速览\n\n### 🎯 Problem（问题）\n这篇论文解决了什么问题？先前工作存在什么不足？\n\n### 🔧 Method（方法）\n论文提出了什么方法？核心创新点是什么？\n\n### 📊 Result（结果）\n取得了什么改进？与哪些基线相比？有具体数字吗？"
  },
  {
    trigger: "method",
    label: "方法拆解",
    description: "将论文方法逐步拆解，解释每步的做什么和为什么",
    prompt:
      "请将这篇论文的方法部分拆解为有序步骤，每步说明「做什么」和「为什么」，按以下格式输出：\n\n## 方法拆解\n\n### Step 1: [步骤名称]\n**做什么**: \n**为什么**: \n\n### Step 2: [步骤名称]\n..."
  },
  {
    trigger: "critique",
    label: "批判性分析",
    description: "对选中的论点或实验进行同行评审式批判",
    prompt:
      "请对选中的内容进行批判性分析，按以下格式输出：\n\n## 批判性分析\n\n### 📌 核心观点\n\n### ⚠️ 潜在局限性\n\n### 🔍 假设前提\n\n### 🌐 泛化性问题\n\n### 💡 改进建议"
  },
  {
    trigger: "term",
    label: "术语解释",
    description: "解释选中术语在本论文中的具体含义",
    prompt:
      "请解释选中的术语在这篇论文中的具体含义，按以下格式输出：\n\n**术语**: [选中的词]\n\n**在这篇论文中的含义**: \n\n**解释**: \n\n**论文中的用例**:"
  },
  {
    trigger: "compare",
    label: "对比论文",
    description: "列出可对比的论文并生成结构化对比",
    prompt:
      "请帮我对比论文。首先列出我读过的所有可对比论文，然后询问我想对比哪几篇以及关注哪些维度（贡献/方法/实验/局限性等），最后生成结构化对比表格。"
  },
  {
    trigger: "summary",
    label: "全文摘要",
    description: "生成论文的简洁摘要（200字以内）",
    prompt:
      "请用200字以内对这篇论文进行简洁摘要，涵盖：研究背景、核心方法、主要结果和意义。"
  },
  {
    trigger: "related",
    label: "相关工作",
    description: "梳理论文引用的相关工作脉络",
    prompt:
      "请梳理这篇论文的相关工作，说明：1) 该领域的主要研究方向；2) 本文与哪些工作直接相关；3) 本文相比已有工作的核心改进点。"
  },
  {
    trigger: "note",
    label: "添加笔记",
    description: "将选中文字保存为笔记并添加评论",
    prompt:
      "请帮我将选中的文字保存为笔记，并根据内容自动生成一条简洁的评论（不超过50字）。"
  }
]

/**
 * Find skills matching a partial trigger (after the leading slash).
 * e.g. query "co" matches "contribution" and "compare"
 */
export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase().trim()
  if (!q) return SKILLS
  return SKILLS.filter(
    (s) =>
      s.trigger.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  )
}
