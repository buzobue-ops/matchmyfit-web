/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fmc: {
          cream:   '#F5F0E8',
          ink:     '#111111',
          warm:    '#C8A882',
          accent:  '#E8D5B7',
          muted:   '#8C8279',
          surface: '#FDFAF5',
          border:  '#E2DAD0',
          'tag-bg':'#F0EAE0',
          'app-bg':'#EDEAE4',
        },
        ios: {
          blue: '#007AFF',
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500',
          gray: {
            1: '#8E8E93',
            2: '#AEAEB2',
            3: '#C7C7CC',
            4: '#D1D1D6',
            5: '#E5E5EA',
            6: '#F2F2F7',
          },
          label: '#000000',
          secondaryLabel: '#3C3C43',
          bg: '#F2F2F7',
          groupedBg: '#F2F2F7',
          card: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'Times New Roman', 'serif'],
      },
      borderRadius: {
        ios: '10px',
        'ios-lg': '14px',
        'ios-xl': '20px',
      },
      boxShadow: {
        ios: '0 2px 10px rgba(0,0,0,0.08)',
        'ios-md': '0 4px 20px rgba(0,0,0,0.12)',
        'ios-lg': '0 8px 30px rgba(0,0,0,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
      },
    },
  },
  plugins: [],
}
