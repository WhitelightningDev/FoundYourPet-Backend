# Tag fulfillment (admin)

Successful tag purchases are stored as `Payment` documents with `kind: "tag"` and `status: "successful"`.

## List orders to fulfill

`GET /api/payment/admin/tag-orders`

Query params:
- `fulfillmentStatus` (optional): `unfulfilled | processing | submitted | shipped | delivered | cancelled`
  - If omitted, defaults to showing `unfulfilled`, `processing`, `submitted` (including older orders with no fulfillment set).
- `q` (optional): search against package/tag type + shipping fields
- `skip` (optional, default `0`)
- `limit` (optional, default `50`, max `100`)

Response includes:
- `purchasedAt` (from `processedAt`)
- `packageType` + `tagType`
- `amountInCents` + `currency`
- `shipping` address snapshot from time of checkout creation (falls back to current `user.address` if missing)
- `pets` included in the order (quantity = number of pets)
- `fulfillment` state + optional PUDO tracking fields

## Update fulfillment + tracking

`PATCH /api/payment/admin/tag-orders/:paymentId/fulfillment`

Body (all optional):
```json
{
  "status": "processing",
  "notes": "Packed and ready for collection",
  "pudoShipmentId": "…",
  "pudoTrackingNumber": "…",
  "pudoStatus": "…",
  "pudoLabelUrl": "…"
}
```

This does not create a PUDO shipment automatically yet; it stores the fulfillment state and any tracking/label data your admin dashboard (or a future PUDO integration) provides.

