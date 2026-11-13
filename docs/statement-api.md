# Statement PDF API

`POST /api/v1/statement-files` accepts one multipart `file` containing an original PDF (at most 12 MB). Send an API key with write scope in `Authorization: Bearer ...` and select its workspace with `X-Workspace-Id`.

The response contains `id`, `filename`, `contentType`, `size`, `sha256` and `duplicate`. Repeating the same bytes in the same workspace returns the existing file ID, including after a lost response. Other workspaces have separate originals. Requests use the existing API key permission, plan and rate-limit checks.

Pass the returned ID in `attachmentFileIds` when calling `POST /api/v1/transactions`. Use a stable `externalId` and `status: "draft"` to import bank movements for review without posting to the ledger.
