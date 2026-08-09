# BourneWise — Creem test integration and eligibility brief

Updated: 2026-08-08

## Status

The code can be connected to Creem Test Mode. Do not submit the store for live
review or accept live payments until Creem confirms eligibility in writing.
Creem currently lists “metaphysical, fortune-telling, and spiritual outcome
services” as prohibited. BourneWise uses an I Ching hexagram, so the product
must be described fully and accurately; changing the label while hiding the
actual workflow is not an acceptable workaround.

## Accurate positioning

- Primary theme: hexagram-based decision analysis.
- Secondary theme: self-reflection and growth.
- Product category requested: SaaS / AI-assisted reflective decision analysis.
- Product URL: https://bournewise.com
- Support email: hello@bournewise.com

### Store description

BourneWise is a web-based reflective decision-analysis tool. A user describes
a decision or situation, the application generates an I Ching hexagram through
a software-based random casting process, and Claude explains that fixed result
as a structured prompt for self-reflection and personal growth. The model does
not choose or alter the hexagram. The service does not guarantee predictions,
outcomes, or professional advice. Customers purchase recurring or prepaid units
that are settled against measured AI model usage.

### Eligibility message to Creem support

> We are preparing BourneWise, a web SaaS for structured reflection and decision
> analysis. The software generates a random I Ching hexagram before any model
> call; Claude then explains that fixed figure. We show the generated figure,
> distinguish evidence from inference, and make no prediction, spiritual
> outcome, or professional-advice guarantee. Because your prohibited-products
> list includes metaphysical and fortune-telling services, could you confirm in
> writing whether this exact product is eligible before we request live review?
> Product URL: https://bournewise.com

## Products to create in Test Mode

Use `USD`, tax category `saas`, and one consistent tax mode. `inclusive` best
matches the exact prices displayed on the website.

The website does not show four separate subscription cards. It shows one Pro
card and one Premium card with a checkable **Annually** option. Unchecked sends
`promonthly` / `premiummonthly`; checked sends `proannual` /
`premiumannual`. Creem still needs all four recurring products because each
billing interval has its own product ID.

| Creem product | Type | Period | Price | Customer receives | Cloudflare variable |
| --- | --- | --- | ---: | ---: | --- |
| BourneWise Pro Monthly | recurring | every-month | $19 | 28,500 units monthly | `CREEM_PRODUCT_PROMONTHLY` |
| BourneWise Pro Annual | recurring | every-year | $190 | 342,000 units yearly | `CREEM_PRODUCT_PROANNUAL` |
| BourneWise Premium Monthly | recurring | every-month | $29 | 43,500 units monthly | `CREEM_PRODUCT_PREMIUMMONTHLY` |
| BourneWise Premium Annual | recurring | every-year | $290 | 522,000 units yearly | `CREEM_PRODUCT_PREMIUMANNUAL` |
| BourneWise 7,500 Unit Pack | one-time | — | $5 | 7,500 units | `CREEM_PRODUCT_PACK7500` |
| BourneWise 15,000 Unit Pack | one-time | — | $10 | 15,000 units | `CREEM_PRODUCT_PACK15000` |
| BourneWise 30,000 Unit Pack | one-time | — | $20 | 30,000 units | `CREEM_PRODUCT_PACK30000` |
| BourneWise 75,000 Unit Pack | one-time | — | $50 | 75,000 units | `CREEM_PRODUCT_PACK75000` |

### Common fields for all eight products

Fill these values consistently in both Test Mode and, after approval, Live
Mode. Products are not copied between the two environments.

| Creem field | Value to enter | Reason / constraint |
| --- | --- | --- |
| Currency | `USD` | Matches every public price on `bournewise.com`. |
| Tax mode | `inclusive` | The displayed price remains the customer's headline price; tax is included rather than added on top. |
| Tax category | `saas` | BourneWise is delivered as hosted software, not an ebook or downloadable file. |
| Product status | `active` | Required for the product to be selectable at checkout. Use active in Test Mode only while testing. |
| Pay what you want | Off | BourneWise uses fixed, public prices. |
| Suggested price | Leave blank | Only applies when pay-what-you-want is enabled. |
| Default success URL | `https://bournewise.com/settings.html?billing=success` | The server also supplies this URL when creating a checkout. Keeping the product default aligned provides a safe fallback. |
| Custom fields | None | The authenticated account and email are attached server-side. Do not ask the customer to re-enter a user ID or account identifier. |
| Abandoned-cart recovery | Off initially | Keep the first integration simple and avoid recovery messaging until the core lifecycle is verified. |
| Product image | Optional | Leave blank or use one consistent public HTTPS PNG/JPG BourneWise cover. Do not use a different visual identity for each SKU. |
| Private Notes | Enable with the text below | Creem includes this note in the email receipt, Customer Portal, and hosted confirmation page. Use the same note for all eight products. |

Private Note to paste into every product:

> Payment confirmed. Your BourneWise unit balance updates automatically after
> the signed payment event is received. Creem has generated the receipt and
> invoice for this transaction. Open BourneWise Settings → Receipts & billing
> to manage invoices, payment methods, and subscriptions. For product or unit
> balance questions, contact hello@bournewise.com from the email used at
> checkout.

### Receipt email and invoice configuration

- Under **Settings → Business Details**, set the contact email to
  `hello@bournewise.com`. It must match the public website and will appear on
  customer receipts.
- In Creem's checkout/receipt customization, upload the BourneWise logo and use
  one restrained brand accent across the hosted checkout and receipt email.
- Do not send a second home-built "official invoice" email. Creem is the
  Merchant of Record and automatically generates the authoritative receipt and
  invoice for every transaction.
- After each successful payment, Creem emails the customer a receipt and a
  magic link to the Customer Portal. The portal retains invoices, order IDs,
  payment details, and subscription controls.
- The card statement may display `CREEM.IO* STORE`, because Creem is the legal
  seller of record. Explain this in support replies rather than promising a
  BourneWise-only statement descriptor.

### Exact product entries

Prices below are entered in dollars in the dashboard. If products are created
through the API, `price` is an integer in cents (`$19` becomes `1900`).

| # | Name | Billing type | Billing period | Price | Description to paste | Product-specific feature copy | Save returned ID as |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 1 | `BourneWise Pro Monthly` | `recurring` | `every-month` | `$19` / `1900` cents | `28,500 BourneWise units added every monthly billing cycle for AI-assisted hexagram analysis supporting structured reflection, decision analysis, and personal growth. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `28,500 units each month`; `Stria 64 and Sortis 6`; `Metered usage with automatic reconciliation`; `Cancel at any time; service continues through the paid period` | `CREEM_PRODUCT_PROMONTHLY` |
| 2 | `BourneWise Pro Annual` | `recurring` | `every-year` | `$190` / `19000` cents | `342,000 BourneWise units added every yearly billing cycle for AI-assisted hexagram analysis supporting structured reflection, decision analysis, and personal growth. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `342,000 units each year`; `Equivalent to twelve Pro monthly allowances`; `Stria 64 and Sortis 6`; `Cancel at any time; service continues through the paid period` | `CREEM_PRODUCT_PROANNUAL` |
| 3 | `BourneWise Premium Monthly` | `recurring` | `every-month` | `$29` / `2900` cents | `43,500 BourneWise units added every monthly billing cycle for frequent AI-assisted hexagram analysis, longer ongoing work, structured reflection, decision analysis, and personal growth. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `43,500 units each month`; `Designed for frequent Sortis work`; `Stria 64 and Sortis 6`; `Cancel at any time; service continues through the paid period` | `CREEM_PRODUCT_PREMIUMMONTHLY` |
| 4 | `BourneWise Premium Annual` | `recurring` | `every-year` | `$290` / `29000` cents | `522,000 BourneWise units added every yearly billing cycle for frequent AI-assisted hexagram analysis, longer ongoing work, structured reflection, decision analysis, and personal growth. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `522,000 units each year`; `Equivalent to twelve Premium monthly allowances`; `Stria 64 and Sortis 6`; `Cancel at any time; service continues through the paid period` | `CREEM_PRODUCT_PREMIUMANNUAL` |
| 5 | `BourneWise 7,500 Unit Pack` | `onetime` | No recurring period | `$5` / `500` cents | `A one-time purchase of 7,500 BourneWise units. Units are added to the account after successful payment, do not renew, and remain available until used. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `7,500 units once`; `No automatic renewal`; `Works with either reading method` | `CREEM_PRODUCT_PACK7500` |
| 6 | `BourneWise 15,000 Unit Pack` | `onetime` | No recurring period | `$10` / `1000` cents | `A one-time purchase of 15,000 BourneWise units. Units are added to the account after successful payment, do not renew, and remain available until used. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `15,000 units once`; `No automatic renewal`; `Works with either reading method` | `CREEM_PRODUCT_PACK15000` |
| 7 | `BourneWise 30,000 Unit Pack` | `onetime` | No recurring period | `$20` / `2000` cents | `A one-time purchase of 30,000 BourneWise units. Units are added to the account after successful payment, do not renew, and remain available until used. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `30,000 units once`; `No automatic renewal`; `Works with either reading method` | `CREEM_PRODUCT_PACK30000` |
| 8 | `BourneWise 75,000 Unit Pack` | `onetime` | No recurring period | `$50` / `5000` cents | `A one-time purchase of 75,000 BourneWise units. Units are added to the account after successful payment, do not renew, and remain available until used. Both Stria 64 and Sortis 6 spend from the same balance. Usage is metered and unused reserved units are returned after each answer.` | `75,000 units once`; `No automatic renewal`; `Works with either reading method` | `CREEM_PRODUCT_PACK75000` |

Do not create the Free plan as a Creem product. Its 500 welcome units are an
account grant inside BourneWise and have no payment transaction.

Suggested subscription description:

> A recurring BourneWise unit allowance for AI-assisted hexagram analysis used
> for structured self-reflection, decision analysis, and personal growth.

Suggested unit-pack description:

> A one-time BourneWise unit balance. Units do not expire. Each generation
> reserves a published maximum, settles measured usage, and returns the unused
> difference automatically.

## Test Mode connection

1. In Creem, enable **Test Mode** from the bottom of the left sidebar.
2. Under **Products**, create the eight test products above.
3. Under **Developers / API Keys**, copy the test key into the Cloudflare Pages
   secret `CREEM_API_KEY`.
4. Register `https://bournewise.com/api/billing/webhook` under **Developers /
   Webhooks**, then store its signing secret as `CREEM_WEBHOOK_SECRET`.
5. Copy each test `prod_...` ID into its matching Cloudflare variable.
6. Redeploy, sign in to a test account, and complete every checkout path.

```text
CREEM_API_KEY
CREEM_WEBHOOK_SECRET
CREEM_PRODUCT_PROMONTHLY
CREEM_PRODUCT_PROANNUAL
CREEM_PRODUCT_PREMIUMMONTHLY
CREEM_PRODUCT_PREMIUMANNUAL
CREEM_PRODUCT_PACK7500
CREEM_PRODUCT_PACK15000
CREEM_PRODUCT_PACK30000
CREEM_PRODUCT_PACK75000
```

Test and live environments have separate API keys, webhook secrets, products,
and product IDs. Never reuse a test product ID with a live key.

## Test definition of done

- Each one-time pack credits the exact units once.
- Replaying the same webhook does not grant units twice.
- A successful `refund.created` reverses the refunded proportion of the
  original grant, never takes the account below zero, and cannot reverse twice.
- A `dispute.created` reverses the corresponding grant and is recorded with a
  separate dispute ledger reason.
- Monthly and annual checkouts set the correct plan.
- `subscription.paid` grants 1 or 12 months of units as appropriate.
- Checkout returns to `/settings.html?billing=success`.
- The customer portal opens from Settings.
- In-product cancellation schedules cancellation at period end.
- A failed renewal records `past_due` or `unpaid`; cancellation/expiry downgrades the plan
  without deleting already purchased units.
- Pricing, Terms, Privacy, Refunds, and `hello@bournewise.com` are public and
  use the same prices, support address, and billing explanation.

## Live definition of done

- Creem support has confirmed product eligibility in writing.
- Business Details use `hello@bournewise.com`, matching the public website.
- KYC/KYB, tax residence, and payout details are complete.
- The store has passed account review and Live Payments is enabled.
- All eight products are recreated in Live Mode and all ten Cloudflare values
  are replaced with live values.
- A real low-value transaction, refund, portal visit, scheduled cancellation,
  and (where Creem provides a safe test path) dispute event reconcile between
  Creem delivery logs and the BourneWise D1 ledger.
