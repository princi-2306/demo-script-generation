import { Step } from "@/lib/types";

function sanitizeStr(s: string): string {
  return (s || "").replace(/["\\`]/g, "\\$&");
}

export function formatStepsToPlaywright(steps: Step[], title: string): string {
  const codeLines: string[] = [
    `import { test, expect } from '@playwright/test';`,
    ``,
    `/**`,
    ` * Playwright E2E Test Spec for "${sanitizeStr(title)}"`,
    ` * Generated automatically by Demo Script Builder`,
    ` */`,
    `test('${sanitizeStr(title)} - End-to-End Demo Script Execution', async ({ page }) => {`,
    `  // Set default timeout for interactive actions`,
    `  test.setTimeout(60000);`,
    ``,
  ];

  steps.forEach((s, idx) => {
    const stepNum = idx + 1;
    codeLines.push(`  // ==================================================`);
    codeLines.push(`  // Step ${stepNum}: ${s.title}`);
    codeLines.push(`  // ==================================================`);
    if (s.narration) {
      codeLines.push(`  // Spoken narration: "${sanitizeStr(s.narration)}"`);
    }

    const type = s.action?.type || "say";
    const target = s.action?.target?.trim() || "";
    const value = s.action?.value?.trim() || "";

    if (type === "navigate") {
      const url = value || target || "https://example.com";
      codeLines.push(`  await page.goto('${sanitizeStr(url)}');`);
    } else if (type === "click") {
      if (target) {
        if (target.startsWith("#") || target.startsWith(".") || target.includes("[")) {
          codeLines.push(`  await page.click('${sanitizeStr(target)}');`);
        } else {
          codeLines.push(`  await page.click(\`text="${sanitizeStr(target)}"\`);`);
        }
      } else {
        codeLines.push(`  // Action: click target not specified`);
      }
    } else if (type === "input") {
      if (target) {
        codeLines.push(`  await page.fill('${sanitizeStr(target)}', '${sanitizeStr(value)}');`);
      }
    } else if (type === "wait") {
      const duration = parseInt(value, 10) || 2000;
      codeLines.push(`  await page.waitForTimeout(${duration});`);
    } else if (type === "scroll") {
      codeLines.push(`  await page.evaluate(() => window.scrollBy(0, 500));`);
    } else if (type === "highlight") {
      if (target) {
        codeLines.push(`  await page.locator('${sanitizeStr(target)}').highlight();`);
      }
    } else if (type === "say") {
      codeLines.push(`  // Voice Narration: ${sanitizeStr(s.narration || target)}`);
    }

    if (s.expectedOutcome) {
      codeLines.push(`  // Verification: ${sanitizeStr(s.expectedOutcome)}`);
      if (target && !["navigate", "wait"].includes(type)) {
        if (target.startsWith("#") || target.startsWith(".") || target.includes("[")) {
          codeLines.push(`  await expect(page.locator('${sanitizeStr(target)}')).toBeVisible();`);
        } else {
          codeLines.push(`  await expect(page.getByText('${sanitizeStr(target)}')).toBeVisible();`);
        }
      }
    }
    codeLines.push(``);
  });

  codeLines.push(`});`);
  return codeLines.join("\n");
}

export function formatStepsToPuppeteer(steps: Step[], title: string): string {
  const codeLines: string[] = [
    `const puppeteer = require('puppeteer');`,
    ``,
    `/**`,
    ` * Puppeteer Browser Automation Script for "${sanitizeStr(title)}"`,
    ` * Generated automatically by Demo Script Builder`,
    ` */`,
    `(async () => {`,
    `  const browser = await puppeteer.launch({ headless: false, slowMo: 100 });`,
    `  const page = await browser.newPage();`,
    `  await page.setViewport({ width: 1280, height: 800 });`,
    ``,
  ];

  steps.forEach((s, idx) => {
    const stepNum = idx + 1;
    codeLines.push(`  // Step ${stepNum}: ${s.title}`);
    if (s.narration) {
      codeLines.push(`  // Narration: "${sanitizeStr(s.narration)}"`);
    }

    const type = s.action?.type || "say";
    const target = s.action?.target?.trim() || "";
    const value = s.action?.value?.trim() || "";

    if (type === "navigate") {
      const url = value || target || "https://example.com";
      codeLines.push(`  await page.goto('${sanitizeStr(url)}', { waitUntil: 'networkidle2' });`);
    } else if (type === "click") {
      if (target) {
        codeLines.push(`  await page.waitForSelector('${sanitizeStr(target)}');`);
        codeLines.push(`  await page.click('${sanitizeStr(target)}');`);
      }
    } else if (type === "input") {
      if (target) {
        codeLines.push(`  await page.waitForSelector('${sanitizeStr(target)}');`);
        codeLines.push(`  await page.type('${sanitizeStr(target)}', '${sanitizeStr(value)}');`);
      }
    } else if (type === "wait") {
      const duration = parseInt(value, 10) || 2000;
      codeLines.push(`  await new Promise(r => setTimeout(r, ${duration}));`);
    } else if (type === "scroll") {
      codeLines.push(`  await page.evaluate(() => window.scrollBy(0, 500));`);
    } else if (type === "say") {
      codeLines.push(`  console.log('Voice Narration:', "${sanitizeStr(s.narration || target)}");`);
    }

    if (s.expectedOutcome) {
      codeLines.push(`  // Expected Outcome: ${sanitizeStr(s.expectedOutcome)}`);
    }
    codeLines.push(``);
  });

  codeLines.push(`  console.log('Demo script execution completed successfully!');`);
  codeLines.push(`  await browser.close();`);
  codeLines.push(`})();`);
  return codeLines.join("\n");
}
