import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 1. File Upload Handler (multipart/form-data)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file uploaded." },
          { status: 400 }
        );
      }

      const fileName = file.name || "Uploaded Document";
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let extractedText = "";
      const title = fileName.replace(/\.[^/.]+$/, "");

      if (fileName.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
        try {
          // Require lib/pdf-parse.js directly to prevent pdf-parse from loading ./test/data/05-versions-space.pdf
          const pdfParse = require("pdf-parse/lib/pdf-parse.js");
          const pdfData = await pdfParse(buffer);
          extractedText = pdfData.text || "";
        } catch (pdfErr: any) {
          console.warn("[PDF Parse Warning]: Primary pdf-parse failed, attempting fallback text stream extraction...", pdfErr);
          // Fallback: raw buffer text stream parsing for text content in PDF streams
          const rawStr = buffer.toString("binary");
          const matches = rawStr.match(/\(([^)]+)\)\s*Tj/g) || rawStr.match(/\[\s*\(([^)]+)\)\s*\]\s*TJ/g);
          if (matches && matches.length > 0) {
            extractedText = matches
              .map((m) => m.replace(/^[([\s)]*|\s*\]?\s*T[jJ]$/g, ""))
              .join(" ");
          } else {
            throw new Error(`Failed to extract text from PDF: ${pdfErr.message || "Invalid or encrypted PDF."}`);
          }
        }
      } else {
        extractedText = buffer.toString("utf-8");
      }

      // Cleanup text whitespace
      extractedText = extractedText
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (!extractedText) {
        return NextResponse.json(
          { error: "Could not extract text from document. Ensure the PDF contains selectable text (not scanned images)." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        title,
        url: fileName,
        content: extractedText,
      });
    }

    // 2. URL Scraping Handler (application/json)
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { error: "Please provide a valid URL starting with http:// or https://" },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL. Status code: ${res.status}` },
        { status: 400 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Strip scripts, styles, navs, headers, footers
    $("script, style, nav, footer, iframe, svg, noscript").remove();

    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      url;

    // Get main text content
    const mainContent =
      $("main, article, #content, .content, body").first().text() ||
      $.text();

    const cleanContent = mainContent
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n")
      .trim();

    return NextResponse.json({
      title,
      url,
      content: cleanContent.slice(0, 30000), // Cap length at 30k chars
    });
  } catch (err: any) {
    console.error("[Scrape Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process document or scrape URL." },
      { status: 500 }
    );
  }
}
