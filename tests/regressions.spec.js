import { expect, test } from "@playwright/test";

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
const svgFile = (name) => ({ name, mimeType: "image/svg+xml", buffer: Buffer.from(svg) });

test("blank upload names do not discard the icon list on reload", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[accept=".svg"]').setInputFiles([svgFile("normal.svg"), svgFile(" .svg"), svgFile(".svg")]);
  await expect(page.locator("[contenteditable]")).toHaveCount(3);
  await expect(page.locator("pre")).toContainText(".icon-svg");
  await page.reload();
  await expect(page.locator("[contenteditable]")).toHaveCount(3);
  expect((await page.locator("[contenteditable]").allTextContents()).sort()).toEqual(["normal", "svg", "svg"]);
});

test("legacy blank names survive restore and remain importable", async ({ page }) => {
  const config = {
    prefix: "icon",
    size: "24px",
    enableSVGO: true,
    enableWebkitPrefix: true,
    enableBeforePseudo: false,
    svgList: ["normal", " ", ""].map((name) => ({ name, originalSVG: svg, optimizedSVG: svg })),
    previewColor: "#000000",
    configVersion: 1
  };
  await page.goto("/");
  await page.evaluate((value) => localStorage.setItem("APP_STORE", JSON.stringify(value)), config);
  await page.reload();
  await expect(page.locator("[contenteditable]")).toHaveCount(3);
  await expect(page.locator("pre")).toContainText(".icon-svg-2");
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "config.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config))
  });
  await expect(page.getByText("Configuration restored", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[contenteditable]")).toHaveCount(3);
  await page.locator('input[accept=".json"]').setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...config, svgList: [{ ...config.svgList[0], name: 42 }] }))
  });
  await expect(page.getByText("Invalid config.json", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("[contenteditable]")).toHaveCount(3);
});

for (const key of ["Enter", "Escape"]) {
  for (const composition of [{ isComposing: true }, { keyCode: 229 }]) {
    test(`rename ignores ${key} during ${JSON.stringify(composition)}`, async ({ page }) => {
      await page.goto("/");
      await page.locator('input[accept=".svg"]').setInputFiles(svgFile("original.svg"));
      const input = page.locator("[contenteditable]");
      await input.fill("pin");
      const wasPrevented = await input.evaluate(
        (element, init) => !element.dispatchEvent(new KeyboardEvent("keydown", init)),
        { key, ...composition, bubbles: true, cancelable: true }
      );
      expect(wasPrevented).toBe(false);
      await expect(input).toBeFocused();
      await expect(input).toHaveText("pin");
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("APP_STORE")).svgList[0].name)).toBe("original");
      await input.fill("拼");
      await input.press("Enter");
      await expect(input).not.toBeFocused();
      await page.reload();
      await expect(input).toHaveText("拼");
      await input.fill("cancelled");
      await input.press("Escape");
      await expect(input).toHaveText("拼");
    });
  }
}
