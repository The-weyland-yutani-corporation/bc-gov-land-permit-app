const config = {
  content: ['./src/**/*.{html,js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: 'var(--color-brand-blue)',
          'blue-dark': 'var(--color-brand-blue-dark)',
          gold: 'var(--color-brand-gold)',
        },
        surface: {
          page: 'var(--color-surface-page)',
          muted: 'var(--color-surface-muted)',
          inverse: 'var(--color-surface-inverse)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          inverse: 'var(--color-text-inverse)',
          link: 'var(--color-text-link)',
        },
        support: {
          success: 'var(--color-support-success)',
          warning: 'var(--color-support-warning)',
          danger: 'var(--color-support-danger)',
          info: 'var(--color-support-info)',
        },
      },
      fontFamily: {
        sans: ['BC Sans', 'Noto Sans', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        page: 'var(--layout-page-max)',
        reading: 'var(--layout-reading-max)',
      },
      borderRadius: {
        control: 'var(--radius-control)',
      },
      boxShadow: {
        focus: 'var(--focus-shadow)',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
};

export default config;
