import { mixColor } from '../color.ts';
import {
  displayPresets,
  presetAccent,
  resolution,
} from '../presets.ts';
import { barColor, galleryOpen, powerline, theme } from '../state.ts';
import { StatusBar, type StatusWindowItem } from './StatusBar.tsx';
import { StatusOverlay } from './StatusOverlay.tsx';

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

  return (
    <StatusOverlay
      open={open}
      class="status-gallery"
      popupClass="gallery-popup"
      ariaLabel="Every accent preset rendered as a status line"
      onClose={() => {
        galleryOpen.value = false;
      }}
    >
      <p class="comment status-popup-hint gallery-hint">
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
                '--accent-alt': mixColor(
                  accent,
                  barColor.value,
                  resolution.baseAltMix
                ),
              }}
            />
          );
        })}
      </div>
    </StatusOverlay>
  );
}
