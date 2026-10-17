# Coding Standards

Judgement calls a reviewer applies to a diff. Apply every rule to every diff, and cite the rule by its heading in each finding. Lint and CI own the mechanical rules; this file holds only what needs a reader.

## Docs move with ownership

A change that moves which module owns a step updates, in the same PR:

- the step's line in the **Data Flow** section of [`DEVELOPMENT.md`](DEVELOPMENT.md), which names each step's owning module, and
- the matching term in [`GLOSSARY.md`](GLOSSARY.md).

Look for the trigger in the code, not the docs: a call moving from a component into a service, a new `services/` module taking over work, a responsibility leaving `App.tsx`. Then read both docs as they stand after the diff and check they name the new owner.

_Why:_ when `services/receiptFiling.ts` took over save from `App.tsx`, the Data Flow section still described `App.tsx` doing the work, and the review caught it only by chance.

## Tests go red when their rule breaks

A test names a rule. Break that rule in the code under test, and the test must go red. Check each new or changed test by imagining that break: if the test still passes, it is vacuous.

The common shape: a fake that never produces the value the assertion is about. The test then passes for the fake's sake, not the code's. The fix is to make the fake produce the value, so the assertion has something to reject.

_Why:_ a "reports no spreadsheet ID" test for Receipt filing passed because its fake sync never returned a spreadsheet ID at all; the code could have leaked one and the test would have stayed green.

## Tests read a structure through its definition

When code under test produces a structure whose shape another module defines (sheet columns, a row, a stored document), the test reads the result through that definition: by header or by key, not by position. A positional list in a test is a second copy of the definition, and it agrees with the code even when both are wrong.

Look for `toEqual([...])` or `arrayContaining([...])` over a row or tuple whose order is defined somewhere else, and ask whether the assertion would notice a value landing under the wrong name.

_Why:_ the Sheets row test checked `'Tag1', 'Person 1'` by position, so person names written under the "Labels" header passed until an architecture review read the header list next to the row.
