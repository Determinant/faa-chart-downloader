# Proposed d-TPP procedure builder

Status: design for implementation; no builder exists yet

`faa-regs` should produce the authoritative, cycle-versioned FAA procedure feed used
by AWC Plus. It owns source discovery and parsing so downstream applications do not
independently interpret FAA d-TPP HTML/XML or infer current cycles.

## Source

Use the FAA digital Terminal Procedures Publication (d-TPP) current/next catalog and
XML metafile:

- <https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/>
- <https://aeronav.faa.gov/d-tpp/Metafile_XML_Definitions.pdf>

The root XML provides the cycle and effective interval. Retain the state, city,
volume, airport, and record hierarchy, including `apt_ident`, `icao_ident`, `alnum`,
`chartseq`, `chart_code`, `chart_name`, `useraction`, `pdf_name`, change-notice and
bound-volume fields, `procuid`, civil/military flags, amendment number, and amendment
date.

Unknown chart codes or new fields must survive normalization. Do not discard a record
because its code is not in the initial UI grouping table.

## Commands

Add a standalone builder:

```bash
npm run build:procedures
npm run build:procedures -- --airports=KPAO,KSNS,KSBP
npm run build:procedures -- --volumes=SW1,SW2
npm run build:procedures -- --all
npm run build:procedures -- --source-xml=/path/to/d-TPP_Metafile.xml
```

Default behavior downloads and validates metadata only. `--airports` and `--volumes`
download the selected documents; `--all` is the explicit full-mirror operation and
must print the discovered count/estimated size before transfer. `build:charts` should
invoke the metadata-only stage so the current chart build also publishes a procedure
catalog without unexpectedly downloading the entire d-TPP collection.

For a fully local/reproducible test, `--source-xml` plus an explicit local PDF source
directory performs no network access.

## Output

```text
dist/procedures/<cycle>/
├── catalog.json
├── manifest.json
└── pdf/
    └── <selected PDF files>
```

`catalog.json` contains normalized records keyed/grouped by both FAA and ICAO airport
identifiers. A record contains:

- stable record ID and schema version;
- FAA d-TPP cycle and effective instants;
- state, city, volume, airport identifiers/name/sort value;
- original FAA record fields and a normalized procedure kind;
- canonical source URL and local artifact ID;
- first-page or named-destination target; and
- optional validated zero-based page index.

`manifest.json` records the source catalog URL/SHA-256, generated time, record and
airport counts, selected scope, every downloaded document's byte length/SHA-256, and
builder/schema versions. Write into a staging directory and replace the cycle output
only after all required files and JSON schemas pass.

## Individual and shared documents

Individual airport diagrams, IAPs, DPs/ODPs, and STARs normally point at their own PDF
files. Shared takeoff, alternate, and radar-minimum PDFs use one asset for many
airports. FAA links to an airport with a named destination; for example:

```text
https://aeronav.faa.gov/d-tpp/2609/sw2to.pdf#nameddest=(PAO)
```

Store the artifact URL without the fragment and the exact named destination as a
separate target. Download/checksum a shared asset once. Validate the destination with
a PDF parser compatible with PDF.js semantics and optionally materialize its page
index. If resolution fails, mark that record invalid and report it; do not guess using
text extraction or page order.

## Initial normalized kinds

The first UI mapping covers:

- `APD`: airport diagram;
- `IAP`: instrument approach;
- `DP` and `ODP`: departure;
- `STAR`/`STR`: arrival;
- `MIN` section `C`: takeoff minima;
- `MIN` section `E`: alternate minima;
- `MIN` section `N`: radar minima; and
- every other code: other, with original fields intact.

This mapping is presentation metadata. It is not permission to omit unusual FAA
records.

## Current/next cycle handling

Publish current and next catalogs separately when the FAA exposes both. Stage the next
cycle early but do not relabel it current before its effective instant. Retain at least
the previous cycle subject to the same explicit storage policy used for chart/NASR
outputs. Never merge procedure records from two cycles under one revision.

## Initial tests

- Parse a small XML fixture containing KPAO, KSNS, and KSBP.
- Preserve all known source fields and one unknown chart code.
- Build one individual-PDF record and one shared-PDF record.
- Resolve `(PAO)` in the Southwest 2 takeoff-minimum PDF.
- Deduplicate a shared PDF referenced by multiple airports.
- Reject checksum mismatch, unresolved named destination, path traversal in
  `pdf_name`, mixed cycles, and incomplete staged output.
- Prove metadata-only and fully local builds make no unrequested network calls.
