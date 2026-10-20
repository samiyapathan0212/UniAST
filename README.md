# UniAST

UniAST (Universal Smartphone-Calibrated Kinetic Antimicrobial Susceptibility Assessment) is a final-year research software prototype. It is not a diagnostic tool and does not provide clinically validated antimicrobial susceptibility results.

## Implemented

- React, TypeScript and Vite interface with overview, demo dashboard, image workspace, calibration workspace, kinetic analysis, research workflow and saved-session pages.
- Local PNG, JPEG and WebP image decoding; rectangular ROI selection in original image pixels; mean RGB, Rec.709 luminance, sample standard deviation, range and bounded resampling for large regions.
- Per-channel affine least-squares calibration from user-entered reference patches. Fit and held-out validation patches are kept separate and their residuals are labelled distinctly.
- Local ColorChecker calibration benchmark that accepts a selected image folder plus a user-authored `manifest.json` containing reference provenance, patch ROIs, capture settings, and image-level fit/validation splits. It reports raw and calibrated RGB code-value RMSE separately and exports reproducible per-image CSV results.
- Image-sequence analysis, CSV import and validation, descriptive time-series metrics and CSV export. Duplicate times remain visible with unavailable adjacent rates; normalized change is unavailable for a zero baseline.
- Local FastAPI + SQLModel + SQLite persistence for research-session metadata and explicitly saved image, calibration, and kinetic-analysis records. Saved sessions and analysis records are separate from simulated dashboard data.

Image processing and scientific calculations still run in the browser. Original images and CSV files are never uploaded or stored by the backend. When the user explicitly saves, UniAST persists source metadata, ROI and derived measurements, calibration patches/model/error summaries, or kinetic observations/derivations. These records describe prototype calculations; they are not laboratory or clinical validation. Dashboard charts, summary values and example experiment rows remain simulated demo content and are not measurements or performance claims.

The benchmark does not bundle ColorChecker images or reference colours. A dataset is only scored when the user supplies a manifest with a cited reference source, sRGB/8-bit encoding details, illuminant/observer, annotated integer pixel ROIs, and distinct fit and held-out image roles. The browser checks the declared structure, but it cannot authenticate reference provenance or automatically confirm that each ROI covers the named patch. Benchmark RMSE is measured in 8-bit sRGB code-value units, not perceptual ΔE; it does not establish clinical or antimicrobial susceptibility performance.

For the benchmark page, select a local folder with a root-level `manifest.json` and image files at the manifest's relative paths. The manifest fields are `datasetId`; `reference` (`standard`, `source`, `colorSpace: "sRGB"`, `encoding: "8-bit"`, `illuminant`, `observer`); `patchMeasurement` (`method`, `notes`); non-empty string maps `calibrationSettings`; `limitations` (string array); and `images`. Each image entry has a unique `imageId`, relative `file`, `role` (`fit` or `validation`), non-empty string-map `captureSettings`, and `patches`. Each patch has a consistent unique `patchId`, integer `roi` (`x`, `y`, `width`, `height`) in original-image pixels, and sourced `referenceRgb` (`r`, `g`, `b`, each 0–255). All images need the same patch IDs and reference values. At least one fit image and one separate validation image are required; patch ROIs must be inside their image and small enough for exact non-resampled sampling. Calibration parameters and per-image settings are included in CSV output.

### Imai ColorChecker sample-scene dataset

The extracted `SampleScenesWithColorChecker` collection can be selected directly in the benchmark folder picker; its images do not need to be copied into this project. The inspected folder contains 43 scene JPEGs, but no benchmark manifest, patch ROIs, or reference-RGB table. The dataset record describes the archive as sample scenes with ColorChecker targets and links the related paper, *Automatic Color Reference Target Detection* ([dataset DOI](https://doi.org/10.18710/K7ZFM5), [paper DOI](https://doi.org/10.2352/CIC.2014.22.1.art00020)). A visible chart in a scene is not sufficient to establish a reliable patch measurement: the current benchmark requires user-annotated interior ROIs and does not perform automatic chart/patch detection. Obtain and cite compatible reference values and verify each ROI against the original image before creating results. Do not infer references from the scene images or treat benchmark output as clinical or antimicrobial-susceptibility accuracy.

## Requirements

- Node.js 20.19 or newer, or Node.js 22.12 or newer, and npm (Vite 8 requirement).
- Python 3.11 or newer.

## Windows setup

Run these commands from the project root in PowerShell:

```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install --upgrade pip
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Start the backend in one PowerShell window:

```powershell
.\backend\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini upgrade head
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

The SQLite database is stored at `backend/data/uniast.sqlite3`. It is local and excluded from Git. The API documentation is available at `http://127.0.0.1:8000/docs` while the backend is running. The application no longer calls `SQLModel.metadata.create_all()` at startup: apply Alembic migrations explicitly before starting it.

### Database schema migrations

Alembic's environment loads the existing SQLModel metadata from `backend/app/models.py`. The checked-in baseline migration creates all four current tables, their session foreign keys and indexes. For a new database, run `alembic upgrade head` as shown above; this creates the SQLite file and current schema. Before starting the app after any future schema update, run the same upgrade command.

For a new, empty database, `alembic upgrade head` creates the current schema. For an existing database already stamped at the current revision, the same command applies only any later pending migrations. **Do not run `alembic upgrade head` against an existing unversioned database whose tables already exist:** the baseline migration would conflict. First stop the backend and make a separate verified backup. Only if you have confirmed that the existing schema exactly matches the checked-in baseline, stamp that database at the baseline revision (this records the revision without creating or dropping application tables):

```powershell
$backupPath = "backend\data\uniast-before-alembic-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite3"
Copy-Item backend\data\uniast.sqlite3 $backupPath
Get-FileHash backend\data\uniast.sqlite3, $backupPath
# Confirm both hashes match and retain the backup before proceeding.
.\backend\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini stamp head
.\backend\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini current
# Future schema changes are then applied with:
.\backend\.venv\Scripts\python.exe -m alembic -c backend\alembic.ini upgrade head
```

The `stamp` command must only be used when the database schema has been confirmed to match the baseline. For migration commands targeting a database copy, set `UNIAST_DATABASE_URL`, for example `$env:UNIAST_DATABASE_URL = 'sqlite:///C:/path/to/copy.sqlite3'`. This variable is read by Alembic only; the FastAPI app itself uses `backend/data/uniast.sqlite3`. `VITE_API_BASE_URL` is the only frontend environment variable and changes the API base URL; no `.env` file is required for the default local setup.

Start the frontend in a second PowerShell window:

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Open the URL printed by Vite. The frontend defaults to `http://127.0.0.1:8000/api/v1`; set `VITE_API_BASE_URL` only if using a different local API URL. If the backend is stopped, image analysis and CSV import/export remain browser-local; session save/load shows a connection error.

## Session API

All routes use the `/api/v1` prefix. Names are trimmed and required; names, device descriptions, notes and pagination are bounded. Personal identifiers are not required. CORS is limited to the local Vite origins `localhost:5173` and `127.0.0.1:5173`. The development server binds to loopback and has no authentication; do not expose it to a network.

- `POST /sessions` — create a session; returns `201` and the stored record.
- `GET /sessions?limit=50&offset=0` — list newest sessions first; `limit` is 1–100 and `offset` is 0–100000. Returns `items`, `limit`, `offset` and `total`.
- `GET /sessions/{session_id}` — retrieve a session by UUID; returns `404` when not found.
- `POST /sessions/{session_id}/image-analyses` — save image source metadata (filename, MIME type, byte size and dimensions), ROI coordinates, RGB/luminance statistics, pixel sample count, resampling flag and method version.
- `GET /sessions/{session_id}/image-analyses?limit=50&offset=0` — list analysis IDs and method versions; pagination is bounded to 1–100 rows. `GET /sessions/{session_id}/image-analyses/{record_id}` retrieves a complete record.
- `POST /sessions/{session_id}/calibrations` — save source metadata, measured and reference RGB patches with explicit `fit` or `validation` roles, fitted per-channel model coefficients and separate fit/validation error summaries. The API validates role counts against the summaries and fit model.
- `GET /sessions/{session_id}/calibrations?limit=50&offset=0` — list records; `GET /sessions/{session_id}/calibrations/{record_id}` retrieves a complete record.
- `POST /sessions/{session_id}/kinetic-analyses` — save source type (`images` or `csv`), raw/calibrated/mixed selection, ordered time-series observations, baseline changes, rates, normalized changes, issues/warnings and method version.
- `GET /sessions/{session_id}/kinetic-analyses?limit=50&offset=0` — list records; `GET /sessions/{session_id}/kinetic-analyses/{record_id}` retrieves a complete record.

Analysis list responses use `{ "items": [...], "limit": 50, "offset": 0, "total": 1 }`. Unknown sessions and record IDs return `404`; records are always retrieved within their parent session. Analysis create requests validate dimensions, numeric ranges, field lengths and bounded patch/observation counts. Unknown JSON fields are rejected, and request bodies are capped at 5 MiB. A kinetic baseline must match the first time-ordered observation. Calibration summaries must remain separate: the fit count corresponds only to `fit` patches, and validation count only to held-out `validation` patches.

Example image-analysis request:

```json
{
  "sourceMetadata": { "fileName": "panel.png", "mimeType": "image/png", "fileSize": 2048, "width": 640, "height": 480 },
  "roi": { "x": 20, "y": 30, "width": 120, "height": 90 },
  "statistics": { "samples": 10800, "resampled": false, "meanR": 120, "meanG": 110, "meanB": 100, "meanLuminance": 111.4, "luminanceStdDev": 3.2, "minLuminance": 102, "maxLuminance": 120 },
  "methodVersion": "roi-rec709-v1"
}
```

Calibration requests contain `sourceMetadata`, a `patches` array (`patchId`, `roi`, measured RGB statistics, reference RGB, `standard`, and `role`), the fitted `model`, separate nullable `fitErrorSummary` and `validationErrorSummary`, and `methodVersion`. Kinetic requests contain `sourceType`, `calibrationChoice`, derived `observations`, `baselineLuminance`, `issues`, `warnings`, and `methodVersion`. Observation fields retain elapsed time, source filename/row label, RGB/luminance, ROI when known, resampling/calibration flags, warnings, baseline delta, rate and normalized change.

Nested analysis structures (patch arrays, model coefficients, summaries, observations and issues) are stored in SQLite `JSON` columns. This keeps each typed record in a dedicated indexed relational table linked to its session by a foreign key, while preserving nested structures without hand-encoded JSON strings. SQLAlchemy handles JSON encoding/decoding. SQLite foreign-key enforcement is enabled. Original file bytes and file contents are not stored; filenames and image dimensions are metadata only. Records can be retrieved after refresh, but the original image or CSV must be reselected locally to repeat processing.

PowerShell example:

```powershell
$session = Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:8000/api/v1/sessions" `
  -ContentType "application/json" `
  -Body (@{ name = "Panel run"; device = "Pixel 8"; notes = "Initial research observations" } | ConvertTo-Json)

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/sessions?limit=50&offset=0"
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/sessions/$($session.id)"
```

## Tests and production build

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend\tests
npm test
npm run build
npm run preview
```

Backend tests use temporary SQLite databases. Migration tests cover fresh `upgrade head` and a copied unversioned SQLModel schema that is stamped and upgraded while preserving a stored session; they do not touch `backend/data/uniast.sqlite3`. Frontend tests use Node's built-in test runner and deterministic examples for calibration fitting, residuals, ROI geometry/statistics boundaries, kinetic derivation, CSV parsing/export, zero baselines and duplicate timestamps.

## Methodology

For each sampled pixel, luminance is calculated from 8-bit channel values as `Y = 0.2126R + 0.7152G + 0.0722B`. ROI means are arithmetic means; luminance dispersion is sample standard deviation (`n − 1`). Large regions are downsampled in a scratch canvas to cap synchronous pixel processing.

Calibration fits `reference = slope × measured + intercept` independently for R, G and B using ordinary least squares. Applying a fit clamps each corrected channel to `[0, 255]` and indicates clipping. Fit-set residuals describe training fit only. Independent validation is meaningful only for complete patches explicitly assigned the held-out role; these patches do not enter the fit.

The optional ColorChecker benchmark uses the same affine method, fitting only images marked `fit`. Complete images marked `validation` are excluded from fitting and scored separately. Its reported RGB RMSE is `sqrt(sum((measured channel − reference channel)²) / (3 × number of patches))`, pooled over R, G and B and expressed in 8-bit sRGB code values (0–255). Each result row records dataset and image IDs, split, patch count, reference provenance, image and calibration settings, method version, and limitations. This is a code-value error metric, not a perceptual colour-difference measure. The manifest must provide values obtained from an appropriate reference source; UniAST does not infer or fabricate ground truth.

Kinetic analysis sorts valid observations by elapsed minutes. Change is relative to the first observation, rate is the adjacent luminance difference divided by the positive time gap, and normalized change is unavailable when baseline luminance is zero. These are descriptive optical statistics only; a rate is not a bacterial growth rate.

CSV requires `time_min`, `mean_r`, `mean_g`, `mean_b` and `mean_luminance`. Optional fields are `source`, `roi` (`x;y;width;height`), `calibrated`, `resampled` and `warnings`. UniAST export comment lines are skipped when importing; blank or invalid required values are rejected, and luminance must agree with the Rec.709 calculation within rounding tolerance. CSV records are line-based; quoted fields may contain commas and escaped quotes, but embedded newlines inside a quoted field are not supported.

## Limitations and future work

- Session and analysis-result metadata persist only in the local SQLite database. Original images and CSV files remain browser-local and are not recoverable from saved analysis records. There is no authentication, cloud storage, multi-user access, backup, or delete/edit interface yet.
- Analysis calculations run in the browser. The API validates and stores submitted results but does not independently rerun or scientifically verify the calculations; method-version labels identify the frontend method and do not certify reproducibility or accuracy.
- Calibration values are user-entered; no certified reference material, controlled capture protocol, device study or independent laboratory validation is supplied.
- Camera processing, exposure, white balance, illumination, compression, reflections, focus and region selection can affect measured pixel values. Canvas downsampling also makes large-ROI measurements approximate.
- The UI's simulated dashboard values are illustrative only. They must not be interpreted as device accuracy, diagnostic performance, antimicrobial susceptibility, resistance or clinical evidence.
