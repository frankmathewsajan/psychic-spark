/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          900: "#0f172a",
        },
        safety: {
          50: "#ecfdf5",
          500: "#10b981",
          700: "#047857",
        },
        hazard: {
          50: "#fef2f2",
          500: "#ef4444",
          700: "#b91c1c",
        },
        amber: {
          50: "#fffbeb",
          500: "#f59e0b",
          700: "#b45309",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        elevation1: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)",
        elevation2: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.06)",
        elevation3: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.05)",
      }
    },
  },
  plugins: [],
}
