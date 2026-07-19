import { effect } from '@preact/signals';
import { render, type ComponentChild } from 'preact';
import { BannerLetters } from './components/Banner.tsx';
import {
  BackgroundQuickToggle,
  ConfBlock,
  CustomBackground,
  KeyRow,
} from './components/Config.tsx';
import { Dock } from './components/Dock.tsx';
import { Gallery } from './components/Gallery.tsx';
import { Preview } from './components/Preview.tsx';
import {
  AutoHostPreview,
  CopyButton,
  CustomColor,
  InstallCommand,
  PresetLine,
  Readout,
  SwatchGrid,
} from './components/Palette.tsx';
import {
  accent,
  accentAlt,
  armPrefix,
  barColor,
  booting,
  currentWindow,
  disarmPrefix,
  galleryOpen,
  lastWindow,
  prefixArmed,
  previewOpen,
  rainbowLogo,
  rollLogo,
  surfaces,
  theme,
  tickClock,
  windows,
} from './state.ts';
import './style.css';

// Re-theming is page-wide: the theme attribute, accent pair, and
// any custom-seed surfaces live on :root so the CSS can restyle
// prose, headings, and the dock without any component touching
// elements it does not own. For the named modes the surface
// variables are cleared so the stylesheet's own blocks apply. The
// theme-color meta follows the active bar so the browser chrome
// matches.
const root = document.documentElement;
const themeMeta = document.querySelector('meta[name="theme-color"]');
effect(() => {
  root.dataset.theme = theme.value;
  const custom = surfaces.value;
  const surfaceVars = {
    '--canvas': custom?.canvas,
    '--bar': custom?.bar,
    '--panel': custom?.panel,
    '--panel-raised': custom?.panelRaised,
    '--line': custom?.line,
    '--muted': custom?.muted,
    '--subtle': custom?.subtle,
  };
  Object.entries(surfaceVars).forEach(([name, value]) => {
    if (value) {
      root.style.setProperty(name, value);
    } else {
      root.style.removeProperty(name);
    }
  });
  root.style.setProperty('--accent', accent.value);
  root.style.setProperty('--accent-alt', accentAlt.value);
  themeMeta?.setAttribute('content', barColor.value);
});

function mount(component: ComponentChild, id: string): void {
  const target = document.getElementById(id);
  if (target) {
    render(component, target);
  }
}

const dock = document.querySelector('.status-dock');
if (dock) {
  render(<Dock />, dock);
}
mount(<Gallery />, 'gallery');
mount(<Preview />, 'preview');
mount(
  <InstallCommand
    text="set -g @plugin 'jimeh/tmux-chroma'"
    copyLabel="Copy TPM configuration"
  />,
  'quick-install'
);
mount(<SwatchGrid />, 'swatch-grid');
mount(<Readout />, 'readout');
mount(<PresetLine />, 'preset-line');
mount(<AutoHostPreview />, 'auto-host');
mount(<CustomColor />, 'custom-color');
mount(<BackgroundQuickToggle />, 'theme-toggle');
mount(<ConfBlock />, 'conf-block');
mount(<CustomBackground />, 'custom-background');
mount(<KeyRow />, 'key-row');

// The install snippets stay static HTML so they render without
// JavaScript; their copy buttons are progressive enhancement,
// mounted beside each code region.
document.querySelectorAll('.inline-code').forEach((block) => {
  const code = block.querySelector('.block-scroll');
  if (!code) {
    return;
  }
  const holder = document.createElement('span');
  // Single-line snippets center the button vertically (equal top
  // and bottom margins); multi-line ones pin it to the top corner.
  const multiline = (code.textContent ?? '').trim().includes('\n');
  holder.className = 'inline-code-copy' + (multiline ? ' is-corner' : '');
  block.appendChild(holder);
  render(
    <CopyButton
      copyLabel="Copy this snippet"
      getText={() => code.textContent ?? ''}
      getElement={() => code}
    />,
    holder
  );
});

// Easter eggs: prefix+r re-rolls the banner with six random
// hue-ordered accents, prefix+c paints the curated rainbow. The
// static banner text is captured once and split into per-letter
// columns on the first roll, so it keeps rendering without
// JavaScript until then.
const banner = document.querySelector('.banner');
const bannerArt = banner?.textContent ?? '';
let bannerMounted = false;

function paintLogo(choose: () => void): void {
  choose();
  if (banner instanceof HTMLElement && !bannerMounted) {
    bannerMounted = true;
    banner.textContent = '';
    render(<BannerLetters art={bannerArt} />, banner);
  }
}

// Prefix easter eggs: Ctrl-b or Ctrl-q, then w (choose-window),
// opens the preset gallery; prefix+p opens the README screenshot
// preview. Plain q only closes when not typing into a field;
// Escape closes regardless, like any dialog.
document.addEventListener('keydown', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const typing = Boolean(target?.closest('input, textarea, select'));
  const overlayOpen = galleryOpen.value || previewOpen.value;
  if (overlayOpen && (event.key === 'Escape' ||
      (event.key === 'q' && !typing && !event.ctrlKey &&
        !event.metaKey && !event.altKey))) {
    event.preventDefault();
    galleryOpen.value = false;
    previewOpen.value = false;
    return;
  }
  if (typing) {
    return;
  }
  if ((event.key === 'b' || event.key === 'q') && event.ctrlKey &&
      !event.metaKey && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    armPrefix();
    return;
  }
  if (prefixArmed() && !event.ctrlKey && !event.metaKey &&
      !event.altKey) {
    if (event.key === 'w') {
      event.preventDefault();
      disarmPrefix();
      previewOpen.value = false;
      galleryOpen.value = true;
    } else if (event.key === 'p') {
      event.preventDefault();
      disarmPrefix();
      galleryOpen.value = false;
      previewOpen.value = true;
    } else if (event.key === 'r') {
      event.preventDefault();
      disarmPrefix();
      paintLogo(rollLogo);
    } else if (event.key === 'c') {
      event.preventDefault();
      disarmPrefix();
      paintLogo(rainbowLogo);
    }
  }
});

// The scroll spy computes the active window directly from scroll
// position: within the top of the page the first window wins (in a
// tall viewport the intro section can end above any viewport-based
// marker even at scroll 0), and below that the last section whose
// top has passed the viewport middle is current. Deterministic in
// both directions, unlike observer enter events, which never fire
// for sections already inside the observed band on load.
const sectionElements = Array.from(
  document.querySelectorAll<HTMLElement>('[data-window]')
);

function currentWindowId(): string {
  if (window.scrollY <= 160) {
    return windows[0].id;
  }
  const middle = window.scrollY + window.innerHeight / 2;
  let id = windows[0].id;
  sectionElements.forEach((section) => {
    const top = section.getBoundingClientRect().top + window.scrollY;
    if (top <= middle && section.dataset.window) {
      id = section.dataset.window;
    }
  });
  return id;
}

function updateCurrentWindow(): void {
  const id = currentWindowId();
  if (id !== currentWindow.value) {
    lastWindow.value = currentWindow.value;
    currentWindow.value = id;
  }
}

window.addEventListener('scroll', updateCurrentWindow, {
  passive: true,
});
updateCurrentWindow();

window.setTimeout(() => {
  booting.value = false;
}, 2200);

window.setInterval(tickClock, 30000);
