# Payment form backend contract

## Project merchant ID

The deployed `project_table.merchant_id` column is nullable text. The payment
project Server Action applies a server-side allowlist before its result is
serialized in the Next.js RSC response. Each returned item has exactly this
shape:

```json
{
  "project_name": "City Clou",
  "project_id": 1,
  "merchant_id": "GTCC2026"
}
```

Projects without an assigned merchant ID return `"merchant_id": null`.

On submission, the payment server action fetches the selected active project's
authoritative `merchant_id` and compares it with the nullable value preserved
in form state. This rejects stale or modified associations, including an
omitted value for a project that has a merchant ID. A merchant ID must not be
derived from a project name or trusted without this server-side check.

There is currently no payment-provider request in this repository. The server
action stops at the documented payment-gateway boundary, so `merchantId` is not
forwarded to an external API. Before enabling merchant-based routing, the
Paynamics request contract must define the supported property name and routing
rules. The current mock values must not be used for live payment routing.

## Existing contact-number contract

The payment server action continues to receive Philippine mobile numbers in
the existing 11-digit local format (`09XXXXXXXXX`). The UI displays a fixed
`+63` prefix, stores the 10-digit subscriber portion, and converts it to the
local format only at the server-action boundary. If a future payment provider
requires E.164, that conversion should be made at its integration boundary.
