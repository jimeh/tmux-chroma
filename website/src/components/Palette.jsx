import { useRef, useState } from 'preact/hooks';
import { normalizeHex } from '../color.js';
import { displayPresets } from '../presets.js';
import {
  accentAlt,
  auto,
  autoHost,
  autoPreviewBase,
  preset,
  selectAuto,
  selectPreset,
} from '../state.js';

// A one-line config snippet with a copy button; falls back to
// selecting the text where the clipboard API is unavailable.
export function InstallCommand({ text, copyLabel, class: extraClass }) {
  const codeRef = useRef(null);
  const timerRef = useRef(null);
  const [label, setLabel] = useState('copy');

  async function copy() {
    try {
      await navigator.clipboard.writeText(codeRef.current.textContent);
      setLabel('done');
    } catch (_error) {
      setLabel('select');
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLabel('copy');
    }, 1600);
  }

  return (
    <div
      class={'install-command' + (extraClass ? ' ' + extraClass : '')}
    >
      <code ref={codeRef}>{text}</code>
      <button
        class="copy-button"
        type="button"
        aria-label={copyLabel}
        onClick={copy}
      >
        {label}
      </button>
    </div>
  );
}

// The config snippets show what ~/.tmux.conf would say: 'auto'
// stays 'auto' even while a typed hostname previews its result.
export function presetConfig() {
  const current = preset.value;
  const custom = current.name === 'custom';
  return {
    option: custom ? '@chroma_base_color' : '@chroma_preset',
    value: auto.value ? 'auto' : custom ? current.base : current.name,
  };
}

export function PresetLine() {
  const conf = presetConfig();
  return (
    <InstallCommand
      text={"set -g " + conf.option + " '" + conf.value + "'"}
      copyLabel="Copy preset configuration"
    />
  );
}

export function SwatchGrid() {
  const selected = auto.value ? 'auto' : preset.value.name;
  return (
    <div class="swatch-grid" role="group" aria-label="Accent presets">
      <button
        class="swatch swatch-auto"
        type="button"
        aria-pressed={selected === 'auto'}
        aria-label="Use the auto preset, hashed from the hostname"
        onClick={selectAuto}
      >
        <span class="swatch-color" />
        <span class="swatch-name">auto</span>
      </button>
      {displayPresets.map((item) => (
        <button
          key={item.name}
          class="swatch"
          type="button"
          aria-pressed={selected === item.name}
          aria-label={'Use ' + item.name + ' preset'}
          onClick={() => selectPreset(item)}
        >
          <span class="swatch-color" style={{ '--swatch': item.base }} />
          <span class="swatch-name">{item.name}</span>
        </button>
      ))}
    </div>
  );
}

export function Readout() {
  const current = preset.value;
  const alt = accentAlt.value;
  const name = auto.value
    ? 'auto (' + current.name + ')'
    : current.name;
  return (
    <pre class="readout" aria-live="polite">
      {'name      ' + name + '\n'}
      {'base      ' + current.base + '  '}
      <span class="chip" style={{ background: current.base }} />
      {'\n'}
      {'base_alt  ' + alt + '  '}
      <span class="chip" style={{ background: alt }} />
      {'\n'}
      {'bar       #15181d  '}
      <span class="chip chip-bar" />
    </pre>
  );
}

export function AutoHostPreview() {
  return (
    <div
      class="custom-color"
      role="group"
      aria-label="Preview the auto preset for a hostname"
      style={{ '--custom-swatch': autoPreviewBase.value }}
    >
      <span class="custom-color-swatch" aria-hidden="true" />
      <label class="visually-hidden" for="auto-host-input">
        Hostname to preview the auto preset for
      </label>
      <input
        class="custom-color-input"
        id="auto-host-input"
        type="text"
        inputmode="text"
        placeholder="hostname"
        autocomplete="off"
        spellcheck={false}
        value={autoHost.value}
        onInput={(event) => {
          autoHost.value = event.currentTarget.value;
          selectAuto();
        }}
      />
    </div>
  );
}

export function CustomColor() {
  const inputRef = useRef(null);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const customBase = normalizeHex(value);

  function submit(event) {
    event.preventDefault();
    // Read the input directly: a submit can land before a pending
    // re-render syncs the value state.
    const customBase = normalizeHex(inputRef.current.value);
    if (!customBase) {
      inputRef.current.setCustomValidity(
        'Enter a six-digit hex color, such as #83baee.'
      );
      setInvalid(true);
      inputRef.current.reportValidity();
      return;
    }
    inputRef.current.setCustomValidity('');
    setInvalid(false);
    setValue(customBase);
    selectPreset({ name: 'custom', base: customBase });
  }

  return (
    <form
      class="custom-color"
      aria-label="Custom accent color"
      novalidate
      style={{ '--custom-swatch': customBase || preset.value.base }}
      onSubmit={submit}
    >
      <span class="custom-color-swatch" aria-hidden="true" />
      <label class="visually-hidden" for="custom-color-input">
        Custom accent color
      </label>
      <input
        ref={inputRef}
        class="custom-color-input"
        id="custom-color-input"
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
