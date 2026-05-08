import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const publicSiteUrl = (fileEnv.VITE_PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || '')
    .trim()
    .replace(/\/$/, '');

  return {
  plugins: [tailwindcss(), react(), {
    name: 'inject-public-site-meta',
    transformIndexHtml(html) {
      if (publicSiteUrl) {
        const base = `${publicSiteUrl}/`;
        return html.replace(/__SITE_CANONICAL__/g, base).replace(/__SITE_OG_URL__/g, base);
      }
      return html
        .replace(/\r?\n\s*<link rel="canonical"[^>]*>\s*\r?\n?/i, '\n')
        .replace(/\r?\n\s*<meta property="og:url"[^>]*>\s*\r?\n?/i, '\n');
    },
  }, cloudflare()],
  server: {
    allowedHosts: [
      'hybridisable-sariah-animatedly.ngrok-free.dev'
    ]
  }
  };
});