# PayFast Recurring Billing (Monthly Subscriptions)

## URLs to configure in PayFast

- **Notify URL (ITN)**: `https://foundyourpet-backend.onrender.com/api/payfast/itn`
- **Return URL (frontend UX only)**: your frontend success page (does **not** activate subscription)
- **Cancel URL (frontend UX only)**: your frontend cancel page (does **not** cancel subscription)

Activation and renewals happen **only** via ITN.

## Required environment variables (backend)

Add these to Render environment variables (or `.env` for local):

```bash
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=              # optional
PAYFAST_MODE=sandbox             # "sandbox" or "live"
PAYFAST_IP_ALLOWLIST=            # optional, comma-separated IPs/CIDRs
PAYFAST_VALIDATE_WITH_SERVER=false  # optional, "true" enables PayFast server validation

SUBSCRIPTION_INITIAL_PRICE_ZAR=300
SUBSCRIPTION_RECURRING_PRICE_ZAR=50
# Back-compat (if SUBSCRIPTION_RECURRING_PRICE_ZAR is unset)
SUBSCRIPTION_MONTHLY_PRICE_ZAR=70
SUBSCRIPTION_GRACE_DAYS=3
PAYFAST_AMOUNT_TOLERANCE_CENTS=5     # optional
```

## Backend endpoints

- `POST /api/payfast/itn` (no auth): PayFast ITN callback
- `POST /api/subscriptions/checkout` (auth): creates a PayFast recurring checkout and returns `checkout_url`
- `GET /api/subscriptions/checkout/:token` (no auth): HTML auto-submit page (redirect browser here)
- `GET /api/subscriptions/me` (auth): returns subscription status for logged-in user
- `POST /api/subscriptions/cancel` (auth): marks cancel requested locally (`cancelAtPeriodEnd=true`)

## Linking an ITN to a user

The backend links a PayFast ITN to a user in this order:

1. `custom_str1` containing the userId (recommended)
2. A 24-hex Mongo ObjectId embedded anywhere in `m_payment_id`
3. `email_address` fallback (less reliable)

Recommended payload when creating the PayFast subscription/payment request:

- `custom_str1 = <userId>`
- `m_payment_id = sub_MONTHLY_<userId>_<timestamp>`

## Local testing

## Frontend integration (SPA)

1. Call `POST /api/subscriptions/checkout` with your user JWT (`Authorization: Bearer <token>`).
2. Build an HTML form with the returned `actionUrl` + `fields` and auto-submit it via `POST` to PayFast (recommended).
   - Fallback supported: redirect the browser to `checkout_url` (backend-served auto-submit page).
3. After PayFast redirects the user back to your frontend return/cancel page, poll `GET /api/subscriptions/me` until ITN activates the subscription.

## “Pay R300 now, then R50/month” (setup fee + recurring)

This backend sends these fields to PayFast when you call `POST /api/subscriptions/checkout`:

- `amount = SUBSCRIPTION_INITIAL_PRICE_ZAR` (e.g. `300.00`) — the upfront charge
- `subscription_type = 1`
- `recurring_amount = SUBSCRIPTION_RECURRING_PRICE_ZAR` (e.g. `50.00`)
- `frequency = 3` (monthly)
- `cycles = 0` (indefinite)
- `notify_url = https://<backend>/api/payfast/itn`

ITN handling:

- First `payment_status=COMPLETE`: marks subscription active and records `setupFeePaidAt/setupFeeAmountZar`.
- Subsequent recurring `payment_status=COMPLETE`: extends the subscription period by 1 month.

### 1) Run the backend

```bash
npm run dev
```

### 2) Send a mock ITN (generates a valid signature)

```bash
node scripts/payfast.mockItn.js
```

This posts a local ITN to `http://localhost:5001/api/payfast/itn`.

### Example curl payload

This example shows the fields PayFast posts. The `signature` must be computed using the same rules as the backend (see `scripts/payfast.mockItn.js`).

```bash
curl -i -X POST 'http://localhost:5001/api/payfast/itn' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'merchant_id=10000100&merchant_key=46f0cd694581a&m_payment_id=sub_MONTHLY_<userId>_<ts>&pf_payment_id=PF_<ts>&payment_status=COMPLETE&item_name=Monthly%20Subscription&amount_gross=70.00&amount_fee=0.00&amount_net=70.00&custom_str1=<userId>&signature=<md5>'
```

## Notes

- The ITN handler verifies:
  - `merchant_id` (and `merchant_key` if present) against env
  - MD5 signature using PayFast rules (excludes `signature`, appends passphrase if configured)
  - Optional allowlist via `PAYFAST_IP_ALLOWLIST`
  - Optional server validation via `PAYFAST_VALIDATE_WITH_SERVER=true`
  - `pf_payment_id` idempotency (stored uniquely)
  - `amount_gross` against the configured monthly price (tolerance supported)
- Subscriptions are activated only on `payment_status=COMPLETE`.
