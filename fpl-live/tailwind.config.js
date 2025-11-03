/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fplPurple: '#37003c',
        fplTeal: '#00ff87',
        fplGreen: '#04f5c4',
        fplDark: '#0b0b0b',
        fplGray: '#1a1a1a',
      },
      fontFamily: {
        fpl: ['"Poppins"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
