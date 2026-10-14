// This function is directly borrowed from github.com/yoksel/url-encoder
// https://github.com/yoksel/url-encoder/blob/master/src/js/script.js#LL133-L147C2
export function encodeSVG(data: string) {
  // Use single quotes instead of double to avoid encoding.
  data = data.replace(/"/g, `'`);

  data = data.replace(/>\s{1,}</g, `><`);
  data = data.replace(/\s{2,}/g, ` `);

  // Using encodeURIComponent() as replacement function
  // allows to keep result code readable
  return "data:image/svg+xml," + data.replace(/[\r\n%#()<>?[\\\]^`{|}]/g, encodeURIComponent);
}

export default function generateCode({
  prefix,
  size,
  enableSVGO,
  enableBeforePseudo,
  enableWebkitPrefix,
  svgList
}: AppState) {
  const normalizedPrefix = prefix.trim().replace(/\s+/g, "-") || "icon";
  const selectorPrefix = CSS.escape(normalizedPrefix);
  const usedClassNames = new Set([normalizedPrefix]);
  const classNames = new Map<SVGEntry, string>();

  for (const svg of [...svgList].sort((a, b) => a.name.localeCompare(b.name))) {
    const name = svg.name.trim().replace(/\s+/g, "-") || "svg";
    const baseName = `${normalizedPrefix}-${name}`;
    let className = baseName;
    let suffix = 2;
    while (usedClassNames.has(className)) className = `${baseName}-${suffix++}`;
    usedClassNames.add(className);
    classNames.set(svg, className);
  }

  const stylelintComment = enableWebkitPrefix ? "/* stylelint-disable property-no-vendor-prefix */\n\n" : "";
  const trimmedSize = size.trim();

  const shareProperties =
    (trimmedSize ? `\twidth: ${trimmedSize};\n\theight: ${trimmedSize};\n` : "") +
    "\tbackground: currentcolor;\n" +
    `\t${enableWebkitPrefix ? "-webkit-" : ""}mask-repeat: no-repeat;\n` +
    `\t${enableWebkitPrefix ? "-webkit-" : ""}mask-position: center;`;

  const shareStyles = enableBeforePseudo
    ? `.${selectorPrefix} {
\tdisplay: inline-flex; /* Modify as per your needs. */
\talign-items: center;  /* Modify as per your needs. */
}\n
.${selectorPrefix}::before {
\tcontent: "";
\tflex-shrink: 0;       /* Modify as per your needs. */
\tmargin-right: 4px;    /* Modify as per your needs. */
${shareProperties}
}\n\n`
    : `.${selectorPrefix} {
\tdisplay: block;       /* Modify as per your needs. */
${shareProperties}
}\n\n`;

  const svgCodeList = svgList
    .map((i: SVGEntry) => {
      const svgURI = encodeSVG(enableSVGO ? i.optimizedSVG : i.originalSVG);

      return `.${CSS.escape(classNames.get(i)!)}${enableBeforePseudo ? "::before" : ""} {
\t${enableWebkitPrefix ? "-webkit-" : ""}mask-image: url("${svgURI}");
}`;
    })
    .join("\n\n");

  return stylelintComment + shareStyles + svgCodeList;
}
