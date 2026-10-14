import { optimize } from "svgo/browser";

export default function optimizeSVG(svg: string, name: string): string {
  if (!/<svg[\s>]/i.test(svg)) {
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

  if (!data.trim() || !/<svg[\s>]/i.test(data)) {
    throw new Error("Empty or invalid SVG");
  }

  return data;
}
