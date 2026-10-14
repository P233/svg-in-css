interface SVGEntry {
  name: string;
  originalSVG: string;
  optimizedSVG: string;
}

interface AppState {
  prefix: string;
  size: string;
  enableSVGO: boolean;
  enableBeforePseudo: boolean;
  enableWebkitPrefix: boolean;
  svgList: SVGEntry[];
  previewColor: string;
  configVersion: number;
}
