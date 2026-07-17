SHELL_FILES := chroma.tmux scripts/cpu scripts/disk scripts/memory \
	test/palette-sync.sh test/site.sh test/smoke.sh
MARKDOWNLINT ?= markdownlint-cli2
HTMLVALIDATE ?= npx --yes html-validate@10.3.0
HTML_FILES := website/index.html

.PHONY: format
format:
	shfmt -w $(SHELL_FILES)

.PHONY: lint
lint:
	bash -n $(SHELL_FILES)
	shellcheck -s bash $(SHELL_FILES)
	shfmt -d $(SHELL_FILES)
	$(MARKDOWNLINT) README.md THIRD_PARTY_NOTICES.md AGENTS.md
	$(HTMLVALIDATE) $(HTML_FILES)

.PHONY: test
test:
	bash test/palette-sync.sh
	bash test/site.sh
	bash test/smoke.sh

.PHONY: check
check: lint test
