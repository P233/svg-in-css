import { createSignal, createMemo, onCleanup, Show, For } from "solid-js";
import Color from "color";
import toast, { Toaster } from "solid-toast";
import Prism from "prismjs";
import store from "~/store";
import generateCode, { encodeSVG } from "~/utils/generateCode";
import isValidConfig from "~/utils/isValidConfig";
import optimizeSVG from "~/utils/optimizeSVG";
import css from "~/styles/styles.module.scss";
import { version } from "../package.json";
import type { Component, JSX } from "solid-js";

const downloadFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const $link = document.createElement("a");
  $link.href = url;
  $link.download = filename;
  $link.style.display = "none";
  document.body.appendChild($link);
  $link.click();
  document.body.removeChild($link);
  URL.revokeObjectURL(url);
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
};

const Toggle = (props: { isActive: boolean; labelledBy: string; onClick: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={props.isActive}
    aria-labelledby={props.labelledBy}
    class={css.toggle}
    classList={{ [css.active]: props.isActive }}
    onClick={() => props.onClick()}
  >
    <span class={css.toggle__thumb} aria-hidden="true" />
  </button>
);

const App: Component = () => {
  const { appState, appStateModifiers } = store;

  const [isDragging, setIsDragging] = createSignal(false);
  const [isCopied, setIsCopied] = createSignal(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (copyTimer) clearTimeout(copyTimer);
  });

  const code = createMemo(() => {
    return generateCode(appState);
  });
  const codeHTML = createMemo(() => {
    return Prism.highlight(code(), Prism.languages["css"], "css");
  });
  const codeSize = createMemo(() => {
    return formatBytes(new Blob([code()]).size);
  });
  const hasSVGs = createMemo(() => {
    return !!appState.svgList.length;
  });
  const parsedPreviewColor = createMemo(() => {
    try {
      return Color(appState.previewColor);
    } catch {
      return Color("#000000");
    }
  });
  const normalizedPreviewColor = createMemo(() => {
    return parsedPreviewColor().hex().toLowerCase();
  });
  const isPreviewColorLight = createMemo(() => {
    return parsedPreviewColor().isLight();
  });

  const handleUploadSVG = async (file: File) => {
    if (!/\.svg$/i.test(file.name)) return;

    try {
      const name = file.name.replace(/\.svg$/i, "").trim() || "svg";
      const originalSVG = await file.text();
      appStateModifiers.addSVG({
        name,
        originalSVG,
        optimizedSVG: optimizeSVG(originalSVG, name)
      });
    } catch (err) {
      toast.error(`${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUploadConfigFile = async (file: File) => {
    try {
      const text = await file.text();
      const config: unknown = JSON.parse(text);
      if (isValidConfig(config)) {
        appStateModifiers.restoreConfig(config);
        toast.success("Configuration restored");
      } else {
        throw new Error("Invalid config.json");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUploadSVGs: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    files.forEach(handleUploadSVG);
  };

  const handleUploadConfigJSON: JSX.EventHandler<HTMLInputElement, Event> = (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    handleUploadConfigFile(file);
  };

  const hasDraggedFiles = (event: DragEvent) => {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  };

  const handleDragEnter: JSX.EventHandler<HTMLDivElement, DragEvent> = (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragOver: JSX.EventHandler<HTMLDivElement, DragEvent> = (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    if (!isDragging()) setIsDragging(true);
  };

  const handleDragLeave: JSX.EventHandler<HTMLDivElement, DragEvent> = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDropFiles: JSX.EventHandler<HTMLDivElement, DragEvent> = (event) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) return;

    const configFile = files.find((f) => /\.json$/i.test(f.name));
    if (configFile) {
      handleUploadConfigFile(configFile);
      return;
    }

    const svgFiles = files.filter((f) => /\.svg$/i.test(f.name));
    if (!svgFiles.length) {
      toast.error("Please drop .svg or .json files");
      return;
    }
    svgFiles.forEach(handleUploadSVG);
  };

  const handleUpdatePreviewColor: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
    appStateModifiers.updatePreviewColor(event.currentTarget.value);
  };

  const handleDownloadConfigJSON = () => {
    const content = JSON.stringify(
      {
        prefix: appState.prefix,
        size: appState.size,
        enableSVGO: appState.enableSVGO,
        enableWebkitPrefix: appState.enableWebkitPrefix,
        enableBeforePseudo: appState.enableBeforePseudo,
        svgList: appState.svgList,
        previewColor: appState.previewColor,
        configVersion: appState.configVersion
      },
      null,
      2
    );

    downloadFile("svg-in-css.config.json", content);
  };

  const handleDownloadCSS = () => {
    downloadFile("svg-in-css.css", code());
  };

  const handleDownloadSVG = (idx: number) => {
    const target = appState.svgList[idx];
    if (!target) return;
    downloadFile(`${target.name}.svg`, target.originalSVG);
  };

  const handleRemoveAll = () => {
    if (confirm("Remove all SVGs?")) {
      appStateModifiers.removeAllSVGs();
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard
      .writeText(code())
      .then(() => {
        setIsCopied(true);
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => setIsCopied(false), 1800);
        toast.success("Copied to clipboard");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to copy to clipboard");
      });
  };

  const handleRenameSVG = (idx: number, event: FocusEvent & { currentTarget: HTMLSpanElement }) => {
    const currentName = appState.svgList[idx]?.name ?? "";
    const name = (event.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!name) {
      event.currentTarget.textContent = currentName;
      return;
    }
    event.currentTarget.textContent = name;
    if (name !== currentName) {
      appStateModifiers.renameSVG(idx, name);
    }
  };

  const handleRenameSVGKeyDown = (idx: number, event: KeyboardEvent & { currentTarget: HTMLSpanElement }) => {
    // IMEs can end composition before dispatching their final keydown.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.textContent = appState.svgList[idx]?.name ?? "";
      event.currentTarget.blur();
    }
  };

  const handleRenameSVGPaste: JSX.EventHandler<HTMLSpanElement, ClipboardEvent> = (event) => {
    event.preventDefault();
    const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/[\r\n]+/g, " ").trim();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    selection.deleteFromDocument();
    const textNode = document.createTextNode(text);
    selection.getRangeAt(0).insertNode(textNode);
    selection.collapseToEnd();
    event.currentTarget.normalize();
  };

  return (
    <div
      class={css.page}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropFiles}
    >
      <Show when={hasSVGs() && isDragging()}>
        <div class={css.dropOverlay} aria-hidden="true">
          <div class={css.dropOverlay__card}>
            <div class={css.dropOverlay__icon} />
            <span>Drop .svg or config.json files to import</span>
          </div>
        </div>
      </Show>

      <header class={css.topbar}>
        <div class={css.topbar__inner}>
          <div class={css.topbar__brand}>
            <div class={css.brandBadge} aria-hidden="true" />
            <div class={css.topbar__titleGroup}>
              <div class={css.topbar__titleRow}>
                <h1>SVG in CSS</h1>
                <span class={css.versionPill}>v{version}</span>
              </div>
              <p class={css.topbar__subtitle}>
                Embed SVG icons in CSS via URL-encoding &amp; masks · Inspired by{" "}
                <a href="https://yoksel.github.io/url-encoder/">URL-encoder</a> ·{" "}
                <a href="https://peiwen.lu/posts/svg-in-css">Article</a>
              </p>
            </div>
          </div>

          <div class={css.topbar__actions}>
            <label class={css.buttonGhost}>
              <input class={css.fileInput} type="file" accept=".json" onChange={handleUploadConfigJSON} />
              <span>Import config</span>
            </label>
            <Show when={hasSVGs()}>
              <button type="button" class={css.buttonGhost} onClick={handleDownloadConfigJSON}>
                Export config
              </button>
            </Show>
            <a class={css.buttonGhost} href="https://github.com/P233/svg-in-css">
              GitHub
            </a>
          </div>
        </div>
      </header>

      <Show
        when={hasSVGs()}
        fallback={
          <main class={css.emptyStage}>
            <div class={css.dropzone} classList={{ [css.dropzoneActive]: isDragging() }}>
              <div class={css.dropzone__badge} aria-hidden="true">
                <div class={css.dropzone__icon} />
              </div>
              <h2 class={css.dropzone__title}>Drop SVG files or config.json here</h2>
              <p class={css.dropzone__hint}>
                Automatically optimizes icons with SVGO and generates ready-to-use CSS mask rules.
              </p>
              <div class={css.dropzone__actions}>
                <label class={css.buttonPrimary}>
                  <input class={css.fileInput} type="file" multiple={true} accept=".svg" onChange={handleUploadSVGs} />
                  <span>Upload SVGs</span>
                </label>
                <label class={css.buttonSecondary}>
                  <input class={css.fileInput} type="file" accept=".json" onChange={handleUploadConfigJSON} />
                  <span>Import config.json</span>
                </label>
              </div>
            </div>
          </main>
        }
      >
        <div class={css.workbench}>
          <aside class={css.sidebar} aria-label="SVG icons">
            <div class={css.sidebar__header}>
              <div class={css.sidebar__titleGroup}>
                <h2 class={css.sidebar__title}>Icons</h2>
                <span class={css.countBadge}>{appState.svgList.length}</span>
              </div>
              <label class={css.addSvgButton}>
                <input class={css.fileInput} type="file" multiple={true} accept=".svg" onChange={handleUploadSVGs} />
                <span>Add SVGs</span>
              </label>
            </div>

            <div class={css.sidebar__toolbar}>
              <label class={css.colorSetting} title="Change icon preview color">
                <span class={css.colorSetting__label}>Preview</span>
                <span class={css.colorSetting__picker}>
                  <input
                    class={css.colorSetting__input}
                    type="color"
                    value={normalizedPreviewColor()}
                    onInput={handleUpdatePreviewColor}
                  />
                  <span class={css.colorSetting__hex}>{normalizedPreviewColor()}</span>
                </span>
              </label>

              <div class={css.listToolbar__actions}>
                <Show when={appState.svgList.length > 1}>
                  <button
                    type="button"
                    class={css.toolbarButton}
                    title="Sort icons alphabetically"
                    onClick={appStateModifiers.sortAlphabetically}
                  >
                    Sort A–Z
                  </button>
                </Show>
                <button
                  type="button"
                  class={css.toolbarButton}
                  data-variant="danger"
                  title="Remove all SVGs"
                  onClick={handleRemoveAll}
                >
                  Clear all
                </button>
              </div>
            </div>

            <div class={css.svgList} style={{ color: appState.previewColor }}>
              <For each={appState.svgList}>
                {(i, idx) => {
                  let $input: HTMLSpanElement | undefined;
                  const maskImage = createMemo(
                    () => `url("${encodeSVG(appState.enableSVGO ? i.optimizedSVG : i.originalSVG)}")`
                  );
                  return (
                    <div class={css.svgEntry}>
                      <div
                        class={css.svgEntry__tile}
                        classList={{ [css.tileDark]: isPreviewColorLight() }}
                        aria-hidden="true"
                      >
                        <div
                          class={css.svgEntry__preview}
                          style={{
                            "-webkit-mask-image": maskImage(),
                            "mask-image": maskImage()
                          }}
                        />
                      </div>
                      <div
                        class={css.svgEntry__filename}
                        onClick={(e) => {
                          if (e.target !== $input) $input?.focus();
                        }}
                      >
                        <span
                          ref={(element) => ($input = element)}
                          class={css.svgEntry__input}
                          contentEditable
                          spellcheck={false}
                          title="Click to rename"
                          textContent={i.name}
                          onKeyDown={(e) => handleRenameSVGKeyDown(idx(), e)}
                          onPaste={handleRenameSVGPaste}
                          onBlur={(e) => handleRenameSVG(idx(), e)}
                        />
                        <span class={css.svgEntry__ext}>.svg</span>
                      </div>
                      <button
                        type="button"
                        class={css.svgEntry__download}
                        title={`Download ${i.name}.svg`}
                        aria-label={`Download ${i.name}.svg`}
                        onClick={() => handleDownloadSVG(idx())}
                      />
                      <button
                        type="button"
                        class={css.svgEntry__remove}
                        title={`Remove ${i.name}.svg`}
                        aria-label={`Remove ${i.name}.svg`}
                        onClick={() => appStateModifiers.removeSVG(idx())}
                      />
                    </div>
                  );
                }}
              </For>
            </div>
          </aside>

          <main class={css.editorPanel}>
            <section class={css.settingsBar} aria-label="Output settings">
              <div class={css.settingsBar__group}>
                <div class={css.settingsBar__field}>
                  <label for="svg-prefix">Prefix</label>
                  <input
                    id="svg-prefix"
                    type="text"
                    value={appState.prefix}
                    onInput={(event) => appStateModifiers.updatePrefix(event.currentTarget.value)}
                    onBlur={(event) => {
                      if (!event.currentTarget.value.trim()) {
                        appStateModifiers.updatePrefix("icon");
                      }
                    }}
                    class={css.input}
                    placeholder="icon"
                  />
                </div>
                <div class={css.settingsBar__field}>
                  <label for="svg-size">Size</label>
                  <input
                    id="svg-size"
                    type="text"
                    value={appState.size}
                    onInput={(event) => appStateModifiers.updateSize(event.currentTarget.value)}
                    class={css.input}
                    data-size="compact"
                    placeholder="auto"
                    title="Leave empty to omit width and height"
                  />
                </div>
              </div>

              <div class={css.settingsBar__group}>
                <div class={css.settingsBar__field}>
                  <span id="svgo-label" class={css.settingsBar__label}>
                    SVGO
                  </span>
                  <Toggle
                    labelledBy="svgo-label"
                    isActive={appState.enableSVGO}
                    onClick={appStateModifiers.toggleEnableSVGO}
                  />
                </div>
                <div class={css.settingsBar__field}>
                  <span id="webkit-prefix-label" class={css.settingsBar__label} data-mono="true">
                    -webkit-
                  </span>
                  <Toggle
                    labelledBy="webkit-prefix-label"
                    isActive={appState.enableWebkitPrefix}
                    onClick={appStateModifiers.toggleEnableWebkitPrefix}
                  />
                </div>
                <div class={css.settingsBar__field}>
                  <span id="before-pseudo-label" class={css.settingsBar__label} data-mono="true">
                    ::before
                  </span>
                  <Toggle
                    labelledBy="before-pseudo-label"
                    isActive={appState.enableBeforePseudo}
                    onClick={appStateModifiers.toggleEnableBeforePseudo}
                  />
                </div>
              </div>
            </section>

            <div class={css.codeHeader}>
              <div class={css.codeHeader__meta}>
                <span class={css.statusDot} aria-hidden="true" />
                <span>Generated CSS</span>
                <span class={css.metaDivider}>·</span>
                <span>
                  {appState.svgList.length} {appState.svgList.length === 1 ? "icon" : "icons"}
                </span>
                <span class={css.metaDivider}>·</span>
                <span>{codeSize()}</span>
              </div>

              <div class={css.codeHeader__actions}>
                <button type="button" class={css.downloadCssButton} onClick={handleDownloadCSS}>
                  Download .css
                </button>
                <button
                  type="button"
                  class={css.copyButton}
                  classList={{ [css.copied]: isCopied() }}
                  onClick={handleCopyToClipboard}
                >
                  {isCopied() ? "Copied!" : "Copy CSS"}
                </button>
              </div>
            </div>

            <div class={css.codeViewport}>
              <pre class={css.code} innerHTML={codeHTML()} />
            </div>
          </main>
        </div>
      </Show>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            "font-size": "13.5px",
            "font-weight": "500",
            color: "var(--text-primary)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            "border-radius": "10px",
            "box-shadow": "var(--shadow-float)"
          }
        }}
      />
    </div>
  );
};

export default App;
