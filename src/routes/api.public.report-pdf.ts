import { createFileRoute } from "@tanstack/react-router";
import { buildReportPdfArrayBuffer } from "@/lib/report-pdf.server";

export const Route = createFileRoute("/api/public/report-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          const body = contentType.includes("application/json")
            ? ((await request.json()) as { html?: string; topic?: string })
            : await request.formData();
          const html = body instanceof FormData ? String(body.get("html") ?? "") : body.html ?? "";
          const topic = body instanceof FormData ? String(body.get("topic") ?? "") : body.topic ?? "";

          if (!html) {
            return Response.json({ error: "Missing report HTML" }, { status: 400 });
          }

          const { bytes, filename } = buildReportPdfArrayBuffer(html, topic || "orion-report");

          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `inline; filename=\"${filename}\"`,
              "Cache-Control": "no-store",
            },
          });
        } catch {
          return Response.json({ error: "Failed to generate PDF" }, { status: 500 });
        }
      },
    },
  },
});