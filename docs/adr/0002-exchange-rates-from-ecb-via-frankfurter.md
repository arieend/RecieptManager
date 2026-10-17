# Exchange rates come from ECB reference rates through Frankfurter

A USD or EUR Session's suggested rate to ILS is the European Central Bank's reference rate for the receipt's date, fetched from Frankfurter (`api.frankfurter.dev`; `api.frankfurter.app` redirects there). Before this, the rate was Gemini's guess at the "current" rate (the receipt parser's `exchange_rate_to_ils`, and `getExchangeRate` when the currency changed), which is neither from the receipt nor for its date. The Bank of Israel's representative rate (שער יציג) is the official Israeli rate and has a public SDMX API. But that API sends no CORS headers, and this app has no server, so using it would mean building and running a proxy. Frankfurter needs no key, allows browser requests, takes a date and falls back to the last business day. ECB and Bank of Israel rates differ by well under 1% (3.1268 vs 3.147 for USD on 13 March 2026), so a later move to the Bank of Israel would only change the Rate lookup's adapter.

## Consequences

- Gemini no longer supplies exchange rates. The receipt parser's `exchange_rate_to_ils` and the Gemini-based `getExchangeRate` go away.
- A looked-up rate is still an Unconfirmed rate: a wrong receipt date gives a confidently wrong rate, and the review step is where the user catches that.
- When the lookup fails, the rate stays unknown. The Fallback rate is not filled in as a suggestion.
