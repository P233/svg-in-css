import { createSignal, createEffect, createMemo, onCleanup, Show, For } from "solid-js";
import Color from "color";
import toast, { Toaster } from "solid-toast";
import { optimize } from "svgo/dist/svgo.browser.js";
import Prism from "prismjs";
import store from "~/store";
import generateCode, { encodeSVG } from "~/utils/generateCode";
import isValidConfig from "./utils/isValidConfig";
import css from "~/styles/styles.module.scss";
import { version } from "../package.json";
import type { Component } from "solid-js";

const getSVGOConfig = (prefix: string) => {
  return {
    plugins: [
      "preset-default",
      "removeDimensions",
      {
        name: "prefixIds",
        params: { prefix }
      }
    ]
  };
};

const Toggle = (props: { isActive: boolean; onClick: () => void }) => (
  <button class={css.toggle} classList={{ [css.active]: props.isActive }} onClick={() => props.onClick()}>
    <span>On</span>
    <span>Off</span>
  </button>
);

const App: Component = () => {
  const { appState, appStateModifiers } = store;

  const [isModalOpen, setIsModalOpen] = createSignal(false);
  let $modal: HTMLDListElement;
  const handleModalOutsideClick = (e: any) => !$modal.contains(e.target) && setIsModalOpen(false);
  createEffect(() => {
    if (isModalOpen()) {
      document.addEventListener("mousedown", handleModalOutsideClick);
      onCleanup(() => document.removeEventListener("mousedown", handleModalOutsideClick));
    }
  });

  const code = createMemo(() => {
    return generateCode(appState);
  });
  const codeHTML = createMemo(() => {
    return Prism.highlight(code(), Prism.languages["css"], "css");
  });
  const hasSVGs = createMemo(() => {
    return !!appState.svgList.length;
  });

  const handleUpload = (file: any) => {
    if (!/\.svg$/.test(file.name)) return;

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = (e: any) => {
      const name = file.name.replace(/\.svg$/, "");
      appStateModifiers.addSVG({
        name,
        originalSVG: e.target.result,
        optimizedSVG: optimize(e.target.result, getSVGOConfig(name)).data
      });
    };
  };

  const handleUploadSVGs = (e: any) => {
    Array.from(e.target.files).forEach(handleUpload);
  };

  const handleDropSVGs = (e: any) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(handleUpload);
  };

  const handleDragOver = (e: any) => {
    e.preventDefault();
  };

  const handleUpdatePreviewColor = (e: any) => {
    const color = e.target.value;
    appStateModifiers.updatePreviewColor(color);
  };

  const handleUploadConfigJSON = (uploadEvent: any) => {
    if (!uploadEvent.target.files.length) return;

    const reader = new FileReader();
    reader.readAsText(uploadEvent.target.files[0]);
    reader.onload = (onloadEvent: any) => {
      try {
        const config = JSON.parse(onloadEvent.target.result);
        if (isValidConfig(config)) {
          appStateModifiers.restoreConfig(config);
        } else {
          throw Error("Invalid config.json");
        }
      } catch (err) {
        uploadEvent.target.value = null; // reset config file input
        toast.error(err.message);
      }
    };
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

    const $link = document.createElement("a");
    $link.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(content));
    $link.setAttribute("download", "svg-in-css.config.json");
    $link.style.display = "none";
    document.body.appendChild($link);
    $link.click();

    document.body.removeChild($link);
  };

  const handleDownloadSVG = (idx: number) => {
    const target = appState.svgList[idx];

    const $link = document.createElement("a");
    $link.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(target.originalSVG));
    $link.setAttribute("download", `${target.name}.svg`);
    $link.style.display = "none";
    document.body.appendChild($link);
    $link.click();

    document.body.removeChild($link);
  };

  const handleRemoveAll = () => {
    if (confirm("Will remove all SVGs. Are you sure to continue?")) {
      appStateModifiers.removeAllSVGs();
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard
      .writeText(code())
      .then(() => {
        toast.success("Copied to clipboard");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to copy to clipboard");
      });
  };

  const handleRenameSVG = (idx: number, e: any) => {
    const name = e.target.textContent;
    if (!name) {
      e.target.innerHTML = appState.svgList[idx].name;
      return;
    }
    appStateModifiers.renameSVG(idx, name);
  };

  const handleRenameSVGConfirm = (e: any) => {
    if (e.which === 13) {
      e.preventDefault();
      e.target.blur();
    }
  };

  return (
    <div class={css.page} classList={{ [css.hasSVGs]: hasSVGs() }} onDrop={handleDropSVGs} onDragOver={handleDragOver}>
      <main class={css.main}>
        <div class={css.main__container}>
          <div class={css.main__hgroup}>
            <h1>SVG in CSS</h1>
            <p>
              Utilizing URL encoding and CSS masking to embed SVG icons within CSS. Inspried by{" "}
              <a href="https://yoksel.github.io/url-encoder/">URL-encoder for SVG</a>. Check out{" "}
              <a href="https://peiwen.lu/post/svg-in-css">this post</a> for extra details.
            </p>
          </div>

          <Show
            when={hasSVGs()}
            fallback={
              <div class={css.main__buttonGroup}>
                <label class={css.button}>
                  <input type="file" accept=".json" onChange={handleUploadConfigJSON} />
                  <span>Upload svg-in-css.config.json</span>
                </label>
                <label class={css.button}>
                  <input type="file" multiple={true} accept=".svg" onChange={handleUploadSVGs} />
                  <span>Upload SVGs</span>
                </label>
              </div>
            }
          >
            <button class={css.copyButton} onClick={handleCopyToClipboard}>
              Copy
            </button>
            <pre class={css.code} innerHTML={codeHTML()} />
          </Show>

          <div class={css.settingsModal} classList={{ [css.show]: isModalOpen() }}>
            <dl class={css.settingsModal__box} ref={(el) => ($modal = el)}>
              <dt>Prefix</dt>
              <dd>
                <input
                  type="text"
                  value={appState.prefix}
                  onInput={(e: any) => appStateModifiers.updatePrefix(e.target.value)}
                  class={css.input}
                  placeholder="icon"
                />
              </dd>
              <dt>Icon Size</dt>
              <dd>
                <input
                  type="text"
                  value={appState.size}
                  onInput={(e: any) => appStateModifiers.updateSize(e.target.value)}
                  class={css.input}
                />
              </dd>
              <dt>Enable SVGO</dt>
              <dd>
                <Toggle isActive={appState.enableSVGO} onClick={appStateModifiers.toggleEnableSVGO} />
              </dd>
              <dt>Webkit Prefix</dt>
              <dd>
                <Toggle isActive={appState.enableWebkitPrefix} onClick={appStateModifiers.toggleEnableWebkitPrefix} />
              </dd>
              <dt>Before Pseudo</dt>
              <dd>
                <Toggle isActive={appState.enableBeforePseudo} onClick={appStateModifiers.toggleEnableBeforePseudo} />
              </dd>
            </dl>
          </div>

          <footer class={css.main__footer}>
            <span>Version: {version}</span>
            <a href="https://github.com/P233/svg-in-css">GitHub</a>
          </footer>
        </div>
      </main>
      <aside class={css.sidebar} classList={{ [css.dark]: Color(appState.previewColor).isLight() }}>
        <div class={css.sidebar__buttonGroup}>
          <button class={css.button} onMouseDown={() => setIsModalOpen(true)}>
            Output Settings
          </button>
          <label>
            <input type="file" multiple={true} accept=".svg" onChange={handleUploadSVGs} />
            <span class={css.button}>Upload more SVGs</span>
          </label>
          <button class={css.button} onClick={appStateModifiers.sortAlphabetically}>
            Sort alphabetically
          </button>
          <button class={css.button} onClick={handleRemoveAll}>
            Remove all SVGs
          </button>
          <button class={css.button} onClick={handleDownloadConfigJSON}>
            Download config.json
          </button>
        </div>
        <div class={css.svgList} style={{ color: appState.previewColor }}>
          <label class={css.colorSetting}>
            <span>SVG previews color:</span>
            <input
              class={css.colorSetting__input}
              type="color"
              value={appState.previewColor}
              onInput={handleUpdatePreviewColor}
            />
          </label>
          <For each={appState.svgList}>
            {(i, idx) => (
              <div class={css.svgEntry}>
                <div
                  class={css.svgEntry__preview}
                  style={{
                    ["-webkit-mask-image"]: `url("${encodeSVG(appState.enableSVGO ? i.optimizedSVG : i.originalSVG)}")`
                  }}
                />
                <div class={css.svgEntry__filename}>
                  <span
                    class={css.svgEntry__input}
                    contentEditable
                    spellcheck={false}
                    onKeyPress={handleRenameSVGConfirm}
                    onBlur={(e) => handleRenameSVG(idx(), e)}
                  >
                    {i.name}
                  </span>
                  .svg
                </div>
                <button class={css.svgEntry__download} onClick={() => handleDownloadSVG(idx())} />
                <button class={css.svgEntry__remove} onClick={() => appStateModifiers.removeSVG(idx())} />
              </div>
            )}
          </For>
        </div>
      </aside>
      <Toaster position="top-center" />
    </div>
  );
};

export default App;
