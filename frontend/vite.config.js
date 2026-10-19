import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@pdftron/webviewer/public/**/*',
          dest: 'lib/webviewer',
          rename: { stripBase: 4 },
        },
      ],
    }),
  ],
  server: {
    port: 5175,
    strictPort: true,
  },
})
