/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme'

// Every color family the app uses reads from CSS variables (src/theme.css), so
// the dashboard can run dark while the visitor widget keeps its light look.
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const FAMILIES = [
  'zinc', 'gray', 'brand',
  'red', 'amber', 'emerald', 'green', 'violet', 'sky', 'teal', 'indigo', 'yellow', 'orange', 'rose',
]
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
const scale = (family) => Object.fromEntries(STEPS.map((s) => [s, v(`${family}-${s}`)]))

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', ...defaultTheme.fontFamily.sans],
        display: ['Geist', ...defaultTheme.fontFamily.sans],
        mono: ['"Geist Mono"', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        white: v('white'),
        page: v('page'),
        // Hairline used for the landing page's framing rails and section dividers.
        rail: 'rgba(255, 255, 255, 0.08)',
        ...Object.fromEntries(FAMILIES.map((f) => [f, scale(f)])),
      },
    },
  },
  plugins: [],
}
