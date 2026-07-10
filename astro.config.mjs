import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import wikiLink from 'remark-wiki-link'

export default defineConfig({
  site: 'https://remotelyhuman.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap()],
  redirects: {
    '/privacy-policy': '/privacy',
    '/terms-of-service': '/terms',
    '/blog': '/notes',
  },
  markdown: {
    remarkPlugins: [
      [
        wikiLink,
        {
          aliasDivider: '|',
          pageResolver: (name) => [name.toLowerCase().replace(/\s+/g, '-')],
          hrefTemplate: (permalink) => `/notes/${permalink}`,
          wikiLinkClassName: 'wiki-link',
          newClassName: 'wiki-link',
        },
      ],
    ],
  },
})
