import React, { useState } from "react"
import { Settings, X } from "lucide-react"

import { resetClient } from "~utils/llm-client"
import { clearConfig, saveLLMConfig } from "~utils/storage"

interface ConfigPreset {
  label: string
  baseURL: string
  models: string[]
}

const configPresets: ConfigPreset[] = [
  { label: "OpenAI", baseURL: "", models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] },
  { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", models: ["deepseek-chat", "deepseek-reasoner"] },
  { label: "Qwen", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-plus", "qwen-turbo", "qwen-max"] },
  { label: "Custom", baseURL: "custom", models: [] }
]

interface ConfigModalProps {
  show: boolean
  onClose: () => void
  initialApiKey?: string
  initialBaseURL?: string
  initialModel?: string
  onSave: (hasKey: boolean) => void
}

const ConfigModal: React.FC<ConfigModalProps> = ({
  show,
  onClose,
  initialApiKey = "",
  initialBaseURL = "",
  initialModel = "gpt-4o-mini",
  onSave
}) => {
  const [configApiKey, setConfigApiKey] = useState(initialApiKey)
  const [configBaseURL, setConfigBaseURL] = useState(initialBaseURL)
  const [configModel, setConfigModel] = useState(initialModel)
  const [configSaving, setConfigSaving] = useState(false)
  const [configMessage, setConfigMessage] = useState("")
  const [showConfigKey, setShowConfigKey] = useState(false)

  const activeConfigPreset = configPresets.find((p) =>
    p.label === "Custom" ? false : p.baseURL === configBaseURL
  ) || (configBaseURL ? configPresets.find((p) => p.label === "Custom") : configPresets[0])

  if (!show) return null

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease"
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
            padding: "16px 20px",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
            <Settings size={18} /> Configure API
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              API Key *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfigKey ? "text" : "password"}
                value={configApiKey}
                onChange={(e) => setConfigApiKey(e.target.value)}
                placeholder="sk-..."
                style={{
                  width: "100%",
                  padding: "10px 36px 10px 10px",
                  fontSize: 13,
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
              <button
                type="button"
                onClick={() => setShowConfigKey(!showConfigKey)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2 }}
              >
                {showConfigKey ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Provider
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {configPresets.map((preset) => {
                const isActive = preset.label === "Custom"
                  ? activeConfigPreset?.label === "Custom"
                  : configBaseURL === preset.baseURL
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      if (preset.label === "Custom") {
                        setConfigBaseURL("custom")
                      } else {
                        setConfigBaseURL(preset.baseURL)
                        if (preset.models.length > 0) setConfigModel(preset.models[0])
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      border: isActive ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                      borderRadius: 6,
                      background: isActive ? "#eff6ff" : "#fff",
                      color: isActive ? "#3b82f6" : "#374151",
                      cursor: "pointer"
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            {activeConfigPreset?.label === "Custom" && (
              <input
                type="text"
                value={configBaseURL === "custom" ? "" : configBaseURL}
                onChange={(e) => setConfigBaseURL(e.target.value || "custom")}
                placeholder="https://your-api-endpoint.com/v1"
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "10px",
                  fontSize: 13,
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Model
            </label>
            {activeConfigPreset && activeConfigPreset.models.length > 0 ? (
              <select
                value={configModel}
                onChange={(e) => setConfigModel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: 13,
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {activeConfigPreset.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={configModel}
                onChange={(e) => setConfigModel(e.target.value)}
                placeholder="model-name"
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: 13,
                  border: "2px solid #e5e7eb",
                  borderRadius: 8,
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              disabled={configSaving || !configApiKey.trim()}
              onClick={async () => {
                if (!configApiKey.trim()) {
                  setConfigMessage("error:Please enter your API Key")
                  return
                }
                setConfigSaving(true)
                setConfigMessage("")
                try {
                  const effectiveBaseURL = configBaseURL === "custom" ? "" : configBaseURL
                  await saveLLMConfig({
                    provider: "openai",
                    apiKey: configApiKey.trim(),
                    model: configModel,
                    baseURL: effectiveBaseURL || undefined
                  })
                  resetClient()
                  onSave(true)
                  setConfigMessage("success:Saved!")
                  setTimeout(() => {
                    setConfigMessage("")
                    onClose()
                  }, 1200)
                } catch (e: any) {
                  setConfigMessage(`error:${e?.message ?? String(e)}`)
                } finally {
                  setConfigSaving(false)
                }
              }}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: configSaving || !configApiKey.trim() ? "#cbd5e1" : "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: configSaving || !configApiKey.trim() ? "not-allowed" : "pointer"
              }}
            >
              {configSaving ? "Saving..." : "Save"}
            </button>
            {configApiKey && (
              <button
                onClick={async () => {
                  if (confirm("Clear API configuration?")) {
                    await clearConfig()
                    setConfigApiKey("")
                    setConfigBaseURL("")
                    setConfigModel("gpt-4o-mini")
                    onSave(false)
                    setConfigMessage("success:Cleared")
                    setTimeout(() => setConfigMessage(""), 2000)
                  }
                }}
                style={{
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#fff",
                  color: "#ef4444",
                  border: "2px solid #ef4444",
                  borderRadius: 8,
                  cursor: "pointer"
                }}
              >
                🗑️
              </button>
            )}
          </div>

          {configMessage && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                fontSize: 12,
                borderRadius: 8,
                background: configMessage.startsWith("success") ? "#d1fae5" : "#fee2e2",
                color: configMessage.startsWith("success") ? "#065f46" : "#991b1b",
                animation: "fadeIn 0.3s ease"
              }}
            >
              {configMessage.split(":").slice(1).join(":")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConfigModal
