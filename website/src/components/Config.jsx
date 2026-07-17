import {
  powerline,
  prefix,
  showCpu,
  showDisk,
  showMemory,
  sync,
} from '../state.js';
import { presetConfig } from './Palette.jsx';

function ConfToggle({ option }) {
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

// The live ~/.tmux.conf block: whitespace is significant under the
// conf-block's white-space handling, so every literal keeps its
// alignment spaces inline.
export function ConfBlock() {
  const conf = presetConfig();
  const pad = conf.option === '@chroma_base_color' ? '  ' : '      ';
  return (
    <pre class="conf-block">
      <span class="comment"># ~/.tmux.conf</span>
      {'\nset -g ' + conf.option + pad + "'"}
      <span class="conf-value">{conf.value}</span>
      {"'"}
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
