import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import "@okrlinkhub/kpi-convex/styles.css";
import "./site.css";
import { Providers } from "./providers";
export default function Layout({ children }: { children: ReactNode }) { return <html lang="it"><body><header className="example-header"><div className="example-nav"><a className="example-brand" href="/"><span className="example-brand-mark"><BarChart3 size={18}/></span><span>KPI Convex</span></a><nav aria-label="Navigazione principale"><a href="/dashboards">Dashboard</a><a href="/">Catalogo</a></nav><span className="example-readonly">Example</span></div></header><Providers>{children}</Providers></body></html>; }
