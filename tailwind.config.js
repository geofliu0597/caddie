/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        turf: {
          50: '#f0f7f2',
          100: '#dcecdf',
          200: '#b9d6c1',
          300: '#8ab497',
          400: '#5a8265',
          500: '#3e5a45',
          600: '#2a3d2e',
          700: '#1c2a1f',
          800: '#131c15',
          900: '#0c120d',
          950: '#070b08',
        },
      },
    },
  },
  plugins: [],
};
