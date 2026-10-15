import { produce, reconcile } from "solid-js/store";
import isValidConfig, { isValidSVGEntry } from "~/utils/isValidConfig";
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

// Unlike an imported config.json, saved state drops an invalid icon on its own instead of discarding the whole project.
function restoreStoredState(value: unknown): AppState | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { svgList } = value as Record<string, unknown>;
  if (!Array.isArray(svgList)) return undefined;

  const state = { ...value, svgList: [] };
  if (!isValidConfig(state)) return undefined;
  const validEntries = svgList.filter(isValidSVGEntry);
  if (validEntries.length < svgList.length) {
    console.warn(`Dropped ${svgList.length - validEntries.length} saved icon(s) that are not valid SVG.`);
  }
  return { ...state, svgList: validEntries };
}

const [appState, setAppState, persistenceError] = createLocalStore<AppState>(defaultState, restoreStoredState);

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

export default { appState, appStateModifiers, persistenceError };
