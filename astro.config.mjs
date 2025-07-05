// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://patrickellis.dev",
  integrations: [mdx(), sitemap()],
  trailingSlash: 'never',

  vite: {
    plugins: [tailwindcss()],
  },
});
