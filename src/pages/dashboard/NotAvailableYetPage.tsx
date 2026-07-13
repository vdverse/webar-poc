/**
 * Honest placeholder for dashboard sections that belong to later batches.
 * Shows nothing fake — no mock jobs, no mock analytics.
 */
export default function NotAvailableYetPage({
  title,
  batch,
  description,
}: {
  title: string;
  batch: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="dash-page-title">{title}</h1>
      <div className="dash-empty">
        <p>Not available yet.</p>
        <p>
          {description} This arrives in {batch}.
        </p>
      </div>
    </div>
  );
}
