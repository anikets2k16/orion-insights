import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export const Route = createFileRoute("/report-download/$sid")({
  ssr: false,
  component: ReportDownloadPage,
});

function ReportDownloadPage() {
  const { sid } = Route.useParams();
  const [status, setStatus] = useState("Preparing your PDF…");
  const [error, setError] = useState<string | null>(null);
  const [retryData, setRetryData] = useState<{ html: string; topic: string } | null>(null);

  async function startDownload() {
    setError(null);
    setStatus("Preparing your PDF…");

    const raw = window.localStorage.getItem(`orion.report-download.${sid}`);
    if (!raw) {
      setStatus("Download unavailable");
      setError("We couldn't load this report for download.");
      return;
    }

    try {
      const payload = JSON.parse(raw) as { html?: string; topic?: string; savedAt?: number };
      if (!payload.html) {
        setStatus("Download unavailable");
        setError("We couldn't load this report for download.");
        return;
      }

      const topic = payload.topic ?? `report-${sid}`;
      setRetryData({ html: payload.html, topic });

      const { buildReportPdfBlob, downloadBlob, safeFilename } = await import("@/lib/report-pdf.client");
      const blob = await buildReportPdfBlob(payload.html, topic);
      downloadBlob(blob, `${safeFilename(topic)}.pdf`);
      setStatus("Your PDF download should begin automatically.");
    } catch {
      setStatus("Download failed");
      setError("We couldn't generate the PDF in this tab.");
    }
  }

  useEffect(() => {
    void startDownload();
  }, [sid]);

  return (
    <main>
      <section className="orion-card">
        <h1 className="orion-grad">Download report</h1>
        <p className="orion-muted">{status}</p>
        {error && <p style={{ marginTop: 12, color: "#ff7a90" }}>{error}</p>}
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <button
            className="orion-btn-primary"
            onClick={() => {
              if (!retryData) {
                void startDownload();
                return;
              }
              import("@/lib/report-pdf.client")
                .then(({ buildReportPdfBlob, downloadBlob, safeFilename }) =>
                  buildReportPdfBlob(retryData.html, retryData.topic).then((blob) => {
                    downloadBlob(blob, `${safeFilename(retryData.topic)}.pdf`);
                    setError(null);
                    setStatus("Your PDF download should begin automatically.");
                  }),
                )
                .catch(() => {
                  setStatus("Download failed");
                  setError("We couldn't generate the PDF in this tab.");
                });
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Download size={14} /> Download PDF
          </button>
          <Link to="/history" className="orion-btn-secondary" style={{ textDecoration: "none" }}>
            Back to history
          </Link>
        </div>
      </section>
    </main>
  );
}