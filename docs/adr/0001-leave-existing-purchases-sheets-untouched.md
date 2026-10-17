# Leave existing Purchases sheets untouched

The Purchases sheet's headers have changed: "Labels" is now "Assigned To", and "Price (NIS)" is becoming "Amount (NIS)" once rows carry the Line amount instead of the unit price. Only a newly created spreadsheet gets the new headers. We never rewrite the header row of a sheet that already exists, even though its old header will then sit above rows whose meaning changed. The spreadsheet belongs to the user, who may have renamed, reordered or built formulas on those headers, and a silent rewrite of a file they own is worse than a stale label. Columns stay in the same positions, so old and new rows still line up.

## Consequences

- In an existing sheet, rows appended before the Money change hold the unit price under "Price (NIS)". Rows appended after it hold the Line amount under the same header. The CHANGELOG entry for that release says so.
- Rows already written are never corrected or migrated.
