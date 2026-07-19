import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { colorSchema } from './.generated/colors.ts';
import { colorCss, prepaint } from './.generated/site.ts';

export default defineConfig({
  // The site deploys under /tmux-chroma/ on GitHub Pages; relative
  // asset URLs keep the build independent of that mount point.
  base: './',
  plugins: [
    {
      name: 'chroma-generated-colors',
      transformIndexHtml(html) {
        return html
          .replace(
            'content="" data-chroma-theme-color',
            `content="${colorSchema.modes.dark.bg}" ` +
              'data-chroma-theme-color'
          )
          .replace(
            '<style data-chroma-colors></style>',
            `<style data-chroma-colors>\n${colorCss}</style>`
          )
          .replace(
            '<script data-chroma-prepaint></script>',
            `<script data-chroma-prepaint>\n${prepaint}</script>`
          );
      },
    },
    preact(),
  ],
});
