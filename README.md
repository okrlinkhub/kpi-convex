# @okrlinkhub/kpi-convex

Convex Component single-source per cataloghi KPI firmati `sync-indicators.catalog/v5`. R2 è la fonte autorevole del catalogo, ClickHouse dei valori e Convex mantiene il read model operativo: catalogo verificato, ultimi punti, preferiti, viste e preferenze utente.

## Autonomia e confini

`kpi-convex` non dipende dal backend, dal deployment o dai dati applicativi di KPI View. Ogni installazione possiede configurazione, credenziali, tabelle Convex, catalogo R2, proiezioni ClickHouse e callback `values-ready` propri.

KPI View è soltanto un consumer di `@okrlinkhub/kpi-convex/react` e `@okrlinkhub/kpi-convex/contracts`, mantenendo il proprio backend multi-tenant. Lo stesso vale per qualsiasi altra applicazione host.

L'entry point `/contracts` è il contratto pubblico canonico per parser, firme e tipi v5. Il producer del catalogo deve consumare questo entry point e non il contrario: il componente non importa né chiama `sync-indicators`. La stringa wire `sync-indicators.catalog/v5` viene conservata per compatibilità con i cataloghi firmati già pubblicati; è un identificatore di protocollo, non una dipendenza software o runtime.

## Installazione

```bash
pnpm add @okrlinkhub/kpi-convex
```

Il package espone:

- `@okrlinkhub/kpi-convex/convex.config`: componente Convex;
- `@okrlinkhub/kpi-convex/contracts`: contratto v5, parser, firme e query builder;
- `@okrlinkhub/kpi-convex/server`: factory dei wrapper autorizzati dell'app host;
- `@okrlinkhub/kpi-convex/react`: componenti e binding React;
- `@okrlinkhub/kpi-convex/styles.css`: tema a variabili CSS;
- `@okrlinkhub/kpi-convex/test`: registrazione per `convex-test`.

I wrapper `/server` ricevono callback host con un contesto discriminato. In questo modo
l'autorizzazione può leggere il database dell'app nelle query e mutation oppure chiamare
funzioni host da un'action, senza cast e senza duplicare i wrapper:

```ts
const api = exposeKpiApi(components.kpiConvex, {
  authorize: async ({ kind, ctx }, operation) => {
    if (kind === "action") await authorizeAction(ctx, operation);
    else await authorizeFromDatabase(ctx, operation);
  },
  viewerKey: async ({ ctx }) => deriveViewerKey(await ctx.auth.getUserIdentity()),
});
```

`viewerKey` viene richiesto solo da query e mutation; le action non ricevono accesso diretto
al database, in linea con i contesti Convex.

## UI condivisa

`/react` contiene la base visuale estratta da KPI View `main`, senza dipendenze da Next.js, WorkOS o da un router specifico:

- `KpiCatalogWorkspace`, tabella/card, ricerca, dominio, ordinamento, viste salvate e paginazione;
- `KpiDetail` e `KpiChart`, con riepilogo, range, linea/barre/area/tabella e fallback della proiezione;
- `DashboardHome`, `DashboardBoard`, picker, preferiti condivisi e widget riordinabili;
- `createKpiReactBindings`, che collega catalogo, dettaglio e dashboard ai wrapper Convex dell'host;
- slot `headerAction` sul catalogo collegato, per controlli host autorizzati come `requestRefresh` senza duplicare l'header;
- tipi e callback `getKpiHref`, `onOpenKpi`, `getDashboardHref` e `onOpenDashboard` per lasciare routing e navigazione all'applicazione.

La UI funziona sia in Next.js sia in Vite. L'host importa una volta il foglio di stile e decide come navigare:

```tsx
import { KpiCatalogWorkspace } from "@okrlinkhub/kpi-convex/react";
import "@okrlinkhub/kpi-convex/styles.css";

<KpiCatalogWorkspace
  items={items}
  state={state}
  domains={domains}
  page={1}
  pageCount={1}
  total={items.length}
  getKpiHref={(key) => `/kpi/${encodeURIComponent(key)}`}
  onStateChange={setState}
  onPageChange={setPage}
/>
```

Header globale, autenticazione e layout esterno restano responsabilità dell'host. Colori, raggi e grafici sono personalizzabili sovrascrivendo le variabili `--kpi-*`; struttura, stati e comportamento di base rimangono condivisi.

I binding espongono anche `KpiUi.DashboardHome` e `KpiUi.DashboardBoard`. Le dashboard,
i widget, l'ordine, la modalità grafico e i preferiti sono persistiti nelle tabelle isolate
del componente. Le letture sono condivise fra gli utenti autorizzati dell'app; solo il
viewer che ha creato una dashboard può modificarne struttura e widget. Il componente
continua a memorizzare soltanto `viewerKey` opachi e non restituisce identità o PII.

Vedi [`example/convex/convex.config.ts`](./example/convex/convex.config.ts) per il montaggio completo. L'HTTP action `POST /kpi/values-ready` riceve un body JSON con `eventId`, `sourceRunId`, `releaseVersion` e `timestamp`, firmato in esadecimale con HMAC-SHA256 nell'header `x-kpi-signature`.

## Sicurezza e configurazione

Tutte le credenziali sono environment variables Convex e non vengono mai restituite dalle API. Il componente richiede HTTPS, limita database e identificatori alle definizioni firmate del catalogo, usa parametri ClickHouse per tutti i valori e applica limiti di tempo, lettura e risultato. Il preflight esegue `EXPLAIN indexes = 1` e rifiuta una release senza una condizione `PrimaryKey` utile.

Variabili richieste:

```text
KPI_CONVEX_R2_ENDPOINT
KPI_CONVEX_R2_BUCKET
KPI_CONVEX_R2_ACCESS_KEY_ID
KPI_CONVEX_R2_SECRET_ACCESS_KEY
KPI_CONVEX_CATALOG_OBJECT_KEY
KPI_CONVEX_SOURCE_KEY
KPI_CONVEX_RELEASE_PUBLIC_KEYS_JSON
KPI_CONVEX_SOURCE_PUBLIC_KEYS_JSON
KPI_CONVEX_CLICKHOUSE_URL
KPI_CONVEX_CLICKHOUSE_DATABASE
KPI_CONVEX_CLICKHOUSE_USERNAME
KPI_CONVEX_CLICKHOUSE_PASSWORD
KPI_CONVEX_VALUES_READY_HMAC_SECRET
```

`KPI_CONVEX_SOURCE_KEY` identifica l'unica sorgente firmata che l'installazione può
importare dal target R2. Il refresh fallisce in modo esplicito se la sorgente non esiste o
non è univoca: le altre sorgenti del target aggregato non vengono lette, persistite o
esposte dalla UI.

Opzionali: `KPI_CONVEX_CATALOG_PREFIX`, `KPI_CONVEX_SCOPE_VALUE`, `KPI_CONVEX_PROJECTED_POINTS` (default 12, massimo 120). L'host example usa anche `KPI_CONVEX_VIEWER_KEY_SALT` per derivare un `viewerKey` non PII.

L'utente ClickHouse deve essere dedicato e read-only (`readonly=2`). Lo schema atteso deve seguire i filtri delle query:

```sql
ORDER BY (indicator_key, time_column)
-- oppure, con scope fisso
ORDER BY (scope_column, indicator_key, time_column)
```

## Flusso dati

1. Il cron orario legge il pointer R2; fingerprint invariato significa nessuna query ClickHouse.
2. Una release nuova viene verificata integralmente e importata come candidate.
3. Dagster invia `values-ready` dopo ingest e dbt riusciti.
4. Batch concorrenti di quattro KPI materializzano gli ultimi punti in una nuova generazione.
5. Una mutation attiva la generazione completa e conserva la precedente; ogni errore lascia attiva l'ultima valida.
6. Catalogo e dashboard leggono Convex; solo il dettaglio usa la action live ClickHouse, massimo 730 giorni e 500 righe.

## Sviluppo

```bash
pnpm install
pnpm build:codegen
pnpm test
pnpm lint
pnpm typecheck
pnpm exec convex dev --once --typecheck-components
```

Con una dipendenza consumer `file:`, npm copia il pacchetto invece di collegarlo in modo
live. Dopo una modifica eseguire `pnpm build:codegen` nel package e reinstallare la dipendenza
nel consumer. Non copiare soltanto `dist`: Convex compila l'implementazione del componente da
`src`, quindi `src` e `dist` devono provenire dalla stessa build.

Il componente usa esclusivamente Web APIs compatibili con Convex Components: SigV4 per R2 tramite `aws4fetch`, HTTP parametrizzato per ClickHouse e primitive crittografiche portabili per SHA-256/Ed25519.
