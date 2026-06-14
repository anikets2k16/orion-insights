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