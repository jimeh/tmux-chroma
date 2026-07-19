import { mixColor } from '../color.ts';
import { presetAccent, resolution } from '../presets.ts';
import { barColor, logoPresets, theme } from '../state.ts';

// Column boundaries of the six letters in the ASCII banner (ANSI
// Shadow glyph widths: C8 H8 R8 O9 M11 A8). The art itself is read
// from the static markup, not duplicated here.
const LETTER_COLUMNS = [0, 8, 16, 24, 33, 44, 52];
const WIDTH = LETTER_COLUMNS[LETTER_COLUMNS.length - 1];

// Easter egg: replaces the banner's text with six per-letter
// columns, each wearing one accent in the same vertical gradient
// the whole-logo styling uses. Each column stacks its letter's row
// slices so the gradient spans the full banner height — as inline
// per-row spans the background would repeat per line box and read
// as banding. Mounted lazily on the first roll so the static
// banner keeps rendering without JavaScript.
export function BannerLetters({ art }: { art: string }) {
  const chosen = logoPresets.value;
  const lines = art.split('\n').map((line) => line.padEnd(WIDTH));
  return (
    <>
      {LETTER_COLUMNS.slice(0, -1).map((start, index) => {
        const column = lines
          .map((line) => line.slice(start, LETTER_COLUMNS[index + 1]))
          .join('\n');
        const chosenPreset = chosen?.[index];
        // background-image, not the background shorthand: the
        // shorthand would reset the class's background-clip and
        // paint the whole column box instead of the glyphs. Without
        // a chosen preset the column mirrors the banner's own
        // themed gradient.
        const gradient = chosenPreset
          ? (() => {
            const accent = presetAccent(chosenPreset, theme.value);
            const alt = mixColor(
              accent,
              barColor.value,
              resolution.baseAltMix
            );
            return 'linear-gradient(180deg, ' + accent +
              ' 55%, ' + alt + ')';
          })()
          : 'linear-gradient(180deg, var(--accent) 55%, ' +
            'var(--accent-alt))';
        return (
          <span
            class="banner-letter"
            style={{ backgroundImage: gradient }}
          >
            {column}
          </span>
        );
      })}
    </>
  );
}
