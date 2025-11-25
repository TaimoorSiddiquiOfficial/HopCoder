/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'matte-black': '#0A0A0A',
        'surface': '#121212',
        'surface-light': '#1E1E1E',
        'gold': '#D4AF37',
        'gold-light': '#F4C430',
        'gold-dim': '#8A7E57',
      }
    },
  },
  plugins: [],
}
