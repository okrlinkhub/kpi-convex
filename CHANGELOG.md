# Changelog

Tutte le modifiche rilevanti di questo progetto sono documentate qui.

## 0.1.1 - 2026-10-08

- Accetta nuovi valori su un catalogo verificato già attivo, preservando la deduplicazione dei callback.
- Verifica anche la versione della release target nel refresh, oltre al fingerprint della sorgente.
- Recupera il catalogo firmato quando un callback valido precede il polling periodico; release diverse dal puntatore verificato restano rifiutate.
- Preserva una candidata più recente quando termina una proiezione già in corso.

## 0.1.0 - 2026-09-19

- Prima release pubblica del componente Convex single-source per cataloghi KPI v5 firmati.
- Proiezioni Convex e dettaglio live ClickHouse con limiti e query parametrizzate.
- UI React condivisa e router-agnostic per catalogo, dettaglio e dashboard personalizzabili.
- Dashboard persistenti, preferiti, viste salvate e preferenze isolate tramite `viewerKey` opaco.
- Entry point pubblici per server, contratti, React, stile, test e configurazione Convex.
