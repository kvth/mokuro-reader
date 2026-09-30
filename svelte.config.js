import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // Static SPA build into docs/ so GitHub Pages can serve it straight from the repo
    // (Settings > Pages > Deploy from branch > /docs). The app routes by URL hash, so the
    // prerendered index.html plus a 404.html fallback cover every route. Asset paths are
    // relative, so the same build also works from any subpath or a plain static server.
    adapter: adapter({ pages: 'docs', assets: 'docs', fallback: '404.html' })
  },

  vitePlugin: {
    inspector: true
  }
};

export default config;
