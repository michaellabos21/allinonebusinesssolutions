import { expect, test } from "@playwright/test";

import { startWorkspace } from "./helpers";

/**
 * The home address shows the landing page to visitors and the workspace to
 * people who are signed in. The page's sections are all reachable, with and
 * without motion.
 */
test("visitors see the landing page at the home address", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Run your whole business from one tab." }),
  ).toBeVisible();
  for (const name of ["Sell", "Deliver", "Get paid"]) {
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name }).click();
  }
  await expect(page.getByRole("heading", { name: /Know who owes you/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /invoices list/ })).toBeVisible();

  await page.getByRole("link", { name: "Watch the video" }).click();
  const video = page.locator("#video video");
  await expect(video).toBeVisible();
  // The file is served to visitors who aren't signed in.
  const src = await video.locator("source").getAttribute("src");
  expect((await page.request.get(src!)).headers()["content-type"]).toBe("video/mp4");

  await page.getByRole("link", { name: "Create your workspace" }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("with reduced motion, nothing waits to appear", async ({ browser }) => {
  const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await page.goto("/");
  await page
    .getByRole("heading", { name: "One workspace instead of five tools." })
    .scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Calendar", level: 3 })).toBeVisible();
  await expect(page.locator(".landing")).not.toHaveAttribute("data-motion", "on");
});

test("signed-in people still get their workspace at the home address", async ({ page }) => {
  await startWorkspace(page, "landing");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /welcome back/i })).toBeVisible();
});

test("search engines and link previews can read the public site", async ({ page, request }) => {
  for (const path of [
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/icon.svg",
    "/apple-icon.png",
    "/opengraph-image.png",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
  }
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /auth/");
  // Private pages are fetchable so crawlers can read their noindex tag.
  expect(robots).not.toContain("Disallow: /crm/");
  expect(robots).not.toContain("Host:");

  const welcome = await request.get("/welcome", { maxRedirects: 0 });
  expect(welcome.status()).toBe(308);
  expect(new URL(welcome.headers().location, "http://x").pathname).toBe("/");

  await page.goto("/forgot-password");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://kasama.space",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /^https:\/\/kasama\.space\/opengraph-image\.png/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    "content",
    /^https:\/\/kasama\.space\/opengraph-image\.png/,
  );
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
  );
  expect(data["@type"]).toBe("SoftwareApplication");
});

test("visitors can read the Privacy Policy and Terms", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "Privacy" })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "hello@kasama.space" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Terms" }).first().click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://kasama.space/terms",
  );

  await page.goto("/signup");
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
    "href",
    "/privacy",
  );
});
