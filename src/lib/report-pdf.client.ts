import { jsPDF } from "jspdf";

export function safeFilename(topic: string) {
  return (topic || "orion-report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "orion-report";
}

export function sanitizeReportHtml(html: string) {
  return html.replace(/<p><em>Confidence threshold[^<]*<\/em><\/p>/i, "").trim();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildReportPdfBlob(html: string, topic: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeLines = (text: string, size: number, bold = false) => {
    if (!text.trim()) return;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, maxWidth) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, margin, y);
      y += lineHeight;
    }
  };

  writeLines(topic, 20, true);
  y += 6;

  const doc = new DOMParser().parseFromString(`<root>${sanitizeReportHtml(html)}</root>`, "text/html");
  const root = doc.querySelector("root");
  const blocks = root ? Array.from(root.querySelectorAll("p, h1, h2, h3, h4, li")) : [];

  for (const el of blocks) {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    if (tag === "h1" || tag === "h2") {
      y += 8;
      writeLines(text, 15, true);
      y += 2;
    } else if (tag === "h3" || tag === "h4") {
      y += 6;
      writeLines(text, 13, true);
      y += 2;
    } else if (tag === "li") {
      writeLines(`• ${text}`, 11);
    } else {
      writeLines(text, 11);
      y += 2;
    }
  }

  return pdf.output("blob");
}