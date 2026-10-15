import { expect, test } from "@playwright/test";

test("theme follows the system, persists manual choices, and resumes following system changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveCSS("color-scheme", "light");

  const toggle = page.getByRole("button", { name: "Switch to dark theme" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(root).toHaveCSS("color-scheme", "dark");
  await page.reload();
  await expect(root).toHaveCSS("color-scheme", "dark");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(root).toHaveCSS("color-scheme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveCSS("color-scheme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveCSS("color-scheme", "light");
});

test("an invalid saved theme falls back to the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("SVG_IN_CSS_THEME", "sepia"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});

test("theme switching still works when browser storage is unavailable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"]) {
      Storage.prototype[method] = () => {
        throw new DOMException("Storage is disabled", "SecurityError");
      };
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
});

for (const colorScheme of ["light", "dark"]) {
  test(`${colorScheme} theme keeps accent and syntax readable without changing output`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await page.locator('input[accept=".svg"]').setInputFiles({
      name: "circle.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'
      )
    });
    await expect(page.locator("pre .token.string").first()).toContainText("data:image/svg+xml");
    const code = await page.locator("pre").textContent();
    const config = await page.evaluate(() => localStorage.getItem("APP_STORE"));

    const colors = await page.evaluate(() => {
      const channels = (color) => {
        const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!rgb) throw new Error(`Unexpected color: ${color}`);
        return rgb.slice(1).map(Number);
      };
      const luminance = (color) => {
        const [r, g, b] = channels(color).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return r * 0.2126 + g * 0.7152 + b * 0.0722;
      };
      const contrast = (foreground, background) => {
        const values = [luminance(foreground), luminance(background)];
        return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
      };
      const pre = document.querySelector("pre");
      const background = getComputedStyle(pre.parentElement).backgroundColor;
      const button = [...document.querySelectorAll("button")].find((element) => element.textContent === "Copy CSS");
      const buttonStyle = getComputedStyle(button);
      const accentChannels = channels(buttonStyle.backgroundColor);
      const surfaceChannels = channels(background);
      return {
        accent: buttonStyle.backgroundColor,
        accentChroma: Math.max(...accentChannels) - Math.min(...accentChannels),
        surfaceChroma: Math.max(...surfaceChannels) - Math.min(...surfaceChannels),
        buttonContrast: contrast(buttonStyle.color, buttonStyle.backgroundColor),
        accentContrast: contrast(buttonStyle.backgroundColor, background),
        baseContrast: contrast(getComputedStyle(pre).color, background),
        tokens: ["selector", "property", "function", "string", "comment"].map((token) => {
          const color = getComputedStyle(pre.querySelector(`.token.${token}`)).color;
          return { token, color, contrast: contrast(color, background) };
        })
      };
    });
    expect(colors.accentChroma).toBeGreaterThan(40);
    expect(colors.surfaceChroma).toBeLessThanOrEqual(9);
    expect(colors.buttonContrast).toBeGreaterThanOrEqual(4.5);
    expect(colors.accentContrast).toBeGreaterThanOrEqual(3);
    expect(colors.baseContrast).toBeGreaterThanOrEqual(4.5);
    expect(new Set(colors.tokens.map(({ color }) => color)).size).toBe(5);
    for (const { token, contrast } of colors.tokens) {
      expect(contrast, `${token} contrast`).toBeGreaterThanOrEqual(4.5);
    }

    await page.locator('input[type="color"]').focus();
    await expect(page.locator('input[type="color"]').locator("..")).toHaveCSS("border-top-color", colors.accent);
    const prefix = page.getByLabel("Prefix", { exact: true });
    await prefix.focus();
    await expect(prefix).toHaveCSS("border-top-color", colors.accent);
    await expect(page.getByRole("switch", { checked: true }).first()).toHaveCSS("background-color", colors.accent);
    await page.getByRole("button", { name: "Copy CSS", exact: true }).click();
    await expect(page.getByText("Copied to clipboard", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

    await page.locator('input[accept=".json"]').setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}")
    });
    await expect(page.getByText("Invalid config.json", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Switch to ${colorScheme === "light" ? "dark" : "light"} theme` }).click();
    await expect(page.locator("html")).toHaveCSS("color-scheme", colorScheme === "light" ? "dark" : "light");
    await expect(page.locator("pre")).toHaveText(code);
    expect(await page.evaluate(() => localStorage.getItem("APP_STORE"))).toBe(config);
  });
}
