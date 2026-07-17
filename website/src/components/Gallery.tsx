import { useEffect, useRef } from 'preact/hooks';
import { mixColor } from '../color.ts';
import { displayPresets, presetAccent } from '../presets.ts';
import { barColor, galleryOpen, powerline, theme } from '../state.ts';
import { StatusBar, type StatusWindowItem } from './StatusBar.tsx';

// Easter egg: Ctrl-b or Ctrl-q arms the tmux prefix (the dock's ∙
// indicator lights up), then w — choose-window — opens a gallery
// with one status line per accent preset, used to screenshot the
// palette for the README. The window list reuses the tab content
// from the original docs preview.
const galleryWindows: StatusWindowItem[] = [
  { key: 'zsh', text: '1:zsh' },
  { key: 'vim', text: '2:vim', flag: '*', current: true },
  { key: 'ssh', text: '3:ssh', flag: '#' },
  { key: 'htop', text: '4:htop', flag: '!', alert: true },
  { key: 'logs', text: '5:logs', flag: '-' },
];

export function Gallery() {
  const open = galleryOpen.value;
  const popupRef = useRef<HTMLDivElement>(null);

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
    ].filter((region): region is HTMLElement => region instanceof HTMLElement);
    const returnFocus = document.activeElement;
    regions.forEach((region) => {
      region.inert = true;
    });
    popupRef.current?.focus();
    return () => {
      regions.forEach((region) => {
        region.inert = false;
      });
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
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
          {displayPresets.map((preset) => {
            const accent = presetAccent(preset, theme.value);
            return (
              <StatusBar
                key={preset.name}
                class="gallery-bar"
                host={preset.name}
                powerline={powerline.value}
                prefixActive={false}
                syncActive={false}
                metrics={['CPU 12%', 'MEM 64%']}
                windows={galleryWindows}
                style={{
                  '--accent': accent,
                  '--accent-alt': mixColor(accent, barColor.value, 60),
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
