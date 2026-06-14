import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase as _supabase } from "@/lib/supabase-browser";
import { buildReportPdfBlob, downloadBlob, safeFilename } from "@/lib/report-pdf.client";

const supabase = _supabase as unknown as { from: (table: string) => any };

export const Route = createFileRoute("/_authenticated/report-download/$sid")({
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

    const { data, error: fetchError } = await supabase
      .from("research_sessions")
      .select("topic, report_html")
      .eq("id", sid)
      .maybeSingle();

    if (fetchError || !data?.report_html) {
      setStatus("Download unavailable");
      setError("We couldn't load this report for download.");
      return;
    }

    setRetryData({ html: data.report_html, topic: data.topic ?? `report-${sid}` });

    try {
      const blob = await buildReportPdfBlob(data.report_html, data.topic ?? `report-${sid}`);
      downloadBlob(blob, `${safeFilename(data.topic ?? `report-${sid}`)}.pdf`);
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
              buildReportPdfBlob(retryData.html, retryData.topic)
                .then((blob) => {
                  downloadBlob(blob, `${safeFilename(retryData.topic)}.pdf`);
                  setError(null);
                  setStatus("Your PDF download should begin automatically.");
                })
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