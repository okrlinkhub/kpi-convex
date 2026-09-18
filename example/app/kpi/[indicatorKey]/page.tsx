import { ExampleDetail } from "../../kpi-catalog";

export default async function KpiPage({ params }: { params: Promise<{ indicatorKey: string }> }) {
  const { indicatorKey } = await params;
  return <main className="example-shell"><ExampleDetail indicatorKey={decodeURIComponent(indicatorKey)} /></main>;
}
