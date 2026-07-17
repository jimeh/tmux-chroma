import { useEffect, useRef } from 'preact/hooks';
import { mixColor } from '../color.js';
import { displayPresets } from '../presets.js';
import { galleryOpen, powerline } from '../state.js';
import { StatusBar } from './StatusBar.jsx';

// Easter egg: Ctrl-b or Ctrl-q arms the tmux prefix (the dock's ∙
// indicator lights up), then w — choose-window — opens a gallery
// with one status line per accent preset, used to screenshot the
// palette for the README. The window list reuses the tab content
// from the original docs preview.
const galleryWindows = [
  { key: 'zsh', text: '1:zsh' },
  { key: 'vim', text: '2:vim', flag: '*', current: true },
  { key: 'ssh', text: '3:ssh', flag: '#' },
  { key: 'htop', text: '4:htop', flag: '!', alert: true },
  { key: 'logs', text: '5:logs', flag: '-' },
];

export function Gallery() {
  const open = galleryOpen.value;
  const popupRef = useRef(null);

  // aria-modal promises the page behind the overlay is unreachable;
  // inert makes it true by removing it from tab order and focus.
  // Focus moves into the popup on open and back on close; the dock's
  // keyed rendering keeps the originating button attached meanwhile.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const regions = [
      document.querySelector('main'),
      document.querySelector('.status-dock'),
    ];
    const returnFocus = document.activeElement;
    regions.forEach((region) => {
      region.inert = true;
    });
    popupRef.current.focus();
    return () => {
      regions.forEach((region) => {
        region.inert = false;
      });
      if (returnFocus && returnFocus.isConnected) {
        returnFocus.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      class="status-gallery"
      role="dialog"
      aria-modal="true"
      aria-label="Every accent preset rendered as a status line"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          galleryOpen.value = false;
        }
      }}
    >
      <div class="gallery-popup" tabindex={-1} ref={popupRef}>
        <p class="comment gallery-hint">
          # one status line per accent · press q to close
        </p>
        <div class="gallery-bars">
          {displayPresets.map((preset) => (
            <StatusBar
              key={preset.name}
              class="gallery-bar"
              host={preset.name}
              preset={preset}
              powerline={powerline.value}
              prefixActive={false}
              syncActive={false}
              metrics={['CPU 12%', 'MEM 64%']}
              windows={galleryWindows}
              style={{
                '--accent': preset.base,
                '--accent-alt': mixColor(preset.base, '#15181d', 60),
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
