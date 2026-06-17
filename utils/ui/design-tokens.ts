/**
 * Design tokens for consistent UI styling
 */

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: "50%",
  bubble: {
    user: "18px 18px 4px 18px",
    assistant: "18px 18px 18px 4px"
  }
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24
} as const

export const shadows = {
  sm: "0 1px 3px rgba(0, 0, 0, 0.1)",
  md: "0 2px 8px rgba(0, 0, 0, 0.1)",
  lg: "0 4px 12px rgba(0, 0, 0, 0.15)",
  xl: "0 8px 20px rgba(0, 0, 0, 0.2)",
  xxl: "0 20px 40px rgba(0, 0, 0, 0.3)"
} as const

export const transitions = {
  fast: "all 0.15s ease",
  normal: "all 0.2s ease",
  slow: "all 0.3s ease"
} as const
