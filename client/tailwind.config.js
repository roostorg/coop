import kit from '@kojodesign/tailwindkit';
import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,astro,tsx}',
    './components/**/*.{ts,astro,tsx}',
    './app/**/*.{ts,astro,tsx}',
    './src/**/*.{ts,astro,tsx}',
  ],
  prefix: '',
  theme: {
    extend: {
      height: {
        '1/2': '50%',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'carousel-left': 'carousel-left 60s linear infinite',
        'carousel-right': 'carousel-right 60s linear infinite',
        'spin-gradient': 'glow-spin 20s ease-in-out infinite',
      },
      colors: {
        // SHADCN themeable variables
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        'coop-dark-purple': '#2f2745',
        'coop-dark-purple-hover': '#160e1a',
        'coop-purple': '#756ab9',
        'coop-purple-hover': '#514982',
        'coop-purple-selected': '#443c75',
        'coop-lightpurple': '#e4e2ec',
        'coop-lightpurple-hover': '#c6c4cf',
        'coop-blue': '#6aa9f6',
        'coop-blue-hover': '#5589c9',
        'coop-lightblue': '#daecfd',
        'coop-lightblue-hover': '#cce5fc',
        'coop-red': '#e9958c',
        'coop-red-hover': '#b06f68',
        'coop-lightred': '#f7e0d7',
        'coop-lightred-hover': '#d4bbb2',
        'coop-orange': '#f3c07a',
        'coop-orange-hover': '#e0a758',
        'coop-lightorange': '#fcebd4',
        'coop-lightorange-hover': '#dec9ad',
        'coop-green': '#8cc084',
        'coop-green-hover': '#638a5f',
        'coop-lightgreen': '#d8ebd2',
        'coop-lightgreen-hover': '#accfa9',
        'coop-yellow': '#f5d76e',
        'coop-yellow-hover': '#d2b457',
        'coop-lightyellow': '#fef5cf',
        'coop-lightyellow-hover': '#eadfaa',
        'coop-pink': '#f69ebd',
        'coop-pink-hover': '#d8759e',
        'coop-lightpink': '#fcd7e7',
        'coop-lightpink-hover': '#e0aad1',
        'coop-brown': '#a87860',
        'coop-brown-hover': '#8d654c',
        'coop-lightbrown': '#e3c8b7',
        'coop-lightbrown-hover': '#c4a691',
        'coop-success-green': '#4BB543',
        'coop-success-green-hover': '#369c2f',
        'coop-alert-red': '#f1483b',
        'coop-alert-red-hover': '#CD453A',
        clear: 'transparent',
        black: '#282C31',
        white: '#FFF',
        'landing-page-green': '#15D277',
        ternary: '#BA53F9',

        // Coop UI Brand Color
        indigo: {
          50: '#ecefff',
          100: '#dde2ff',
          200: '#c2c9ff',
          300: '#9ca4ff',
          400: '#7675ff',
          500: '#7165FF',
          600: '#5436f5',
          700: '#482ad8',
          800: '#482ad8',
          900: '#332689',
          950: '#201650',
        },
      },
      boxShadow: {
        'focus-indigo': '0px 0px 0px 4px rgba(113, 101, 255, 0.25)',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      container: {
        center: true,
        padding: '2rem',
        screens: {
          '2xl': '1400px',
        },
      },
      backgroundColor: ({ theme }) => ({
        ...theme('colors'),
        DEFAULT: '#FBFBFB',
      }),
      borderColor: ({ theme }) => ({
        DEFAULT: theme('colors.black/0.08'),
        default: theme('colors.black/0.08'),
        clear: theme('colors.clear'),
        primary: theme('colors.primary'),
        accent: theme('colors.accent'),
        'landing-page-green': theme('colors.landing-page-green'),
      }),
      textColor: ({ theme }) => ({
        DEFAULT: theme('colors.black'),
        clear: theme('colors.clear'),
        default: theme('colors.black'),
        accent: theme('colors.accent'),
        primary: theme('colors.primary'),
        inverted: theme('colors.white'),
        subtle: theme('colors.black/0.55'),
      }),
      fontSize: {
        xxs: ['10px', { lineHeight: '12px', letterSpacing: '0.05px' }],
        xs: ['12px', { lineHeight: '16px', letterSpacing: '0.06px' }],
        sm: ['14px', { lineHeight: '20px', letterSpacing: '0.07px' }],
        base: ['16px', { lineHeight: '24px', letterSpacing: '0.08px' }],
        lg: ['18px', { lineHeight: 'normal', letterSpacing: '0.09px' }],
        xl: ['20px', { lineHeight: 'normal', letterSpacing: '0.1px' }],
        '2xl': ['24px', { lineHeight: 'normal', letterSpacing: '0.12px' }],
        '3xl': ['30px', { lineHeight: 'normal', letterSpacing: '0.15px' }],
        '4xl': ['36px', { lineHeight: 'normal', letterSpacing: '0.18px' }],
        '5xl': ['48px', { lineHeight: 'normal', letterSpacing: '0.24px' }],

        // TODO: legacy, to be removed once all pages are migrated to coop-ui
        '3.5xl': '2rem',
        '4.1xl': '2.5rem',
        '4.5xl': '2.75rem',
        '5.5xl': '3.25rem',
      },
      borderRadius: {
        // shadcn default values
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: 'calc(var(--radius) - 4px)',

        lg2: '0.625rem',
        '4xl': '1.875rem',
        '5xl': '2.5rem',
        full: '9999px',
      },
      animationDuration: {
        20000: '20000ms',
      },
      backgroundImage: {
        'graph-paper':
          'linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px)',
      },
      lineHeight: {
        tight: '1.3',
      },
      padding: {
        5.5: '22px',
      },
      screens: {
        '2xl': '1375px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'glow-spin': {
          from: { '--gradient-angle': '0deg' },
          to: { '--gradient-angle': '360deg' },
        },
        'carousel-left': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - 1rem))' },
        },
        'carousel-right': {
          from: { transform: 'translateX(calc(-100% - 1rem))' },
          to: { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [
    kit,
    function ({ addUtilities }) {
      const newUtilities = {
        '.max-two-lines': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'initial',
          display: '-webkit-box',
          '-webkit-line-clamp': '2',
          '-webkit-box-orient': 'vertical',
        },
        // Vertical line with arrows at the top and bottom
        '.arrow-line': {
          position: 'relative',
          width: '3px', // Line thickness
          backgroundColor: 'rgb(226 232 240)', // Line color
        },
        // Up arrow on top
        '.arrow-line::before': {
          content: "''",
          position: 'absolute',
          top: '-10px', // Slightly above the top
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: '10px solid rgb(226 232 240)', // Arrow color
        },
        // Down arrow at the bottom
        '.arrow-line::after': {
          content: "''",
          position: 'absolute',
          bottom: '-10px', // Slightly below the bottom
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '10px solid rgb(226 232 240)', // Arrow color
        },
      };
      addUtilities(newUtilities, ['responsive', 'hover']);
    },
    typography,
    containerQueries,
    forms({
      strategy: 'class',
    }),
    require('tailwindcss-animate'),
  ],
  corePlugins: { preflight: true },
};
