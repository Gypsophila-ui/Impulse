import React, { useEffect, useState } from "react"

import { clearConfig, getLLMConfig, saveLLMConfig } from "~utils/storage"

// Spinner component
const Spinner = () => (
  <div
    style={{
      display: "inline-block",
      width: 16,
      height: 16,
      border: "2px solid rgba(255, 255, 255, 0.3)",
      borderTop: "2px solid #fff",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite"
    }}
  />
)

export default function Options() {
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("gpt-4o-mini")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    // Load existing config
    getLLMConfig().then((config) => {
      if (config) {
        setApiKey(config.apiKey)
        if (config.model) setModel(config.model)
      }
    })
  }, [])

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage("error:Please enter your OpenAI API Key")
      return
    }

    // Basic validation
    if (!apiKey.startsWith("sk-")) {
      setMessage("error:Invalid API Key format. It should start with 'sk-'")
      return
    }

    setSaving(true)
    setMessage("")

    try {
      await saveLLMConfig({
        provider: "openai",
        apiKey: apiKey.trim(),
        model
      })
      setMessage("success:Configuration saved successfully! 🎉")
      setTimeout(() => setMessage(""), 3000)
    } catch (e: any) {
      setMessage(`error:Failed to save: ${e?.message ?? String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear your API Key configuration?")) {
      try {
        await clearConfig()
        setApiKey("")
        setModel("gpt-4o-mini")
        setMessage("success:Configuration cleared")
        setTimeout(() => setMessage(""), 3000)
      } catch (e: any) {
        setMessage(`error:Failed to clear: ${e?.message ?? String(e)}`)
      }
    }
  }

  const messageType = message.split(":")[0]
  const messageText = message.split(":")[1] || message

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
        padding: "40px 20px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial'
      }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hover-lift {
          transition: all 0.2s ease;
        }
        .hover-lift:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }
        input:focus, select:focus {
          outline: none;
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
      `}</style>

      <div
        style={{
          maxWidth: 600,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
          animation: "fadeIn 0.5s ease"
        }}>
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
            padding: "32px",
            color: "#fff",
            textAlign: "center"
          }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Impulse Settings</h1>
          <p style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: 14 }}>
            Configure your OpenAI API key to unlock AI-powered features
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "32px" }}>
          {/* Info Banner */}
          <div
            style={{
              padding: 16,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 10,
              marginBottom: 24,
              display: "flex",
              gap: 12,
              alignItems: "start"
            }}>
            <div style={{ fontSize: 20 }}>💡</div>
            <div style={{ fontSize: 13, color: "#1e40af", lineHeight: "20px" }}>
              <strong>Getting Started:</strong>
              <br />
              1. Get your API key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#2563eb", textDecoration: "underline" }}>
                OpenAI Platform
              </a>
              <br />
              2. Choose your preferred model
              <br />
              3. Save and start using AI features!
            </div>
          </div>

          {/* API Key Input */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 8,
                fontSize: 13,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              🔑 OpenAI API Key *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-proj-..."
                style={{
                  width: "100%",
                  padding: "12px 40px 12px 12px",
                  fontSize: 14,
                  border: "2px solid #e5e7eb",
                  borderRadius: 10,
                  boxSizing: "border-box",
                  transition: "all 0.2s ease",
                  fontFamily: "monospace"
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  padding: 4
                }}
                title={showKey ? "Hide" : "Show"}>
                {showKey ? "🙈" : "👁️"}
              </button>
            </div>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 6, lineHeight: "18px" }}>
              Your API key is stored locally and never sent to our servers
            </p>
          </div>

          {/* Model Selection */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 8,
                fontSize: 13,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              🤖 AI Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                fontSize: 14,
                border: "2px solid #e5e7eb",
                borderRadius: 10,
                background: "#fff",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}>
              <option value="gpt-4o-mini">GPT-4o Mini (Recommended - Fast & Affordable)</option>
              <option value="gpt-4o">GPT-4o (Most Capable)</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Budget Option)</option>
            </select>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 6, lineHeight: "18px" }}>
              Choose based on your needs. GPT-4o Mini offers the best balance.
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="hover-lift"
              style={{
                flex: 1,
                padding: "14px 20px",
                fontSize: 14,
                fontWeight: 600,
                background:
                  saving || !apiKey.trim()
                    ? "#cbd5e1"
                    : "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                cursor: saving || !apiKey.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)"
              }}>
              {saving ? (
                <>
                  <Spinner /> Saving...
                </>
              ) : (
                <>💾 Save Configuration</>
              )}
            </button>
            {apiKey && (
              <button
                onClick={handleClear}
                disabled={saving}
                className="hover-lift"
                style={{
                  padding: "14px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "#fff",
                  color: "#ef4444",
                  border: "2px solid #ef4444",
                  borderRadius: 10,
                  cursor: saving ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.background = "#ef4444"
                    e.currentTarget.style.color = "#fff"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff"
                  e.currentTarget.style.color = "#ef4444"
                }}>
                🗑️
              </button>
            )}
          </div>

          {/* Message */}
          {message && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                fontSize: 13,
                borderRadius: 10,
                background: messageType === "success" ? "#d1fae5" : "#fee2e2",
                color: messageType === "success" ? "#065f46" : "#991b1b",
                border: `2px solid ${messageType === "success" ? "#6ee7b7" : "#fca5a5"}`,
                animation: "fadeIn 0.3s ease",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
              <div style={{ fontSize: 18 }}>{messageType === "success" ? "✅" : "⚠️"}</div>
              <div style={{ flex: 1 }}>{messageText}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "20px 32px",
            background: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#6b7280",
            textAlign: "center"
          }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Privacy Notice:</strong> Your API key is stored locally in your browser and is
            only used to communicate directly with OpenAI.
          </div>
          <div>
            Need help? Visit{" "}
            <a
              href="https://platform.openai.com/docs"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#3b82f6", textDecoration: "underline" }}>
              OpenAI Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
