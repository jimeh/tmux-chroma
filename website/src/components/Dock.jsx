import {
  booting,
  currentWindow,
  lastWindow,
  powerline,
  prefix,
  preset,
  showCpu,
  showDisk,
  showMemory,
  sync,
  windows,
} from '../state.js';
import { StatusBar } from './StatusBar.jsx';

const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
);

function windowFlag(id) {
  if (id === currentWindow.value) {
    return '*';
  }
  if (id === lastWindow.value) {
    return '-';
  }
  return '';
}

// The fixed dock at the bottom of the page: a live Chroma status
// line whose window list doubles as section navigation.
export function Dock() {
  const metrics = [];
  if (showCpu.value) {
    metrics.push('CPU 12%');
  }
  if (showMemory.value) {
    metrics.push('MEM 64%');
  }
  if (showDisk.value) {
    metrics.push('/ 238G');
  }

  const items = windows.map((item) => ({
    key: item.id,
    text: String(item.index),
    nameSuffix: ':' + item.id,
    flag: windowFlag(item.id),
    current: item.id === currentWindow.value,
    onSelect: () => {
      document.getElementById(item.id).scrollIntoView({
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
    },
  }));

  return (
    <StatusBar
      class={booting.value ? 'boot' : ''}
      host="noct"
      preset={preset.value}
      powerline={powerline.value}
      prefixActive={prefix.value}
      syncActive={sync.value}
      metrics={metrics}
      windows={items}
    />
  );
}
