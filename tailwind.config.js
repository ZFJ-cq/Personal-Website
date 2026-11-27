/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    screens: {
      xs: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1440px',
    },
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        line: 'var(--border)',
        ink: 'var(--text)',
        dim: 'var(--text-dim)',
        primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
        success: 'var(--success)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '14px',
        lg: '16px',
      },
      fontFamily: {
        display: ['"Songti SC"', '"Source Han Serif SC"', '"Noto Serif CJK SC"', 'STSong', 'Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"SFMono-Regular"', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.2)',
        float: '0 8px 24px rgba(0,0,0,.35)',
        modal: '0 24px 64px rgba(0,0,0,.5)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.22,.61,.36,1)',
      },
    },
  },
  plugins: [],
}
