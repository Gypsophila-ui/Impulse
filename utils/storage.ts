/**
 * Chrome storage utility for persisting configuration and API keys
 */

export interface LLMConfig {
  provider: "openai"
  apiKey: string
  model?: string
}

const STORAGE_KEYS = {
  LLM_CONFIG: "llm_config"
} as const

export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.LLM_CONFIG]: config
  })
}

export async function getLLMConfig(): Promise<LLMConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LLM_CONFIG)
  return result[STORAGE_KEYS.LLM_CONFIG] || null
}

export async function hasApiKey(): Promise<boolean> {
  const config = await getLLMConfig()
  return Boolean(config?.apiKey)
}

export async function clearConfig(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.LLM_CONFIG)
}
