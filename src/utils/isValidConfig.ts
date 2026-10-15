import Color from "color";
import isValidSVG from "./isValidSVG";

export function isValidSVGEntry(entry: unknown): entry is SVGEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const candidate = entry as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.originalSVG === "string" &&
    isValidSVG(candidate.originalSVG) &&
    typeof candidate.optimizedSVG === "string" &&
    isValidSVG(candidate.optimizedSVG)
  );
}

function isValidColor(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    Color(value);
    return true;
  } catch {
    return false;
  }
}

export default function isValidConfig(config: unknown): config is AppState {
  if (typeof config !== "object" || config === null) return false;
  const candidate = config as Record<string, unknown>;

  return (
    typeof candidate.prefix === "string" &&
    typeof candidate.size === "string" &&
    typeof candidate.enableSVGO === "boolean" &&
    typeof candidate.enableWebkitPrefix === "boolean" &&
    typeof candidate.enableBeforePseudo === "boolean" &&
    Array.isArray(candidate.svgList) &&
    candidate.svgList.every(isValidSVGEntry) &&
    isValidColor(candidate.previewColor) &&
    typeof candidate.configVersion === "number"
  );
}
