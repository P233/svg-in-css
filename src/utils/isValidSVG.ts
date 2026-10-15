export default function isValidSVG(svg: string): boolean {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  return (
    document.documentElement.tagName === "svg" &&
    document.documentElement.namespaceURI === "http://www.w3.org/2000/svg" &&
    !document.querySelector("parsererror")
  );
}
