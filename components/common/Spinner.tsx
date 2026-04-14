import React from "react"
import { borderRadius } from "~utils/design-tokens"

const Spinner: React.FC = () => (
  <div
    style={{
      display: "inline-block",
      width: 16,
      height: 16,
      border: "2px solid rgba(255, 255, 255, 0.3)",
      borderTop: "2px solid #fff",
      borderRadius: borderRadius.full,
      animation: "spin 0.8s linear infinite"
    }}
  />
)

export default Spinner
