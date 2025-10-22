/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        brand: {
          50: '#E6F2FF',
          100: '#CCE5FF',
          200: '#99CBFF',
          300: '#66B0FF',
          400: '#3396FF',
          500: '#007BFF', // Primary brand color
          600: '#0062CC',
          700: '#004A99',
          800: '#003166',
          900: '#001933',
        },
        // Enterprise theme support
        capgemini: {
          primary: '#0070AD',
          secondary: '#00447C',
          accent: '#00A3E0',
        },
        ey: {
          primary: '#FFE600',
          secondary: '#2E2E38',
          accent: '#FFC600',
        },
        servicenow: {
          primary: '#00457C',
          secondary: '#00A1E0',
          accent: '#88C342',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
