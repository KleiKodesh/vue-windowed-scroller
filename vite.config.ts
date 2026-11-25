import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// `vite build`: the library. `vite` (dev): the e2e rig page in e2e/.
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  root: command === 'serve' && !process.env.VITEST ? fileURLToPath(new URL('./e2e', import.meta.url)) : undefined,
  build: {
    lib: { entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)), formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['vue', '@vueuse/core'] },
    sourcemap: true,
  },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
}))
