import { effect } from '@preact/signals';
import { render } from 'preact';
import { ConfBlock, KeyRow } from './components/Config.jsx';
import { Dock } from './components/Dock.jsx';
import { Gallery } from './components/Gallery.jsx';
import {
  AutoHostPreview,
  CustomColor,
  InstallCommand,
  PresetLine,
  Readout,
  SwatchGrid,
} from './components/Palette.jsx';
import {
  accentAlt,
  armPrefix,
  booting,
  currentWindow,
  disarmPrefix,
  galleryOpen,
  lastWindow,
  prefixArmed,
  preset,
  tickClock,
  windows,
} from './state.js';
import './style.css';

// Re-theming is page-wide: the accent pair lives on :root so the CSS
// can restyle prose, headings, and the dock without any component
// touching elements it does not own.
const root = document.documentElement;
effect(() => {
  root.style.setProperty('--accent', preset.value.base);
  root.style.setProperty('--accent-alt', accentAlt.value);
});

function mount(component, id) {
  render(component, document.getElementById(id));
}

render(<Dock />, document.querySelector('.status-dock'));
mount(<Gallery />, 'gallery');
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
mount(<ConfBlock />, 'conf-block');
mount(<KeyRow />, 'key-row');

// Prefix easter egg: Ctrl-b or Ctrl-q, then w (choose-window),
// opens the preset gallery. Plain q only closes when not typing
// into a field; Escape closes regardless, like any dialog.
document.addEventListener('keydown', (event) => {
  const typing = Boolean(event.target.closest &&
    event.target.closest('input, textarea, select'));
  if (galleryOpen.value && (event.key === 'Escape' ||
      (event.key === 'q' && !typing && !event.ctrlKey &&
        !event.metaKey && !event.altKey))) {
    event.preventDefault();
    galleryOpen.value = false;
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
  if (prefixArmed() && event.key === 'w' &&
      !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    disarmPrefix();
    galleryOpen.value = true;
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
  document.querySelectorAll('[data-window]')
);

function currentWindowId() {
  if (window.scrollY <= 160) {
    return windows[0].id;
  }
  const middle = window.scrollY + window.innerHeight / 2;
  let id = windows[0].id;
  sectionElements.forEach((section) => {
    const top = section.getBoundingClientRect().top + window.scrollY;
    if (top <= middle) {
      id = section.dataset.window;
    }
  });
  return id;
}

function updateCurrentWindow() {
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
