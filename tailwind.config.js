/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f1113',
        electric: '#25aef4',
        skyline: '#48c4ff',
      },
      fontFamily: {
        podium: ['Righteous', 'sans-serif'],
        inter: ['Righteous', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(37, 174, 244, 0.28)',
      },
    },
  },
  plugins: [],
};
