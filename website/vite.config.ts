import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // The site deploys under /tmux-chroma/ on GitHub Pages; relative
  // asset URLs keep the build independent of that mount point.
  base: './',
  plugins: [preact()],
});
