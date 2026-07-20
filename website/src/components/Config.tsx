import type { Signal } from '@preact/signals';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'preact/hooks';
import { colorLuma, normalizeHex } from '../color.ts';
import {
  anchors,
  displayPresets,
  namedBackgrounds,
  presetAccent,
  resolution,
} from '../presets.ts';
import {
  auto,
  background,
  backgroundSeed,
  barColor,
  configDirty,
  modeOverride,
  powerline,
  prefix,
  preset,
  resetConfig,
  selectAuto,
  selectPreset,
  setBackground,
  showCpu,
  showDisk,
  showMemory,
  sync,
  theme,
} from '../state.ts';
import { CopyButton, presetConfig } from './Palette.tsx';

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

interface ConfSelectOption {
  value: string;
  swatch: string;
}

interface ConfSelectGroup {
  label: string | null;
  options: ConfSelectOption[];
}

interface PopupPlacement {
  left: number;
  top: number;
  height?: number;
  ready: boolean;
}

function confOptionId(id: string, index: number): string {
  return id + '-option-' + index;
}

// A conf value that opens a custom dropdown, so every option can
// carry a color swatch (native <option>s cannot). Select-only
// combobox pattern: the button holds focus and aria-activedescendant
// while arrow keys move through the flattened options; the popup is
// position: fixed so the conf block's horizontal scroll clipping
// cannot cut it off, and closes on outside clicks, Escape, Tab,
// scrolling, and resizing. The button is a real text node, so
// selecting and copying the block reads exactly as rendered.
function ConfSelect({
  ariaLabel,
  value,
  display,
  groups,
  onSelect,
}: {
  ariaLabel: string;
  value: string;
  display: string;
  groups: ConfSelectGroup[];
  onSelect: (next: string) => void;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PopupPlacement | null>(null);
  const [active, setActive] = useState(0);

  const open = placement !== null;
  const flat = groups.flatMap((group) => group.options);

  // Opening renders the popup hidden at a provisional spot; the
  // layout effect below measures it and moves it into place.
  function openPopup(): void {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const selected = flat.findIndex((option) => option.value === value);
    setActive(Math.max(0, selected));
    setPlacement({ left: rect.left, top: rect.top, ready: false });
  }

  // Like a native select: the popup sits so the selected option's
  // text lands exactly on the button text, with the list scrolled
  // to keep the selection as centred as the viewport (top edge to
  // the dock) and the options around it allow.
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const button = buttonRef.current;
    const popup = popupRef.current;
    const scroll = scrollRef.current;
    const selected = popup?.querySelector(
      '#' + CSS.escape(confOptionId(id, active))
    );
    const label = selected?.querySelector('.conf-option-label');
    if (!button || !popup || !scroll || !selected || !label) {
      return;
    }
    const btnRect = button.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const selRect = selected.getBoundingClientRect();
    // Distance from the popup's outer edge to the scroll region
    // (the border), and the selected row's centre in list-content
    // coordinates.
    const chrome = scrollRect.top - popupRect.top;
    const selCenter =
      selRect.top + selRect.height / 2 - scrollRect.top + scroll.scrollTop;
    const dockTop =
      document.querySelector('.status-dock')?.getBoundingClientRect().top ??
      window.innerHeight;
    const btnCenter = btnRect.top + btnRect.height / 2;
    // Each side is bounded by the screen (viewport top, dock top)
    // and by how much list actually exists on that side of the
    // selection. The height budget is shared: start from an even
    // split, then let either side take whatever the other cannot
    // use, so the popup keeps its full height and drifts up or
    // down instead of shrinking near the edges.
    const maxUp = Math.max(0, Math.min(btnCenter - 8 - chrome, selCenter));
    const maxDown = Math.max(
      0,
      Math.min(
        dockTop - 8 - btnCenter - chrome,
        scroll.scrollHeight - selCenter
      )
    );
    const budget = 340;
    let halfUp = Math.min(maxUp, budget / 2);
    const halfDown = Math.min(maxDown, budget - halfUp);
    halfUp = Math.min(maxUp, budget - halfDown);
    const labelLeft = label.getBoundingClientRect().left - popupRect.left;
    const left = Math.min(
      Math.max(8, btnRect.left - labelLeft),
      Math.max(8, window.innerWidth - popupRect.width - 8)
    );
    // Shrink the scroll region to its final height before setting
    // scrollTop: against the taller provisional region the browser
    // would clamp scroll targets near the end of the list, leaving
    // selections among the last few options misaligned.
    const height = halfUp + halfDown;
    scroll.style.height = height + 'px';
    scroll.scrollTop = selCenter - halfUp;
    setPlacement({
      left,
      top: btnCenter - chrome - halfUp,
      height,
      ready: true,
    });
  }, [open, active, id]);

  function close(): void {
    setPlacement(null);
  }

  function choose(next: string): void {
    close();
    onSelect(next);
  }

  function onButtonKeyDown(event: KeyboardEvent): void {
    const openKeys = ['ArrowDown', 'ArrowUp', 'Enter', ' '];
    if (!open) {
      if (openKeys.includes(event.key)) {
        event.preventDefault();
        openPopup();
      }
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    event.preventDefault();
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown') {
      setActive(Math.min(flat.length - 1, active + 1));
    } else if (event.key === 'ArrowUp') {
      setActive(Math.max(0, active - 1));
    } else if (event.key === 'Home') {
      setActive(0);
    } else if (event.key === 'End') {
      setActive(flat.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      choose(flat[active].value);
    }
  }

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: Event): void => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && !buttonRef.current?.parentElement?.contains(target)) {
        close();
      }
    };
    // The fixed popup is anchored to a one-off measurement; page
    // scrolling or resizing invalidates it, so just close — but the
    // popup's own list scrolling (wheel, or nudging the active
    // option into view) must not.
    const onScroll = (event: Event): void => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && popupRef.current?.contains(target)) {
        return;
      }
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const scroll = scrollRef.current;
      const option = popupRef.current?.querySelector(
        '#' + CSS.escape(confOptionId(id, active))
      );
      if (!scroll || !option) {
        return;
      }
      const scrollRect = scroll.getBoundingClientRect();
      const optionRect = option.getBoundingClientRect();
      if (optionRect.top < scrollRect.top) {
        scroll.scrollTop -= scrollRect.top - optionRect.top;
      } else if (optionRect.bottom > scrollRect.bottom) {
        scroll.scrollTop += optionRect.bottom - scrollRect.bottom;
      }
    }
  }, [open, active, id]);

  let index = -1;
  return (
    <span class="conf-select-wrap">
      <button
        ref={buttonRef}
        class="conf-select-button"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id + '-listbox' : undefined}
        aria-activedescendant={open ? confOptionId(id, active) : undefined}
        onClick={() => {
          if (open) {
            close();
          } else {
            openPopup();
          }
        }}
        onKeyDown={onButtonKeyDown}
      >
        {display}
      </button>
      {open ? (
        <div
          ref={popupRef}
          id={id + '-listbox'}
          class="conf-select-popup"
          role="listbox"
          aria-label={ariaLabel}
          style={{
            left: placement.left,
            top: placement.top,
            visibility: placement.ready ? undefined : 'hidden',
          }}
        >
          {/* iOS paints a scroll container's background on the
                moving content layer, so overscrolling would reveal
                whatever sits behind it; scrolling happens in this
                inner region whose background matches the popup. */}
          <div
            ref={scrollRef}
            class="conf-select-scroll"
            style={{ height: placement.height, maxHeight: 340 }}
          >
            {groups.map((group) => (
              <div
                key={group.label ?? ''}
                role="group"
                aria-label={group.label ?? undefined}
              >
                {group.label ? (
                  <div class="conf-option-group" aria-hidden="true">
                    {'# ' + group.label}
                  </div>
                ) : null}
                {group.options.map((option) => {
                  index += 1;
                  const optionIndex = index;
                  return (
                    <div
                      key={option.value}
                      id={confOptionId(id, optionIndex)}
                      class={
                        'conf-option' +
                        (optionIndex === active ? ' is-active' : '')
                      }
                      role="option"
                      aria-selected={option.value === value}
                      onMouseEnter={() => setActive(optionIndex)}
                      onClick={() => choose(option.value)}
                    >
                      <span
                        class="conf-option-swatch"
                        style={{ background: option.swatch }}
                      />
                      <span class="conf-option-label">
                        {"'" + option.value + "'"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </span>
  );
}

// The accent control: 'auto', every preset in the swatch grid's hue
// order (each swatched with its mode-resolved accent), and — while
// a custom accent from the palette section is active — that hex as
// its own entry.
function PresetSelect() {
  const conf = presetConfig();
  const custom = !auto.value && preset.value.name === 'custom';
  const value = auto.value ? 'auto' : conf.value;
  const mode = theme.value;
  // The auto entry sweeps accents like the swatch grid's auto tile.
  const autoSwatch =
    'linear-gradient(90deg, ' +
    ['blue', 'green', 'yellow', 'red']
      .map((name) => {
        const item = displayPresets.find((entry) => entry.name === name);
        return item ? presetAccent(item, mode) : 'transparent';
      })
      .join(', ') +
    ')';
  const groups: ConfSelectGroup[] = [
    {
      label: null,
      options: [
        ...(custom ? [{ value, swatch: value }] : []),
        { value: 'auto', swatch: autoSwatch },
      ],
    },
    {
      label: 'presets',
      options: displayPresets.map((item) => ({
        value: item.name,
        swatch: presetAccent(item, mode),
      })),
    },
  ];
  return (
    <ConfSelect
      ariaLabel="@chroma_preset value"
      value={value}
      display={"'" + conf.value + "'"}
      groups={groups}
      onSelect={(next) => {
        if (next === 'auto') {
          selectAuto();
          return;
        }
        const found = displayPresets.find((item) => item.name === next);
        if (found) {
          selectPreset(found);
        }
      }}
    />
  );
}

// The hero's light/dark toggle: a prominent shortcut that flips
// @chroma_background between the plain named modes (dropping any
// custom seed, like picking dark/light from the conf dropdown). It
// also clears a forced @chroma_mode, which would otherwise pin the
// theme and make the toggle appear dead.
export function BackgroundQuickToggle() {
  const current = theme.value;
  const next = current === 'dark' ? 'light' : 'dark';
  return (
    <button
      class="conf-toggle"
      type="button"
      aria-label={'Switch to the ' + next + ' background'}
      onClick={() => {
        modeOverride.value = 'auto';
        setBackground(next);
      }}
    >
      {current}
    </button>
  );
}

// Forces the palette mode while @chroma_background keeps supplying
// the seed; 'auto' follows the background's own classification.
function ModeSelect() {
  const value = modeOverride.value;
  const groups: ConfSelectGroup[] = [
    {
      label: null,
      options: [
        {
          value: 'auto',
          swatch:
            'linear-gradient(90deg, ' +
            anchors.dark.bg +
            ' 50%, ' +
            anchors.light.bg +
            ' 50%)',
        },
        { value: 'dark', swatch: anchors.dark.bg },
        { value: 'light', swatch: anchors.light.bg },
      ],
    },
  ];
  return (
    <ConfSelect
      ariaLabel="@chroma_mode value"
      value={value}
      display={"'" + value + "'"}
      groups={groups}
      onSelect={(next) => {
        modeOverride.value = next;
      }}
    />
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
  const custom =
    value !== 'dark' &&
    value !== 'light' &&
    !namedBackgrounds.some((entry) => entry.name === value);
  const asOption = (entry: { name: string; seed: string }) => ({
    value: entry.name,
    swatch: entry.seed,
  });
  // Group the named themes by the same luma classification the
  // plugin applies to their seeds, so a theme always sits in the
  // group it actually renders as; each swatch is the theme's
  // background color itself.
  const groups: ConfSelectGroup[] = [
    ...(custom ? [{ label: null, options: [{ value, swatch: value }] }] : []),
    {
      label: 'modes',
      options: [
        { value: 'dark', swatch: anchors.dark.bg },
        { value: 'light', swatch: anchors.light.bg },
      ],
    },
    {
      label: 'dark themes',
      options: namedBackgrounds
        .filter(
          (entry) => colorLuma(entry.seed) < resolution.luma.lightThreshold
        )
        .map(asOption),
    },
    {
      label: 'light themes',
      options: namedBackgrounds
        .filter(
          (entry) => colorLuma(entry.seed) >= resolution.luma.lightThreshold
        )
        .map(asOption),
    },
  ];
  return (
    <ConfSelect
      ariaLabel="@chroma_background value"
      value={value}
      display={"'" + value + "'"}
      groups={groups}
      onSelect={setBackground}
    />
  );
}

// A custom terminal background, mirroring the plugin: the seed is
// classified by luma and the bar surfaces blend toward it.
export function CustomBackground() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const customSeed = normalizeHex(value);
  // Named themes come from the dropdown; this input only ever
  // applies raw hex seeds, so only those get its clear button.
  const applied = normalizeHex(background.value) !== '';

  function clear(): void {
    setValue('');
    setInvalid(false);
    inputRef.current?.setCustomValidity('');
    setBackground('dark');
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
      input.setCustomValidity('Enter a six-digit hex color, such as #fdf6e3.');
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
        '--custom-swatch': customSeed || backgroundSeed.value || barColor.value,
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
      {applied ? (
        <button
          class="custom-color-clear"
          type="button"
          aria-label="Reset the custom background"
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

// The live ~/.tmux.conf block: whitespace is significant under the
// conf-block's white-space handling, so every literal keeps its
// alignment spaces inline.
// The copyable form of the conf block: only the option lines, not
// the ~/.tmux.conf header or the reset link. Built from state
// rather than the DOM, whose text would include an open dropdown's
// option list.
function confText(): string {
  const conf = presetConfig();
  const pad = conf.option === '@chroma_base_color' ? '  ' : '      ';
  const onOff = (value: boolean): string => (value ? 'on' : 'off');
  return [
    'set -g ' + conf.option + pad + "'" + conf.value + "'",
    "set -g @chroma_background  '" + background.value + "'",
    "set -g @chroma_mode        '" + modeOverride.value + "'",
    "set -g @chroma_powerline   '" + onOff(powerline.value) + "'",
    "set -g @chroma_show_cpu    '" + onOff(showCpu.value) + "'",
    "set -g @chroma_show_memory '" + onOff(showMemory.value) + "'",
    "set -g @chroma_show_disk   '" + onOff(showDisk.value) + "'",
  ].join('\n');
}

export function ConfBlock() {
  const conf = presetConfig();
  const pad = conf.option === '@chroma_base_color' ? '  ' : '      ';
  return (
    <div class="conf-block">
      <pre class="block-scroll">
        <span class="comment"># ~/.tmux.conf</span>
        {'\nset -g ' + conf.option + pad}
        <PresetSelect />
        {'\nset -g @chroma_background  '}
        <BackgroundSelect />
        {'\nset -g @chroma_mode        '}
        <ModeSelect />
        {'\nset -g @chroma_powerline   '}
        <ConfToggle option={powerline} />
        {'\nset -g @chroma_show_cpu    '}
        <ConfToggle option={showCpu} />
        {'\nset -g @chroma_show_memory '}
        <ConfToggle option={showMemory} />
        {'\nset -g @chroma_show_disk   '}
        <ConfToggle option={showDisk} />
        {configDirty.value ? (
          <>
            {'\n\n'}
            <button class="conf-reset" type="button" onClick={resetConfig}>
              # reset to defaults
            </button>
          </>
        ) : null}
      </pre>
      <CopyButton copyLabel="Copy the configuration" getText={confText} />
    </div>
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
