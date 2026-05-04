/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f8fb',
          100: '#eaeef4',
          200: '#d2dae5',
          300: '#aab8cc',
          400: '#7a8ca8',
          500: '#566b8b',
          600: '#41556f',
          700: '#324358',
          800: '#1f2c3d',
          900: '#11192a',
          950: '#080d18',
        },
        wave: {
          50: '#eef9fc',
          100: '#d4f0f8',
          200: '#abe1f0',
          300: '#74cce4',
          400: '#3eb0d2',
          500: '#1d92b8',
          600: '#1a779a',
          700: '#1c607d',
          800: '#1f5067',
          900: '#1d4257',
        },
        algae: {
          400: '#46c79a',
          500: '#1faa7c',
          600: '#178b66',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 25, 42, 0.04), 0 4px 12px rgba(17, 25, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
