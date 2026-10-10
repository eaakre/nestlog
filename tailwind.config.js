/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#12151F',
          900: '#1B2130',
          800: '#242C3F',
          700: '#323C54',
          600: '#4A5570'
        },
        parchment: {
          100: '#F7F3E9',
          200: '#EDE6D6',
          300: '#DCD3BE'
        },
        dusk: {
          400: '#D99AA1',
          500: '#C97B84',
          600: '#B15F6C'
        },
        sage: {
          400: '#A3BFA0',
          500: '#8CA88C',
          600: '#729173'
        },
        amber: {
          400: '#E8BE7B',
          500: '#DDA85B'
        },
        header: {
          sleep: '#AEE0EF',
          pump: '#F2A79E',
          feed: '#F0C24C',
          diaper: '#F2ECD8'
        }
      },
      fontFamily: {
        display: ['"Lora"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        card: '20px'
      }
    }
  },
  plugins: []
}
