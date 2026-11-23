# Test Results

Date: 2026-11-18

## Automated and verification checks

| Test or script | Result | Evidence |
| --- | --- | --- |
| `npm test` | PASS | Isolated PostgreSQL database; 21 Vitest/Supertest tests passed |
| Validation cases | PASS | Bad phone, invalid purpose, office/service mismatch, future date, and honeypot returned 400 |
| Role matrix | PASS | Anonymous/front_desk/reviewer/administrator statuses verified for dashboard, forecast, CSM summary, exports, visitors, admin, and import |
| Audit privacy | PASS | Create, edit, void, import, and export rows written; no contact numbers or passwords in details |
| Dashboard independent SQL check | PASS | Month-end included; independent comparison passed for October 2026 |
| Import duplicate protection | PASS | Existing and same-file duplicates skipped and reported as `duplicate` |
| Deactivated cookie rejection | PASS | Deactivated user's old cookie returned 401 |
| Export privacy | PASS | CSV positive control passed; names, phone numbers, and formula prefixes were absent or neutralized |
| `verify-forecast.js` | PASS | Hand-computed model and zero-actual MAPE checks passed |
| `verify-dashboard.js` | PASS | November: 30/17/13; October: 42/26/15; September: 50/20/27 |
| `verify-export.js` | PASS | Reviewer 200, front desk 403, anonymous 401, PDF extraction and privacy checks passed |
| `npm audit --omit=dev` | PASS | 0 production vulnerabilities |
| Full `npm audit` | FAIL/known limitation | 6 high-severity development-toolchain findings through `picomatch`; automatic fix requires a breaking Vite downgrade |
| Headless Chrome runtime checks | PASS | `/`, `/survey`, `/login`, `/admin`, `/dashboard`, `/visitors`; no runtime alerts |
| 360px responsive checks | PASS | No horizontal overflow; `scrollWidth` matched viewport width on checked pages |
| Client build | PASS | `npm run build`; existing Vite chunk-size warning only |

## Forecast metrics

Metrics were collected from the seeded development data using the existing
holdout model:

| Granularity | Model MAE | Model MAPE | Naive MAE | Naive MAPE |
| --- | ---: | ---: | ---: | ---: |
| Week | 2.8936 | 21.4486% | 2.7500 | 24.8529% |
| Month | 10.8333 | 33.7302% | 14.0000 | 42.8571% |

## Dashboard accuracy

The dashboard summary API matched an independent SQL aggregation for three
months, including the final day of each month. The automated boundary test also
inserted a visitor on 2026-10-31 and confirmed it was included.

## Known limitations

- The full dependency audit remains blocked by development-only `picomatch`
  advisories in the current Vite/Vitest toolchain; resolving them requires a
  breaking dependency change.
- Browser checks use seeded synthetic data and validate rendered content,
  runtime alert absence, and viewport overflow rather than visual pixel diffs.
- Forecast accuracy depends on available history and the seeded dataset.
