import { jsPDF } from "jspdf";
import { safeFilename, sanitizeReportHtml } from "@/lib/report-pdf.shared";

export function buildReportPdfArrayBuffer(html: string, topic: string) {
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

  const textContent = sanitizeReportHtml(html)
    .replace(/<\/(p|h1|h2|h3|h4|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of textContent) {
    writeLines(line, 11);
    y += 2;
  }

  return {
    bytes: pdf.output("arraybuffer"),
    filename: `${safeFilename(topic)}.pdf`,
  };
}