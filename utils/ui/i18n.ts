import type { Language } from "~types"

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    "app.title": "Impulse",
    "app.subtitle": "AI-Powered PDF Assistant",
    "btn.refresh": "Refresh",
    "btn.loading": "Loading...",

    // Tabs
    "tab.summary": "Summary",
    "tab.translate": "Translate",
    "tab.highlight": "Highlight",
    "tab.comment": "Comment",
    "tab.qa": "Q&A",

    // Summary tab
    "summary.title": "AI Summary",
    "summary.generate": "Generate Summary",
    "summary.generating": "Generating...",
    "summary.placeholder": "Summary will appear here...",

    // Translation tab
    "translate.title": "AI Translation",
    "translate.generate": "Translate to Chinese",
    "translate.generating": "Translating...",
    "translate.placeholder": "Translation will appear here...",

    // Highlight tab
    "highlight.title": "Smart Highlight",
    "highlight.generate": "Generate Highlights",
    "highlight.generating": "Generating...",
    "highlight.active": "Active Highlights",
    "highlight.empty": "No highlights yet",
    "highlight.emptyDesc": "Select text and generate smart highlights!",
    "highlight.reapply": "Reapply",
    "highlight.clearAll": "Clear All",
    "highlight.deleteConfirm": "Delete this highlight?",
    "highlight.clearConfirm": "Delete all highlights for this page?",

    // Comment tab
    "comment.title": "Quick Notes",
    "comment.newNote": "New Note",
    "comment.editNote": "Edit Note",
    "comment.placeholder": "Write your thoughts, questions, or key points here...",
    "comment.save": "Save Note",
    "comment.update": "Update Note",
    "comment.cancel": "Cancel",
    "comment.savedNotes": "Saved Notes",
    "comment.empty": "No notes yet",
    "comment.emptyDesc": "Select text and create your first note!",
    "comment.clearAll": "Clear All",
    "comment.deleteConfirm": "Delete this note?",
    "comment.clearConfirm": "Delete all notes for this page?",

    // Q&A tab
    "qa.title": "Paper Q&A",
    "qa.contextSet": "Context",
    "qa.contextEmpty": "Select text from PDF and refresh to set context",
    "qa.update": "Update",
    "qa.empty": "Ask questions about the paper",
    "qa.emptyDesc": "Select text, refresh, then start chatting!",
    "qa.placeholder": "Ask a question about the paper...",
    "qa.send": "Send",
    "qa.thinking": "Thinking...",
    "qa.clearChat": "Clear Chat History",
    "qa.clearConfirm": "Clear chat history for this page?",

    // Metadata
    "metadata.extract": "Extract Paper Metadata",
    "metadata.extracting": "Extracting...",
    "metadata.authors": "Authors",
    "metadata.year": "Year",
    "metadata.journal": "Journal",
    "metadata.doi": "DOI",
    "metadata.copyCitation": "Copy Citation",

    // Common
    "common.selectedText": "Selected Text",
    "common.selectTextHint": "Select text from the PDF page, then click 'Refresh' button above.",
    "common.charsSelected": "characters selected",
    "common.output": "Output",
    "common.apiKeyMissing": "API Key Not Configured\n\nPlease configure your OpenAI API Key first:\n1. Right-click extension icon\n2. Select 'Options'\n3. Enter your API Key",
    "common.selectTextFirst": "Please select text first",

    // Reading Goal
    "readingGoal.title": "Reading Goal",
    "readingGoal.understandMethod": "Understand Method",
    "readingGoal.understandMethodDesc": "Focus on methodology and technical approach",
    "readingGoal.findDetails": "Find Implementation Details",
    "readingGoal.findDetailsDesc": "Focus on implementation specifics and parameters",
    "readingGoal.evaluateNovelty": "Evaluate Novelty",
    "readingGoal.evaluateNoveltyDesc": "Focus on innovation and contributions",
    "readingGoal.prepareCitation": "Prepare for Citation",
    "readingGoal.prepareCitationDesc": "Focus on key findings for reference",

    // Options page
    "options.title": "Impulse Settings",
    "options.subtitle": "Configure your OpenAI API key to unlock AI-powered features",
    "options.apiKeyLabel": "OpenAI API Key",
    "options.modelLabel": "AI Model",
    "options.save": "Save Configuration",
    "options.saving": "Saving...",
    "options.languageLabel": "Language",
    "options.themeLabel": "Theme",
    "options.themLight": "Light",
    "options.themeDark": "Dark",
    "options.privacy": "Your API key is stored locally and never sent to our servers"
  },

  zh: {
    // Header
    "app.title": "Impulse",
    "app.subtitle": "AI 驱动的 PDF 阅读助手",
    "btn.refresh": "刷新选中",
    "btn.loading": "加载中...",

    // Tabs
    "tab.summary": "摘要",
    "tab.translate": "翻译",
    "tab.highlight": "高亮",
    "tab.comment": "笔记",
    "tab.qa": "问答",

    // Summary tab
    "summary.title": "AI 摘要",
    "summary.generate": "生成摘要",
    "summary.generating": "生成中...",
    "summary.placeholder": "摘要将显示在这里...",

    // Translation tab
    "translate.title": "AI 翻译",
    "translate.generate": "翻译为中文",
    "translate.generating": "翻译中...",
    "translate.placeholder": "翻译结果将显示在这里...",

    // Highlight tab
    "highlight.title": "智能高亮",
    "highlight.generate": "生成高亮",
    "highlight.generating": "生成中...",
    "highlight.active": "当前高亮",
    "highlight.empty": "暂无高亮",
    "highlight.emptyDesc": "选中文本并生成智能高亮!",
    "highlight.reapply": "重新应用",
    "highlight.clearAll": "全部清除",
    "highlight.deleteConfirm": "删除此高亮?",
    "highlight.clearConfirm": "删除此页面所有高亮?",

    // Comment tab
    "comment.title": "快速笔记",
    "comment.newNote": "新笔记",
    "comment.editNote": "编辑笔记",
    "comment.placeholder": "写下你的想法、问题或要点...",
    "comment.save": "保存笔记",
    "comment.update": "更新笔记",
    "comment.cancel": "取消",
    "comment.savedNotes": "已保存笔记",
    "comment.empty": "暂无笔记",
    "comment.emptyDesc": "选中文本并创建你的第一条笔记!",
    "comment.clearAll": "全部清除",
    "comment.deleteConfirm": "删除此笔记?",
    "comment.clearConfirm": "删除此页面所有笔记?",

    // Q&A tab
    "qa.title": "论文问答",
    "qa.contextSet": "上下文",
    "qa.contextEmpty": "请先在 PDF 中选中文本并刷新以设置上下文",
    "qa.update": "更新",
    "qa.empty": "向 AI 提问关于论文的问题",
    "qa.emptyDesc": "选中文本，刷新，然后开始聊天!",
    "qa.placeholder": "请输入关于论文的问题...",
    "qa.send": "发送",
    "qa.thinking": "思考中...",
    "qa.clearChat": "清除聊天记录",
    "qa.clearConfirm": "清除此页面的聊天记录?",

    // Metadata
    "metadata.extract": "提取论文元数据",
    "metadata.extracting": "提取中...",
    "metadata.authors": "作者",
    "metadata.year": "年份",
    "metadata.journal": "期刊",
    "metadata.doi": "DOI",
    "metadata.copyCitation": "复制引用",

    // Common
    "common.selectedText": "选中文本",
    "common.selectTextHint": "在 PDF 页面选中文本，然后点击上方「刷新选中」按钮。",
    "common.charsSelected": "个字符已选中",
    "common.output": "输出",
    "common.apiKeyMissing": "未配置 API Key\n\n请先配置 OpenAI API Key:\n1. 右键点击扩展图标\n2. 选择「选项」\n3. 输入 API Key",
    "common.selectTextFirst": "请先选中文本",

    // Reading Goal
    "readingGoal.title": "阅读目标",
    "readingGoal.understandMethod": "了解方法",
    "readingGoal.understandMethodDesc": "侧重方法论和技术路线",
    "readingGoal.findDetails": "寻找实现细节",
    "readingGoal.findDetailsDesc": "侧重具体实现和参数设置",
    "readingGoal.evaluateNovelty": "评估新颖性",
    "readingGoal.evaluateNoveltyDesc": "侧重创新点和学术贡献",
    "readingGoal.prepareCitation": "准备引用",
    "readingGoal.prepareCitationDesc": "侧重关键发现和结论",

    // Options page
    "options.title": "Impulse 设置",
    "options.subtitle": "配置 OpenAI API Key 以启用 AI 功能",
    "options.apiKeyLabel": "OpenAI API Key",
    "options.modelLabel": "AI 模型",
    "options.save": "保存配置",
    "options.saving": "保存中...",
    "options.languageLabel": "语言",
    "options.themeLabel": "主题",
    "options.themLight": "浅色",
    "options.themeDark": "深色",
    "options.privacy": "API Key 仅存储在本地，不会发送到我们的服务器"
  }
}

let currentLang: Language = "en"

export function setCurrentLanguage(lang: Language): void {
  currentLang = lang
}

export function getCurrentLanguage(): Language {
  return currentLang
}

export function t(key: string): string {
  return translations[currentLang]?.[key] || translations.en[key] || key
}
