/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#141414',
        electric: '#38b6ff',
        skyline: '#48c4ff',
      },
      fontFamily: {
        podium: ['Montserrat', 'sans-serif'],
        inter: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(56, 182, 255, 0.28)',
      },
    },
  },
  plugins: [],
};
