import { getAllMovies, getAllScreenings, getAllTheaters, getLastIngestedAt, getLastIngestionResults, getLastValidationWarnings } from "@/lib/repository";
import { getAllProviderStatuses } from "@/lib/providerStatus";
import { enrichScreeningsClient } from "@/lib/enrichClient";
import { AdminImportClient } from "@/components/admin/AdminImportClient";
export const dynamic = "force-dynamic"; // live data: render every request

export default async function AdminImportPage() {
  const [movies, theaters, screenings] = await Promise.all([getAllMovies(), getAllTheaters(), getAllScreenings()]);

  const statuses = getAllProviderStatuses();
  const results = getLastIngestionResults();
  const warnings = getLastValidationWarnings();
  const lastIngestedAt = getLastIngestedAt();

  const preview = enrichScreeningsClient(screenings.slice(0, 25), movies, theaters);

  return (
    <AdminImportClient
      statuses={statuses}
      results={results}
      warnings={warnings}
      lastIngestedAt={lastIngestedAt}
      preview={preview}
      totals={{ movies: movies.length, theaters: theaters.length, screenings: screenings.length }}
    />
  );
}
