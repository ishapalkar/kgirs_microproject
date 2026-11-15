/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        sunken: v('sunken'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        'line-strong': v('line-strong'),
        accent: { DEFAULT: v('accent'), soft: v('accent-soft'), ink: v('accent-ink') },
        risk: { low: v('risk-low'), moderate: v('risk-moderate'), high: v('risk-high'), critical: v('risk-critical') },
        danger: v('danger'),
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.875rem', { lineHeight: '1.45' }],
        base: ['1rem', { lineHeight: '1.55' }],
        lg: ['1.25rem', { lineHeight: '1.35' }],
        xl: ['1.625rem', { lineHeight: '1.2' }],
        '2xl': ['2.25rem', { lineHeight: '1.1' }],
        '3xl': ['3.25rem', { lineHeight: '1.02' }],
      },
      borderRadius: { sm: '6px', DEFAULT: '10px', lg: '14px', xl: '20px' },
      transitionTimingFunction: { out: 'cubic-bezier(0.2, 0, 0, 1)' },
    },
  },
  plugins: [],
}
