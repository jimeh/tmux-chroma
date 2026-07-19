import { useRef, useState } from 'preact/hooks';
import { normalizeHex } from '../color.ts';
import { anchors, displayPresets, presetAccent } from '../presets.ts';
import {
  accent,
  accentAlt,
  auto,
  autoHost,
  autoPreviewBase,
  preset,
  selectAuto,
  selectPreset,
  surfaces,
  theme,
} from '../state.ts';

// The clipboard API needs a secure context; where it is missing or
// refuses, copy through a transient textarea and execCommand, which
// works everywhere a paste target exists.
function fallbackCopy(text: string): boolean {
  const active = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  if (active instanceof HTMLElement) {
    active.focus();
  }
  return copied;
}

// A copy-to-clipboard tail button; as a last resort it selects the
// source element so a manual copy still works.
export function CopyButton({
  copyLabel,
  getText,
  getElement,
}: {
  copyLabel: string;
  getText: () => string;
  getElement?: () => Element | null;
}) {
  const timerRef = useRef<number | undefined>(undefined);
  const [label, setLabel] = useState('copy');

  async function copy(): Promise<void> {
    const text = getText();
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
    if (!copied) {
      copied = fallbackCopy(text);
    }
    if (copied) {
      setLabel('done');
    } else {
      const element = getElement?.();
      if (element) {
        setLabel('select');
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else {
        setLabel('failed');
      }
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLabel('copy');
    }, 1600);
  }

  return (
    <button
      class="copy-button"
      type="button"
      aria-label={copyLabel}
      onClick={copy}
    >
      {label}
    </button>
  );
}

// A one-line config snippet with a copy button.
export function InstallCommand({
  text,
  copyLabel,
  class: extraClass,
}: {
  text: string;
  copyLabel: string;
  class?: string;
}) {
  const codeRef = useRef<HTMLElement>(null);
  return (
    <div class={'install-command' + (extraClass ? ' ' + extraClass : '')}>
      <code ref={codeRef}>{text}</code>
      <CopyButton
        copyLabel={copyLabel}
        getText={() => codeRef.current?.textContent ?? ''}
        getElement={() => codeRef.current}
      />
    </div>
  );
}

// The config snippets show what ~/.tmux.conf would say: 'auto'
// stays 'auto' even while a typed hostname previews its result.
export function presetConfig(): { option: string; value: string } {
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
      text={'set -g ' + conf.option + " '" + conf.value + "'"}
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
          <span
            class="swatch-color"
            style={{ '--swatch': presetAccent(item, theme.value) }}
          />
          <span class="swatch-name">{item.name}</span>
        </button>
      ))}
    </div>
  );
}

export function Readout() {
  const name = auto.value
    ? 'auto (' + preset.value.name + ')'
    : preset.value.name;
  // Every color the plugin would export for this configuration,
  // under its @chroma_* option names: the mode's anchors, with the
  // custom-seed derivations swapped in where they apply.
  const mode = anchors[theme.value];
  const custom = surfaces.value;
  const rows: Array<[string, string]> = [
    ['base', accent.value],
    ['base_alt', accentAlt.value],
    ['bg', custom?.bar ?? mode.bg],
    ['bg_alt', custom?.panelRaised ?? mode.bgAlt],
    ['fg', mode.fg],
    ['muted', custom?.muted ?? mode.muted],
    ['subtle', custom?.subtle ?? mode.subtle],
    ['border', custom?.line ?? mode.border],
    ['warn', mode.warn],
    ['alert', mode.alert],
    ['ink', mode.ink],
  ];
  return (
    <div class="readout">
      <pre class="block-scroll" aria-live="polite">
        {'name      ' + name}
        {rows.map(([label, value]) => (
          <>
            {'\n' + label.padEnd(10) + value + '  '}
            <span class="chip" style={{ background: value }} />
          </>
        ))}
      </pre>
    </div>
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
      {autoHost.value ? (
        <button
          class="custom-color-clear"
          type="button"
          aria-label="Clear the hostname"
          onClick={() => {
            autoHost.value = '';
            selectAuto();
          }}
        >
          clear
        </button>
      ) : null}
    </div>
  );
}

export function CustomColor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const customBase = normalizeHex(value);
  const applied = !auto.value && preset.value.name === 'custom';

  function clear(): void {
    setValue('');
    setInvalid(false);
    inputRef.current?.setCustomValidity('');
    selectAuto();
  }

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
      input.setCustomValidity('Enter a six-digit hex color, such as #83baee.');
      setInvalid(true);
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    setInvalid(false);
    setValue(submitted);
    selectPreset({ name: 'custom', base: submitted });
  }

  return (
    <form
      class="custom-color"
      aria-label="Custom accent color"
      novalidate
      style={{ '--custom-swatch': customBase || accent.value }}
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
      {applied ? (
        <button
          class="custom-color-clear"
          type="button"
          aria-label="Reset the custom accent"
          onClick={clear}
        >
          reset
        </button>
      ) : null}
      <button class="custom-color-submit" type="submit">
        apply
      </button>
    </form>
  );
}
