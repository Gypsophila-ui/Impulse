import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const QUICK_ACTIONS_ID = "impulse-quick-actions"
const MIN_SELECTION_LENGTH = 3
const HIDE_DELAY = 200

interface QuickAction {
  id: string
  label: string
  icon: string
  shortcut?: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "translate", label: "翻译", icon: "🌐", shortcut: "T" },
  { id: "summarize", label: "摘要", icon: "📝", shortcut: "S" },
  { id: "explain", label: "术语", icon: "💡", shortcut: "E" },
  { id: "highlight", label: "高亮", icon: "🖍️", shortcut: "H" },
  { id: "note", label: "笔记", icon: "📌", shortcut: "N" }
]

let currentSelection = ""
let hideTimeout: ReturnType<typeof setTimeout> | null = null
let toolbarElement: HTMLElement | null = null
let isToolbarHovered = false

const isExtensionContextValid = (): boolean => {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

const getSelectionText = (): string => {
  const selection = window.getSelection()
  return selection ? selection.toString().trim() : ""
}

const getSelectionCoordinates = (): { x: number; y: number } | null => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  return {
    x: rect.left + rect.width / 2,
    y: rect.top
  }
}

const createToolbar = (): HTMLElement => {
  const existing = document.getElementById(QUICK_ACTIONS_ID)
  if (existing) existing.remove()

  const toolbar = document.createElement("div")
  toolbar.id = QUICK_ACTIONS_ID

  Object.assign(toolbar.style, {
    position: "fixed",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "6px 8px",
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
    borderRadius: "8px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "13px",
    transition: "opacity 0.15s ease, transform 0.15s ease",
    opacity: "0",
    transform: "translateY(-4px)"
  })

  QUICK_ACTIONS.forEach((action, index) => {
    const btn = document.createElement("button")
    btn.className = `impulse-action-btn impulse-action-${action.id}`
    btn.title = action.shortcut ? `${action.label} (${action.shortcut})` : action.label

    Object.assign(btn.style, {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "6px 10px",
      border: "none",
      background: "transparent",
      borderRadius: "6px",
      cursor: "pointer",
      color: "#374151",
      fontSize: "12px",
      fontWeight: "500",
      transition: "all 0.15s ease",
      whiteSpace: "nowrap"
    })

    btn.innerHTML = `<span style="font-size: 14px;">${action.icon}</span><span>${action.label}</span>`

    btn.addEventListener("mouseenter", () => {
      Object.assign(btn.style, {
        background: "#f3f4f6",
        color: "#8b5cf6"
      })
    })

    btn.addEventListener("mouseleave", () => {
      Object.assign(btn.style, {
        background: "transparent",
        color: "#374151"
      })
    })

    btn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      handleActionClick(action.id)
    })

    toolbar.appendChild(btn)

    if (index < QUICK_ACTIONS.length - 1) {
      const divider = document.createElement("div")
      Object.assign(divider.style, {
        width: "1px",
        height: "16px",
        background: "#e5e7eb",
        margin: "0 2px"
      })
      toolbar.appendChild(divider)
    }
  })

  toolbar.addEventListener("mouseenter", () => {
    isToolbarHovered = true
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
  })

  toolbar.addEventListener("mouseleave", () => {
    isToolbarHovered = false
    scheduleHide()
  })

  document.body.appendChild(toolbar)

  requestAnimationFrame(() => {
    Object.assign(toolbar.style, {
      opacity: "1",
      transform: "translateY(0)"
    })
  })

  return toolbar
}

const positionToolbar = (toolbar: HTMLElement, x: number, y: number) => {
  const rect = toolbar.getBoundingClientRect()
  const padding = 10

  let left = x - rect.width / 2
  let top = y - rect.height - padding

  if (left < padding) left = padding
  if (left + rect.width > window.innerWidth - padding) {
    left = window.innerWidth - rect.width - padding
  }

  if (top < padding) {
    top = y + padding + 20
  }

  Object.assign(toolbar.style, {
    left: `${left}px`,
    top: `${top}px`
  })
}

const showToolbar = () => {
  if (!currentSelection || currentSelection.length < MIN_SELECTION_LENGTH) return

  const coords = getSelectionCoordinates()
  if (!coords) return

  if (!toolbarElement) {
    toolbarElement = createToolbar()
  }

  positionToolbar(toolbarElement, coords.x, coords.y)
}

const hideToolbar = () => {
  if (toolbarElement) {
    Object.assign(toolbarElement.style, {
      opacity: "0",
      transform: "translateY(-4px)"
    })

    setTimeout(() => {
      if (toolbarElement) {
        toolbarElement.remove()
        toolbarElement = null
      }
    }, 150)
  }
}

const scheduleHide = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
  }

  hideTimeout = setTimeout(() => {
    if (!isToolbarHovered) {
      hideToolbar()
    }
  }, HIDE_DELAY)
}

const handleActionClick = (actionId: string) => {
  if (!currentSelection || !isExtensionContextValid()) return

  try {
    chrome.runtime.sendMessage({
      type: "QUICK_ACTION",
      action: actionId,
      text: currentSelection,
      url: window.location.href,
      title: document.title
    })
  } catch {
    // Extension context may be invalidated
  }

  hideToolbar()
}

const handleSelectionChange = () => {
  const text = getSelectionText()

  if (text.length >= MIN_SELECTION_LENGTH) {
    currentSelection = text
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    showToolbar()
  } else {
    currentSelection = ""
    scheduleHide()
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (!currentSelection || !toolbarElement) return

  const target = e.target as HTMLElement
  const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
  if (isTyping) return

  const action = QUICK_ACTIONS.find((a) => a.shortcut?.toLowerCase() === e.key.toLowerCase())
  if (action) {
    e.preventDefault()
    handleActionClick(action.id)
  }

  if (e.key === "Escape") {
    hideToolbar()
  }
}

const handleMouseDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (toolbarElement && !toolbarElement.contains(target)) {
    scheduleHide()
  }
}

document.addEventListener("selectionchange", handleSelectionChange)
document.addEventListener("keydown", handleKeyDown)
document.addEventListener("mousedown", handleMouseDown)

const style = document.createElement("style")
style.textContent = `
  @keyframes impulse-fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .impulse-action-btn:active {
    transform: scale(0.95);
  }

  @media (prefers-color-scheme: dark) {
    #${QUICK_ACTIONS_ID} {
      background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%) !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
    }

    .impulse-action-btn {
      color: #e5e5e5 !important;
    }

    .impulse-action-btn:hover {
      background: #3d3d5c !important;
      color: #a78bfa !important;
    }
  }
`
document.head.appendChild(style)

export {}
