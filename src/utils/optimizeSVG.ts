import { optimize } from "svgo/browser";
import isValidSVG from "./isValidSVG";

export default function optimizeSVG(svg: string, name: string): string {
  if (!isValidSVG(svg)) {
    throw new Error("Invalid SVG content");
  }

  const { data } = optimize(svg, {
    plugins: [
      "preset-default",
      "removeDimensions",
      {
        name: "prefixIds",
        params: { prefix: `svg-${name.replace(/[^\w-]/g, "-")}` }
      }
    ]
  });

  if (!isValidSVG(data)) {
    throw new Error("Empty or invalid SVG");
  }

  return data;
}
