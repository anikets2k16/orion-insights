import { createFileRoute } from "@tanstack/react-router";
import { buildReportPdfArrayBuffer } from "@/lib/report-pdf.server";

export const Route = createFileRoute("/api/public/report-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { html?: string; topic?: string };

          if (!body?.html) {
            return Response.json({ error: "Missing report HTML" }, { status: 400 });
          }

          const { bytes, filename } = buildReportPdfArrayBuffer(
            body.html,
            body.topic ?? "orion-report",
          );

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