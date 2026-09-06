import fs from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";

export type BrowserCheck = { url: string; title: string; status: "ready"; consoleErrors: string[]; pageErrors: string[] };

export class PlaywrightAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private consoleErrors: string[] = [];
  private pageErrors: string[] = [];

  private async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page;
    const { chromium } = await import("playwright");
    try {
      this.browser = await chromium.launch({ headless: true });
    } catch (firstError) {
      if (process.platform !== "win32") throw firstError;
      this.browser = await chromium.launch({ headless: true, channel: "msedge" }).catch(() => { throw firstError; });
    }
    const context = await this.browser.newContext({ viewport: { width: 1440, height: 1000 } });
    this.page = await context.newPage();
    this.page.on("console", (message) => { if (message.type() === "error") this.consoleErrors.push(message.text().slice(0, 1000)); });
    this.page.on("pageerror", (error) => this.pageErrors.push(error.message.slice(0, 1000)));
    return this.page;
  }

  async open(url: string): Promise<BrowserCheck> {
    this.consoleErrors = [];
    this.pageErrors = [];
    const page = await this.ensurePage();
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    if (response && response.status() >= 400) throw new Error(`Navigation HTTP ${response.status()} vers ${url}`);
    return { url: page.url(), title: await page.title(), status: "ready", consoleErrors: [...this.consoleErrors], pageErrors: [...this.pageErrors] };
  }

  async click(selector: string): Promise<{ ok: true; url: string }> {
    const page = await this.ensurePage();
    await page.locator(selector).first().click({ timeout: 20_000 });
    return { ok: true, url: page.url() };
  }

  async fill(selector: string, value: string): Promise<{ ok: true }> {
    const page = await this.ensurePage();
    await page.locator(selector).first().fill(value, { timeout: 20_000 });
    return { ok: true };
  }

  async press(selector: string, key: string): Promise<{ ok: true }> {
    const page = await this.ensurePage();
    await page.locator(selector).first().press(key, { timeout: 20_000 });
    return { ok: true };
  }

  async inspect(): Promise<{ url: string; title: string; text: string; consoleErrors: string[]; pageErrors: string[] }> {
    const page = await this.ensurePage();
    const text = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    return { url: page.url(), title: await page.title(), text: text.slice(0, 18_000), consoleErrors: [...this.consoleErrors].slice(-20), pageErrors: [...this.pageErrors].slice(-20) };
  }

  async screenshot(filePath: string, fullPage = true): Promise<{ path: string; url: string }> {
    const page = await this.ensurePage();
    const target = path.resolve(filePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await page.screenshot({ path: target, fullPage });
    return { path: target, url: page.url() };
  }


  async audit(): Promise<{
    passed: boolean;
    score: number;
    issues: string[];
    desktop: Record<string, unknown>;
    mobile: Record<string, unknown>;
    consoleErrors: string[];
    pageErrors: string[];
  }> {
    const page = await this.ensurePage();
    const measure = async (width: number, height: number): Promise<Record<string, unknown>> => {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      return page.evaluate(() => {
        const body = document.body;
        const root = document.documentElement;
        const all = Array.from(document.querySelectorAll("body *"));
        const visible = all.filter((element) => {
          const node = element as HTMLElement;
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
        let styledSurfaces = 0;
        let rounded = 0;
        let shadows = 0;
        for (const element of visible.slice(0, 500)) {
          const style = getComputedStyle(element as Element);
          const bg = style.backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && bg !== "rgb(255, 255, 255)") styledSurfaces += 1;
          if (parseFloat(style.borderRadius || "0") >= 6) rounded += 1;
          if (style.boxShadow && style.boxShadow !== "none") shadows += 1;
        }
        let cssRules = 0;
        for (const sheet of Array.from(document.styleSheets)) {
          try { cssRules += sheet.cssRules?.length || 0; } catch { /* cross-origin stylesheet */ }
        }
        const h1 = document.querySelector("h1");
        const h1Style = h1 ? getComputedStyle(h1) : null;
        const bodyStyle = getComputedStyle(body);
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollWidth: Math.max(body.scrollWidth, root.scrollWidth),
          horizontalOverflow: Math.max(body.scrollWidth, root.scrollWidth) > window.innerWidth + 4,
          elements: all.length,
          visibleElements: visible.length,
          sections: document.querySelectorAll("section, article, main > div").length,
          headings: document.querySelectorAll("h1,h2,h3").length,
          paragraphs: document.querySelectorAll("p").length,
          navs: document.querySelectorAll("nav,header").length,
          footers: document.querySelectorAll("footer").length,
          buttons: document.querySelectorAll("button,[role=button],input[type=submit]").length,
          links: document.querySelectorAll("a").length,
          images: document.querySelectorAll("img,picture,video,svg").length,
          forms: document.querySelectorAll("form,input,select,textarea").length,
          classedElements: document.querySelectorAll("[class]").length,
          cssRules,
          styledSurfaces,
          rounded,
          shadows,
          textChars: (body.innerText || "").trim().length,
          bodyFont: bodyStyle.fontFamily,
          bodyMargin: bodyStyle.margin,
          bodyBackground: bodyStyle.backgroundColor,
          h1FontSize: h1Style?.fontSize || "",
          title: document.title
        };
      });
    };

    const desktop = await measure(1440, 1000);
    const mobile = await measure(390, 844);
    const issues: string[] = [];
    let score = 100;
    const d = desktop as Record<string, any>;
    const m = mobile as Record<string, any>;

    if ((d.textChars || 0) < 450) { score -= 28; issues.push("Contenu visible trop faible pour une page professionnelle."); }
    if ((d.sections || 0) < 4) { score -= 20; issues.push("Trop peu de sections/blocs visuels sur la page."); }
    if ((d.classedElements || 0) < 12 && (d.cssRules || 0) < 8) { score -= 30; issues.push("Styles insuffisants : rendu proche du navigateur par défaut."); }
    if ((d.images || 0) < 1 && (d.styledSurfaces || 0) < 5) { score -= 12; issues.push("Direction visuelle trop pauvre (aucun média et très peu de surfaces travaillées)."); }
    if ((d.buttons || 0) + (d.links || 0) < 4) { score -= 10; issues.push("Peu de CTA/navigation/interactions visibles."); }
    if (d.bodyMargin === "8px" && /times new roman/i.test(String(d.bodyFont || ""))) { score -= 35; issues.push("Style navigateur par défaut détecté (Times New Roman + marge body 8px)."); }
    if (m.horizontalOverflow) { score -= 24; issues.push("Débordement horizontal détecté sur viewport mobile 390px."); }
    if ((m.visibleElements || 0) < 8) { score -= 10; issues.push("Version mobile anormalement vide."); }
    if (this.consoleErrors.length) { score -= Math.min(20, this.consoleErrors.length * 5); issues.push("Erreurs console détectées dans le navigateur."); }
    if (this.pageErrors.length) { score -= Math.min(30, this.pageErrors.length * 8); issues.push("Erreurs JavaScript de page détectées."); }

    score = Math.max(0, Math.min(100, Math.round(score)));
    return {
      passed: score >= 78 && !Boolean(m.horizontalOverflow) && this.pageErrors.length === 0,
      score,
      issues: issues.slice(0, 10),
      desktop,
      mobile,
      consoleErrors: [...this.consoleErrors].slice(-20),
      pageErrors: [...this.pageErrors].slice(-20)
    };
  }

  async close(): Promise<void> {
    this.page = null;
    if (this.browser) await this.browser.close().catch(() => undefined);
    this.browser = null;
  }
}
