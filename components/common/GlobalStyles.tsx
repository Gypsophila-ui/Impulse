import React from "react"

const GlobalStyles: React.FC = () => (
  <style>{`
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .btn-hover {
      transition: all 0.2s ease;
    }
    .btn-hover:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .btn-hover:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .tab-btn {
      transition: all 0.2s ease;
    }
    .tab-btn:hover {
      transform: translateY(-2px);
    }
  `}</style>
)

export default GlobalStyles
