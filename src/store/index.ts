import { produce, reconcile } from "solid-js/store";
import isValidConfig from "~/utils/isValidConfig";
import optimizeSVG from "~/utils/optimizeSVG";
import createLocalStore from "./createLocalStore";

const defaultState: AppState = {
  prefix: "icon",
  size: "24px",
  enableSVGO: true,
  enableWebkitPrefix: true,
  enableBeforePseudo: false,
  svgList: [],
  previewColor: "#000000",
  configVersion: 1
};

const [appState, setAppState] = createLocalStore<AppState>(defaultState, isValidConfig);

const appStateModifiers = {
  updatePrefix: (prefix: string) => {
    setAppState(produce((s) => (s.prefix = prefix)));
  },
  updateSize: (size: string) => {
    setAppState(produce((s) => (s.size = size)));
  },
  toggleEnableSVGO: () => {
    setAppState(produce((s) => (s.enableSVGO = !s.enableSVGO)));
  },
  toggleEnableWebkitPrefix: () => {
    setAppState(produce((s) => (s.enableWebkitPrefix = !s.enableWebkitPrefix)));
  },
  toggleEnableBeforePseudo: () => {
    setAppState(produce((s) => (s.enableBeforePseudo = !s.enableBeforePseudo)));
  },
  addSVG: (entry: SVGEntry) => {
    setAppState(produce((s) => s.svgList.push(entry)));
  },
  removeSVG: (index: number) => {
    setAppState(produce((s) => s.svgList.splice(index, 1)));
  },
  renameSVG: (index: number, name: string) => {
    setAppState(
      produce((s) => {
        const entry = s.svgList[index];
        if (!entry) return;
        entry.name = name;
        try {
          entry.optimizedSVG = optimizeSVG(entry.originalSVG, name);
        } catch {
          // Keep existing optimizedSVG if re-optimization fails
        }
      })
    );
  },
  removeAllSVGs: () => {
    setAppState(produce((s) => (s.svgList = [])));
  },
  sortAlphabetically: () => {
    setAppState(produce((s) => s.svgList.sort((a, b) => a.name.localeCompare(b.name))));
  },
  updatePreviewColor: (color: string) => {
    setAppState(produce((s) => (s.previewColor = color)));
  },
  restoreConfig: (config: AppState) => {
    setAppState(reconcile(config));
  }
};

export default { appState, appStateModifiers };
