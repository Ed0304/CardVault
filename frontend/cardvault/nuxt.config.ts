// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Global design tokens and base styles
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'CardVault',
      meta: [
        {
          name: 'description',
          content:
            'CardVault is a private, AI-powered knowledge catalog. Save information once and rediscover it later.',
        },
        { name: 'theme-color', content: '#F5F0E6' },
      ],
      // Newsreader (headings), Inter (interface), Geist Mono (identifiers).
      // The CSS font stacks fall back to system fonts if these fail to load.
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Newsreader:wght@400;500;600&display=swap',
        },
      ],
    },
  },
})
