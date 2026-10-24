import { defineConfig } from 'vite';
import { resolve } from 'node:path';
// GitHub Pages เสิร์ฟที่ /ayothaya-idle/ — ใช้ path แบบสัมพัทธ์
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { game: resolve(__dirname, 'index.html'), content: resolve(__dirname, 'content.html') } } },
});
