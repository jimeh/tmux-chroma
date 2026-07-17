import type { Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { colorLuma, normalizeHex } from '../color.ts';
import { displayPresets, namedBackgrounds } from '../presets.ts';
import {
  auto,
  background,
  backgroundSeed,
  barColor,
  powerline,
  prefix,
  preset,
  selectAuto,
  selectPreset,
  setBackground,
  showCpu,
  showDisk,
  showMemory,
  sync,
} from '../state.ts';
import { presetConfig } from './Palette.tsx';

function ConfToggle({ option }: { option: Signal<boolean> }) {
  const on = option.value;
  return (
    <button
      class="conf-toggle"
      type="button"
      aria-pressed={on}
      onClick={() => {
        option.value = !on;
      }}
    >
      {on ? "'on'" : "'off'"}
    </button>
  );
}

// A conf value that opens a native dropdown. The visible text is a
// plain span so selecting and copying the block reads exactly as
// rendered (a bare <select> serializes with line breaks around it);
// the transparent select sits on top of it as the actual control
// and is excluded from text selection.
function ConfSelect({
  ariaLabel,
  value,
  display,
  onChange,
  children,
}: {
  ariaLabel: string;
  value: string;
  display: string;
  onChange: (next: string) => void;
  children: ComponentChildren;
}) {
  return (
    <span class="conf-select-wrap">
      <span aria-hidden="true" class="conf-select-value">{display}</span>
      <select
        class="conf-select"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      >
        {children}
      </select>
    </span>
  );
}

// The accent control: 'auto', every preset in the swatch grid's hue
// order, and — while a custom accent from the palette section is
// active — that hex as its own entry.
function PresetSelect() {
  const conf = presetConfig();
  const custom = !auto.value && preset.value.name === 'custom';
  const value = auto.value ? 'auto' : conf.value;
  return (
    <ConfSelect
      ariaLabel="@chroma_preset value"
      value={value}
      display={"'" + conf.value + "'"}
      onChange={(next) => {
        if (next === 'auto') {
          selectAuto();
          return;
        }
        const found = displayPresets.find((item) => item.name === next);
        if (found) {
          selectPreset(found);
        }
      }}
    >
      {custom
        ? <option value={value}>{"'" + value + "'"}</option>
        : null}
      <option value="auto">'auto'</option>
      {displayPresets.map((item) => (
        <option key={item.name} value={item.name}>
          {"'" + item.name + "'"}
        </option>
      ))}
    </ConfSelect>
  );
}

// The one theme control: this @chroma_background line re-themes
// the whole page the way the option re-themes tmux. The dropdown
// offers every option the plugin accepts — dark (the default),
// light, and the named theme backgrounds — and the choice persists
// across visits. A custom seed applied through the input below
// shows as its own entry while active.
function BackgroundSelect() {
  const value = background.value;
  const custom = value !== 'dark' && value !== 'light' &&
    !namedBackgrounds.some((entry) => entry.name === value);
  // Group the named themes by the same luma classification the
  // plugin applies to their seeds, so a theme always sits in the
  // group it actually renders as.
  const themeGroups: Array<[string, typeof namedBackgrounds]> = [
    ['dark themes', namedBackgrounds.filter(
      (entry) => colorLuma(entry.seed) < 130
    )],
    ['light themes', namedBackgrounds.filter(
      (entry) => colorLuma(entry.seed) >= 130
    )],
  ];
  return (
    <ConfSelect
      ariaLabel="@chroma_background value"
      value={value}
      display={"'" + value + "'"}
      onChange={setBackground}
    >
      {custom ? <option value={value}>{"'" + value + "'"}</option> : null}
      <optgroup label="modes">
        <option value="dark">'dark'</option>
        <option value="light">'light'</option>
      </optgroup>
      {themeGroups.map(([label, entries]) => (
        <optgroup key={label} label={label}>
          {entries.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {"'" + entry.name + "'"}
            </option>
          ))}
        </optgroup>
      ))}
    </ConfSelect>
  );
}

// A custom terminal background, mirroring the plugin: the seed is
// classified by luma and the bar surfaces blend toward it.
export function CustomBackground() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const customSeed = normalizeHex(value);

  function submit(event: Event): void {
    event.preventDefault();
    const input = inputRef.current;
    if (!input) {
      return;
    }
    // Read the input directly: a submit can land before a pending
    // re-render syncs the value state.
    const submitted = normalizeHex(input.value);
    if (!submitted) {
      input.setCustomValidity(
        'Enter a six-digit hex color, such as #fdf6e3.'
      );
      setInvalid(true);
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    setInvalid(false);
    setValue(submitted);
    setBackground(submitted);
  }

  return (
    <form
      class="custom-color"
      aria-label="Custom terminal background"
      novalidate
      style={{
        '--custom-swatch':
          customSeed || backgroundSeed.value || barColor.value,
      }}
      onSubmit={submit}
    >
      <span class="custom-color-swatch" aria-hidden="true" />
      <label class="visually-hidden" for="custom-background-input">
        Custom terminal background color
      </label>
      <input
        ref={inputRef}
        class="custom-color-input"
        id="custom-background-input"
        type="text"
        inputmode="text"
        maxlength={7}
        placeholder="#rrggbb"
        autocomplete="off"
        spellcheck={false}
        aria-invalid={invalid ? 'true' : undefined}
        value={value}
        onInput={(event) => {
          setValue(event.currentTarget.value);
          event.currentTarget.setCustomValidity('');
          setInvalid(false);
        }}
      />
      <button class="custom-color-submit" type="submit">apply</button>
    </form>
  );
}

// The live ~/.tmux.conf block: whitespace is significant under the
// conf-block's white-space handling, so every literal keeps its
// alignment spaces inline.
export function ConfBlock() {
  const conf = presetConfig();
  const pad = conf.option === '@chroma_base_color' ? '  ' : '      ';
  return (
    <pre class="conf-block">
      <span class="comment"># ~/.tmux.conf</span>
      {'\nset -g ' + conf.option + pad}
      <PresetSelect />
      {'\nset -g @chroma_background  '}
      <BackgroundSelect />
      {'\nset -g @chroma_powerline   '}
      <ConfToggle option={powerline} />
      {'\nset -g @chroma_show_cpu    '}
      <ConfToggle option={showCpu} />
      {'\nset -g @chroma_show_memory '}
      <ConfToggle option={showMemory} />
      {'\nset -g @chroma_show_disk   '}
      <ConfToggle option={showDisk} />
    </pre>
  );
}

export function KeyRow() {
  return (
    <div class="key-row">
      <button
        class="key-toggle"
        type="button"
        aria-pressed={prefix.value}
        onClick={() => {
          prefix.value = !prefix.value;
        }}
      >
        <kbd>C-b</kbd> prefix held
      </button>
      <button
        class="key-toggle"
        type="button"
        aria-pressed={sync.value}
        onClick={() => {
          sync.value = !sync.value;
        }}
      >
        <kbd>:setw synchronize-panes</kbd> sync
      </button>
    </div>
  );
}
