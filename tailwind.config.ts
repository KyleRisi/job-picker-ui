import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        carnival: {
          red: '#B82018',
          cream: '#F4E7BC',
          teal: '#0F2A57',
          gold: '#E8C775',
          ink: '#1B1635'
        }
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.15)'
      }
    }
  },
  plugins: []
};

export default config;
