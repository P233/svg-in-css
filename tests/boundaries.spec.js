import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
const svgFile = (name, content = svg) => ({ name, mimeType: "image/svg+xml", buffer: Buffer.from(content) });
const config = (name = "replacement", originalSVG = svg, optimizedSVG = svg) => ({
  prefix: "icon",
  size: "24px",
  enableSVGO: true,
  enableWebkitPrefix: true,
  enableBeforePseudo: false,
  svgList: [{ name, originalSVG, optimizedSVG }],
  previewColor: "#000000",
  configVersion: 1
});
const configFile = (name, value) => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(value))
});

const delayFileReads = (page, names) =>
  page.addInitScript((delayedNames) => {
    const readText = File.prototype.text;
    window.pendingFileReads = {};
    File.prototype.text = function () {
      if (!delayedNames.includes(this.name)) return readText.call(this);
      return new Promise((resolve, reject) => {
        window.pendingFileReads[this.name] = () => readText.call(this).then(resolve, reject);
      });
    };
  }, names);

test("SVG URL encoding preserves XML quotes and original text whitespace", async ({ page }) => {
  const quoted =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="18" font-family="\'Arial\'" xml:space="preserve"> A   B\tC </text></svg>';
  await page.goto("/");
  await page.locator('input[accept=".svg"]').setInputFiles(svgFile("quoted.svg", quoted));
  for (const isOptimized of [true, false]) {
    if (!isOptimized) await page.getByRole("switch", { name: "SVGO", exact: true }).click();
    const result = await page.locator("pre").evaluate(async (pre) => {
      const uri = pre.textContent.match(/mask-image: url\("([^"]+)"\)/)[1];
      const xml = decodeURIComponent(uri.slice(uri.indexOf(",") + 1));
      const imageLoads = await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = uri;
      });
      return {
        xml,
        imageLoads,
        hasParseError: !!new DOMParser().parseFromString(xml, "image/svg+xml").querySelector("parsererror")
      };
    });
    expect(result.imageLoads).toBe(true);
    expect(result.hasParseError).toBe(false);
    if (!isOptimized) expect(result.xml).toBe(quoted);
  }
});

const invalidSVGs = {
  malformed: '<svg xmlns="http://www.w3.org/2000/svg"><path',
  wrapped: `<wrapper>${svg}</wrapper>`,
  comment: '<!-- <svg xmlns="http://www.w3.org/2000/svg"> -->',
  "missing namespace": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'
};

for (const [reason, invalid] of Object.entries(invalidSVGs)) {
  test(`config rejects ${reason} SVG without replacing the current project`, async ({ page }) => {
    await page.goto("/");
    await page.locator('input[accept=".svg"]').setInputFiles(svgFile("kept.svg"));
    const stored = await page.evaluate(() => localStorage.getItem("APP_STORE"));
    for (const field of ["originalSVG", "optimizedSVG"]) {
      const invalidConfig = config("broken");
      invalidConfig.svgList[0][field] = invalid;
      await page.locator('input[accept=".json"]').setInputFiles(configFile("invalid.json", invalidConfig));
      await expect(page.getByText("Invalid config.json", { exact: true }).last()).toBeVisible();
      await expect(page.locator("[contenteditable]")).toHaveText(["kept"]);
      expect(await page.evaluate(() => localStorage.getItem("APP_STORE"))).toBe(stored);
      await page.reload();
      await expect(page.locator("[contenteditable]")).toHaveText(["kept"]);
    }
  });

  test(`upload rejects ${reason} SVG without changing the current project`, async ({ page }) => {
    await page.goto("/");
    await page.locator('input[accept=".svg"]').setInputFiles(svgFile("kept.svg"));
    const stored = await page.evaluate(() => localStorage.getItem("APP_STORE"));
    await page.locator('input[accept=".svg"]').setInputFiles(svgFile("invalid.svg", invalid));
    await expect(page.getByText("invalid.svg: Invalid SVG content", { exact: true })).toBeVisible();
    await expect(page.locator("[contenteditable]")).toHaveText(["kept"]);
    expect(await page.evaluate(() => localStorage.getItem("APP_STORE"))).toBe(stored);
  });
}

test("stored malformed SVG is dropped without losing valid icons or settings", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((value) => localStorage.setItem("APP_STORE", JSON.stringify(value)), {
    ...config("kept"),
    prefix: "glyph",
    svgList: [...config("kept").svgList, ...config("broken", invalidSVGs.malformed).svgList]
  });
  await page.reload();
  await expect(page.locator("[contenteditable]")).toHaveText(["kept"]);
  await expect(page.getByLabel("Prefix", { exact: true })).toHaveValue("glyph");
});

test("pending SVG reads cannot append to a replacement config", async ({ page }) => {
  await delayFileReads(page, ["pending.svg"]);
  await page.goto("/");
  await page.locator('input[accept=".svg"]').setInputFiles(svgFile("pending.svg"));
  await page.locator('input[accept=".json"]').first().setInputFiles(configFile("replacement.json", config()));
  await expect(page.locator("[contenteditable]")).toHaveText(["replacement"]);
  await page.evaluate(() => window.pendingFileReads["pending.svg"]());
  await expect(page.locator("[contenteditable]")).toHaveText(["replacement"]);
});

test("an invalid config does not cancel a pending SVG upload", async ({ page }) => {
  await delayFileReads(page, ["pending.svg"]);
  await page.goto("/");
  await page.locator('input[accept=".svg"]').setInputFiles(svgFile("pending.svg"));
  await page.locator('input[accept=".json"]').first().setInputFiles(configFile("invalid.json", {}));
  await expect(page.getByText("Invalid config.json", { exact: true })).toBeVisible();
  await page.evaluate(() => window.pendingFileReads["pending.svg"]());
  await expect(page.locator("[contenteditable]")).toHaveText(["pending"]);
});

test("the latest selected config wins when an older read completes last", async ({ page }) => {
  await delayFileReads(page, ["older.json"]);
  await page.goto("/");
  await page
    .locator('input[accept=".json"]')
    .first()
    .setInputFiles(configFile("older.json", config("older")));
  await page
    .locator('input[accept=".json"]')
    .first()
    .setInputFiles(configFile("newer.json", config("newer")));
  await expect(page.locator("[contenteditable]")).toHaveText(["newer"]);
  await page.evaluate(() => window.pendingFileReads["older.json"]());
  await expect(page.locator("[contenteditable]")).toHaveText(["newer"]);
});

for (const pendingType of ["svg", "json"]) {
  test(`clear all invalidates pending ${pendingType} reads`, async ({ page }) => {
    const name = `pending.${pendingType}`;
    await delayFileReads(page, [name]);
    await page.goto("/");
    await page.locator('input[accept=".svg"]').setInputFiles(svgFile("kept.svg"));
    await page
      .locator(`input[accept=".${pendingType}"]`)
      .setInputFiles(pendingType === "svg" ? svgFile(name) : configFile(name, config("pending")));
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await page.evaluate((fileName) => window.pendingFileReads[fileName](), name);
    await expect(page.locator("[contenteditable]")).toHaveCount(0);
  });
}

test("saving resumes after access to localStorage is restored", async ({ page }) => {
  await page.addInitScript(() => {
    const storage = window.localStorage;
    window.isStorageBlocked = true;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        if (window.isStorageBlocked) throw new DOMException("Storage is disabled", "SecurityError");
        return storage;
      }
    });
  });
  await page.goto("/");
  await page.locator('input[accept=".svg"]').setInputFiles(svgFile("kept.svg"));
  await expect(page.getByRole("alert")).toContainText("Changes cannot be saved");
  await page.evaluate(() => (window.isStorageBlocked = false));
  await page.getByLabel("Prefix", { exact: true }).fill("glyph");
  await expect(page.getByRole("alert")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("APP_STORE")));
  expect(saved.prefix).toBe("glyph");
  expect(saved.svgList.map((entry) => entry.name)).toEqual(["kept"]);
});

test("full storage shows an exportable warning and recovers after space is freed", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[accept=".svg"]').setInputFiles(svgFile("kept.svg"));
  await page.evaluate(() => localStorage.setItem("quota-fixture", "x".repeat(4500000)));
  const largeSVG = svg.replace("<circle", `<metadata>${"x".repeat(1000000)}</metadata><circle`);
  await page.locator('input[accept=".svg"]').setInputFiles(svgFile("large.svg", largeSVG));
  await expect(page.locator("[contenteditable]")).toHaveText(["kept", "large"]);
  const warning = page.getByRole("alert");
  await expect(warning).toContainText("Browser storage is full");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("APP_STORE")).svgList.map((entry) => entry.name))
  ).toEqual(["kept"]);
  expect(await page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(true);

  const downloading = page.waitForEvent("download");
  await warning.getByRole("button", { name: "Export config", exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported.svgList.map((entry) => entry.name)).toEqual(["kept", "large"]);
  expect(exported.svgList[1].originalSVG).toBe(largeSVG);

  await page.evaluate(() => localStorage.removeItem("quota-fixture"));
  await page.getByLabel("Prefix", { exact: true }).fill("glyph");
  await expect(warning).toHaveCount(0);
  expect(await page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(false);
  await page.reload();
  await expect(page.locator("[contenteditable]")).toHaveText(["kept", "large"]);
  await expect(page.getByLabel("Prefix", { exact: true })).toHaveValue("glyph");
});
