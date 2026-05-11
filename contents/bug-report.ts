import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const isExtensionContextValid = (): boolean => {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "COLLECT_PAGE_INFO") return

  if (!isExtensionContextValid()) return

  try {
    const highlightCount = document.querySelectorAll("mark.impulse-highlight").length

    const hasPDFEmbed = document.querySelector("embed[type='application/pdf']") !== null
    const hasPDFObject = document.querySelector("object[type='application/pdf']") !== null
    const hasPDFIframe = document.querySelector("iframe[src*='.pdf']") !== null

    const info = {
      url: window.location.href,
      title: document.title,
      highlightCount,
      pdfViewerDetected: hasPDFEmbed || hasPDFObject || hasPDFIframe,
      readyState: document.readyState
    }

    try {
      sendResponse(info)
    } catch {
      // context may have invalidated
    }
  } catch (e) {
    try {
      sendResponse({ error: String(e) })
    } catch {
      // ignore
    }
  }
})

export {}
