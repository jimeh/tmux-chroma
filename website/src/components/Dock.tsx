import {
  autoHost,
  booting,
  currentWindow,
  lastWindow,
  powerline,
  prefix,
  showCpu,
  showDisk,
  showMemory,
  sync,
  windows,
} from '../state.ts';
import { StatusBar, type StatusWindowItem } from './StatusBar.tsx';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function windowFlag(id: string): string {
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
  const metrics: string[] = [];
  if (showCpu.value) {
    metrics.push('CPU 12%');
  }
  if (showMemory.value) {
    metrics.push('MEM 64%');
  }
  if (showDisk.value) {
    metrics.push('/ 238G');
  }

  const items: StatusWindowItem[] = windows.map((item) => ({
    key: item.id,
    text: String(item.index),
    nameSuffix: ':' + item.id,
    flag: windowFlag(item.id),
    current: item.id === currentWindow.value,
    onSelect: () => {
      document.getElementById(item.id)?.scrollIntoView({
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
    },
  }));

  // A hostname typed into the palette section's auto preview is
  // this "session's" machine, so the bar shows it like #H would.
  const host = autoHost.value.trim() || 'chroma';

  // The bar scrolls in an inner region sharing the dock background,
  // so iOS overscroll cannot reveal the page behind the fixed dock.
  return (
    <div class="status-dock-scroll">
      <StatusBar
        class={booting.value ? 'boot' : ''}
        host={host}
        powerline={powerline.value}
        prefixActive={prefix.value}
        syncActive={sync.value}
        metrics={metrics}
        windows={items}
      />
    </div>
  );
}
