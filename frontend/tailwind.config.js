/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"General Sans"', '-apple-system', 'sans-serif'],
        sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        genesis: {
          primary: '#6366F1',
          'primary-hover': '#4F46E5',
          secondary: '#20970B',
          neutral: '#9C9C9C',
          bg: '#FAFAFA',
          surface: '#FFFFFF',
          text: '#0A0A0A',
          'text-secondary': '#6B6B6B',
          border: '#E8E8EC',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        },
        heat: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      borderRadius: {
        '4px': '4px',
        '6px': '6px',
        '8px': '8px',
        '12px': '12px',
      },
      boxShadow: {
        'genesis-card': '0 8px 30px rgba(0, 0, 0, 0.08)',
        'genesis-glow': '0 4px 12px rgba(99, 102, 241, 0.35)',
      },
    },
  },
  plugins: [],
}
