# Changelog

## [0.1.1](https://github.com/jimeh/tmux-chroma/compare/v0.1.0...v0.1.1) (2026-07-20)


### Bug Fixes

* **website:** stabilize controls on hover and iOS ([#12](https://github.com/jimeh/tmux-chroma/issues/12)) ([5cd41df](https://github.com/jimeh/tmux-chroma/commit/5cd41dfcd76a9bcae24131497ff6e750cb40724c))

## 0.1.0 (2026-07-20)


### ⚠ BREAKING CHANGES

* drop legacy preset-name aliases

### Features

* add [@chroma](https://github.com/chroma)_mode, hero controls, and conf polish ([4cf618b](https://github.com/jimeh/tmux-chroma/commit/4cf618b9c81d33b997ca68ffa6b3a137c85b5f0c))
* add light mode across the plugin and the docs site ([9d39873](https://github.com/jimeh/tmux-chroma/commit/9d398730f91098be4d465a88cad63591c67b4c6e))
* add light-mode support via [@chroma](https://github.com/chroma)_background ([3bca0b4](https://github.com/jimeh/tmux-chroma/commit/3bca0b4f0ef69ca7d5d7d9342a1ee8beb969f4ee))
* add screenshot-ready background preview ([65633f4](https://github.com/jimeh/tmux-chroma/commit/65633f4eb523c1b17658d8acae27f85ec5c73b24))
* add screenshot-ready background preview ([e5790ea](https://github.com/jimeh/tmux-chroma/commit/e5790ea1e298325b79020e034debe2d1c57310cc))
* adopt the terminal-session layout for the docs site ([2ee476d](https://github.com/jimeh/tmux-chroma/commit/2ee476d8ce84540b60a7ab90b392992ac51ddf7b))
* establish Chroma's landing identity ([e8cc810](https://github.com/jimeh/tmux-chroma/commit/e8cc81043f800121bc0aa8fffd3f2f004f50414c))
* extend light mode to the site and enrich [@chroma](https://github.com/chroma)_background ([d55d294](https://github.com/jimeh/tmux-chroma/commit/d55d294fdc3a0589df7c8eb8a719fbeb393df0a0))
* give Chroma a standalone public home ([5fed370](https://github.com/jimeh/tmux-chroma/commit/5fed370daff19415255c99e9e237b5df716dc895))
* hide a banner re-color easter egg behind the tmux prefix ([b6aed63](https://github.com/jimeh/tmux-chroma/commit/b6aed63340facc44bd12d87f664e978ac977f751))
* hide a preset gallery behind the tmux prefix ([5201531](https://github.com/jimeh/tmux-chroma/commit/5201531fd1cf1896f50ac5d40943412e877bfb33))
* make 'auto' an explicit host-seeded preset value ([4abc7f8](https://github.com/jimeh/tmux-chroma/commit/4abc7f8d635c87bdae003c2304c1365250544f0e))
* make accent presets easier to explore ([08dbe70](https://github.com/jimeh/tmux-chroma/commit/08dbe7052eecd293a4b4ab2332fed5556b1b7cd7))
* make custom accents previewable ([3117001](https://github.com/jimeh/tmux-chroma/commit/31170017511873a98509c5ad604e68b3374f80ad))
* move the website to Bun and strict TypeScript ([f610bcf](https://github.com/jimeh/tmux-chroma/commit/f610bcf6b4403f2a8a7190827d24e541f9455b40))
* publish packaged Chroma releases ([a3ef8e1](https://github.com/jimeh/tmux-chroma/commit/a3ef8e100a96c33ca482f856a0f17ccee4404245))
* publish packaged Chroma releases ([fd9d724](https://github.com/jimeh/tmux-chroma/commit/fd9d724c14bd96586088aac9dde9aa66c9bdb8bb))
* rebuild the docs site and align presets with Catppuccin ([ecb39de](https://github.com/jimeh/tmux-chroma/commit/ecb39de15ace9f4ee25d349ce25b990e329256d1))
* swatched conf dropdowns, persistence, and mobile polish ([a084fc7](https://github.com/jimeh/tmux-chroma/commit/a084fc7d3d8c4e938f39225478601d0b03f9d033))


### Bug Fixes

* address bot review findings on normalization and sync depth ([50c2ac3](https://github.com/jimeh/tmux-chroma/commit/50c2ac37e4ac34ce759302a69a9542ab3da44357))
* align docs preview with tmux cell geometry ([ab4e5ed](https://github.com/jimeh/tmux-chroma/commit/ab4e5ed9b11c35fc40cec7a438da61e43c636973))
* align input focus rings with their container borders ([50bf136](https://github.com/jimeh/tmux-chroma/commit/50bf13673953f9933ffabca8c7af1397e7d6ea1c))
* attach powerline glyphs cleanly to their segments ([4f2306c](https://github.com/jimeh/tmux-chroma/commit/4f2306c27a322aba2e9817d87ebccbc8f1fd1ac5))
* **ci:** avoid duplicate pull request runs ([a2e15ad](https://github.com/jimeh/tmux-chroma/commit/a2e15ad1d5edffb1363348f2826af755b4722084))
* **ci:** harden packaged release validation ([639023c](https://github.com/jimeh/tmux-chroma/commit/639023cccabe4a20527d6d4b401e6581240a51b4))
* **ci:** retain main branch validation ([a5e12c5](https://github.com/jimeh/tmux-chroma/commit/a5e12c50a459a373e28011b1da290e7b7f8510c2))
* **ci:** tighten release security contracts ([abd9ef2](https://github.com/jimeh/tmux-chroma/commit/abd9ef23e55dbb478351beec75222354a8add20b))
* compute the active status-line window from scroll position ([80020ac](https://github.com/jimeh/tmux-chroma/commit/80020ac9cc17118119009e5b4adcf03d64ad3600))
* declare Vite client types for the website ([ff59960](https://github.com/jimeh/tmux-chroma/commit/ff59960f94e7a8e6221e6cbadb11de3d2bfb5d22))
* keep custom hex behavior consistent ([a216941](https://github.com/jimeh/tmux-chroma/commit/a2169411d503a69ba219832c1c2ba3e8c7ab185b))
* keep docs content clear across viewports ([df01d2e](https://github.com/jimeh/tmux-chroma/commit/df01d2e1df89eeaebb9cb8fb4df5447b0cc266c3))
* keep keyboard focus on dock buttons across re-renders ([32cd2e8](https://github.com/jimeh/tmux-chroma/commit/32cd2e827781128f0495d923479dd20463c1bfd3))
* keep pane borders and the swatch grid inside the text measure ([dee870b](https://github.com/jimeh/tmux-chroma/commit/dee870bc65785734f392a89f31c978341295ba3c))
* land narrow-viewport dividers on the bar color ([39568a7](https://github.com/jimeh/tmux-chroma/commit/39568a78e25fcbde71422c74e7a5706f2e98678a))
* make docs preview match tmux output ([e4818ef](https://github.com/jimeh/tmux-chroma/commit/e4818efbce3173bd02b461f7b07b22adb51588bc))
* make the preset gallery honestly modal ([e538f4d](https://github.com/jimeh/tmux-chroma/commit/e538f4d025f462938348c4dbcdbb9331245d310d))
* make validation deterministic across environments ([fa5088c](https://github.com/jimeh/tmux-chroma/commit/fa5088c507e5a5c65766784d297a68668f4801f1))
* prevent preview clipping at layout boundary ([8b15d53](https://github.com/jimeh/tmux-chroma/commit/8b15d53c3ab465ce3fc61435d7650fd815b8456e))
* restore the default Pages origin ([96465e2](https://github.com/jimeh/tmux-chroma/commit/96465e26b99f5597444aa487d1ebbf644e471cf2))
* use the canonical Pages URL ([a27c378](https://github.com/jimeh/tmux-chroma/commit/a27c3781d31ea4657934579d415ecdcacc54f1a9))


### Code Refactoring

* drop legacy preset-name aliases ([d34211b](https://github.com/jimeh/tmux-chroma/commit/d34211b55d867c0b46ef6c24b8bbaf54a6498365))

## Changelog
