# Store Order & Inventory Mini-System

A retail-counter billing app. The counter records customer orders against a product catalog, and stock stays in sync, including when two orders arrive at the same moment.

- **Backend:** Laravel 13 (PHP 8.3) JSON API, MySQL 8, database queue
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4, a separate app that talks to the API over CORS

```
order-inventory-system-mallow/
├── backend/    Laravel API (migrations, services, jobs, tests)
├── frontend/   React single-page app (billing screen, history, low stock)
└── prompts/    AI prompt screenshots (prompt log)
```

---

## 1. Prerequisites

| Tool | Version used | Check with |
|---|---|---|
| PHP | 8.3+ with `pdo_mysql`, `mbstring`, `openssl` | `php -v`, `php -m` |
| Composer | 2.x | `composer -V` |
| MySQL | 8.x | `mysql --version` |
| Node.js / npm | Node 20.19+ (built on 24) / npm 10+ | `node -v`, `npm -v` |

## 2. Setup

### Backend

```bash
cd backend
composer install
cp .env.example .env          # then set DB_USERNAME / DB_PASSWORD
php artisan key:generate
```

Create the two databases, one for the app and one for tests:

```sql
CREATE DATABASE `store-order-inventory-system`         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE `store-order-inventory-system_testing` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
php artisan migrate --seed    # 10 products (some already low on stock) + 10 customers
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000/api
```

## 3. Running

Run each of these in its own terminal:

```bash
# 1. API: http://localhost:8000
cd backend && php artisan serve

# 2. Queue worker (sends the confirmation email + WhatsApp message)
cd backend && php artisan queue:work

# 3. Frontend: http://localhost:5173
cd frontend && npm run dev
```

Open **http://localhost:5173**. With the default `MAIL_MAILER=log`, the confirmation emails are written to `backend/storage/logs/laravel.log`.

Seeded customers you can try: `thomas@example.com` (mobile `5550001111`) and `priya@example.com` (mobile `5550002222`). Type either the mobile number or the email, and the other two fields fill in. The seeded numbers are deliberately not real, so test WhatsApp delivery with your own number.

### Optional: real email and WhatsApp

Both notifications work without any keys: the email goes to the log, and WhatsApp is skipped with a log warning. To send them for real, set these in `backend/.env`:

```env
# Email via Resend (composer package resend/resend-php is already installed)
MAIL_MAILER=resend
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM_ADDRESS="onboarding@resend.dev"   # Resend's test sender: delivers only to your own Resend account email

# WhatsApp via wasender.dev (https://wasender.dev)
WASENDER_API_TOKEN=wsk_xxxxxxxx
WASENDER_API_URL=https://api.wasender.dev/messages/text
DEFAULT_COUNTRY_CODE=91                       # prefixed to 10-digit local numbers
```

Then restart `php artisan queue:work` (a running worker keeps the old config).

## 4. Tests

```bash
cd backend
php artisan test
```

There are 46 tests (172 assertions). They cover order creation, totals and rounding, insufficient stock, all-or-nothing rollback, validation, customer reuse, mobile-number lookup and normalisation, payment and change, order history, low-stock thresholds, both queued jobs (the WhatsApp API is faked with `Http::fake`), CORS, and a real multi-process concurrency test. `phpunit.xml` blanks the WhatsApp token and Resend key, so tests never send real messages.

> The tests use the MySQL database `store-order-inventory-system_testing` (set in `phpunit.xml`). The concurrency test needs MySQL, because SQLite silently ignores `SELECT … FOR UPDATE`. On any other driver the test skips itself.

---

## 5. API

Base URL: `http://localhost:8000/api`. Every response is JSON. A validation or stock failure returns `422` with Laravel's standard `{ message, errors }` shape.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/orders` | Create an order |
| `GET` | `/orders/{id}` | Show one order |
| `GET` | `/customers/{email}/orders?page=&per_page=` | A customer's order history, newest first (paginated) |
| `GET` | `/customers/lookup?email=` or `?phone=` | Find a customer by email **or** mobile number (drives the billing screen's auto-fill) |
| `GET` | `/products` | Catalog, for the product dropdown |
| `GET` | `/products/low-stock?threshold=` | Products with stock **below** the threshold |

### Create order

```http
POST /api/orders
Content-Type: application/json
Accept: application/json

{
  "customer_email": "thomas@example.com",
  "customer_name": "Thomas Shelby",      // required only for a new customer
  "customer_phone": "98765 43210",       // optional; enables the WhatsApp bill
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 2, "quantity": 5 }
  ],
  "amount_paid": 250                      // optional
}
```

`201 Created`:

```json
{
  "data": {
    "id": 1,
    "order_number": "ORD-20260925-IXBC2Z",
    "customer": { "id": 1, "name": "Thomas Shelby", "email": "thomas@example.com" },
    "items": [
      { "product_id": 1, "product_name": "Colgate Toothpaste 100g", "quantity": 2,
        "unit_price": "50.00", "tax_percent": "18.00",
        "line_subtotal": "100.00", "line_tax": "18.00", "line_total": "118.00" },
      { "product_id": 2, "product_name": "Parle-G Biscuit", "quantity": 5,
        "unit_price": "10.00", "tax_percent": "5.00",
        "line_subtotal": "50.00", "line_tax": "2.50", "line_total": "52.50" }
    ],
    "subtotal": "150.00", "tax_total": "20.50", "grand_total": "170.50",
    "amount_paid": "250.00", "change_due": "79.50",
    "confirmation_sent_at": null,
    "created_at": "2026-09-25T17:56:47+00:00"
  }
}
```

Insufficient stock gives `422`, and the whole order is rejected:

```json
{
  "message": "Insufficient stock for one or more products.",
  "errors": { "items.0.quantity": ["Only 2 unit(s) of Eggs (12) in stock; 3 requested."] },
  "shortages": [{ "index": 0, "product_id": 5, "name": "Eggs (12)", "requested": 3, "available": 2 }]
}
```

---

## 6. How the frontend talks to the backend (CORS)

The React app (`localhost:5173`) and the API (`localhost:8000`) are on different origins, so the browser enforces CORS:

1. For a JSON `POST`, the browser first sends a preflight `OPTIONS /api/orders` with `Origin: http://localhost:5173`.
2. Laravel's built-in `HandleCors` middleware reads [backend/config/cors.php](backend/config/cors.php) and answers with `Access-Control-Allow-Origin: http://localhost:5173`, plus the allowed methods and headers.
3. The browser then sends the real request. React reads the response.

The configuration:

- `allowed_origins` comes from `FRONTEND_URL` in `backend/.env`. It accepts a comma-separated list, e.g. for a deployed frontend. Only that origin is allowed; there is no `*`.
- `supports_credentials` is `false`. The API is stateless, with no cookies or sessions.
- On the frontend, [frontend/src/api/client.js](frontend/src/api/client.js) is a single axios instance with `baseURL = VITE_API_URL`. It sends `Accept: application/json`, so Laravel always returns validation errors as JSON 422 instead of redirecting.
- Vite runs with `strictPort: true`, so the dev server can't silently move to another port that CORS would then block.

---

## 7. Design decisions

### Schema

```
customers (id, name, email UNIQUE, phone NULL UNIQUE)
products  (id, name, code UNIQUE, price, tax_percent, stock UNSIGNED, INDEX stock)
orders    (id, order_number UNIQUE, customer_id FK, subtotal, tax_total, grand_total,
           amount_paid NULL, change_due NULL, confirmation_sent_at NULL, whatsapp_sent_at NULL,
           INDEX(customer_id, created_at))
order_items (id, order_id FK cascade, product_id FK restrict, unit_price, tax_percent, quantity,
             line_subtotal, line_tax, line_total, UNIQUE(order_id, product_id))
```

- **`order_items` is the supporting table.** It holds the many-to-many link between orders and products, plus per-line data.
- **Prices and tax are copied onto each line.** Changing a product's price or tax later must not rewrite old bills. A test covers this.
- **Totals are stored on `orders`.** They could be recomputed from the lines, but a bill is a financial record. Storing what was charged makes history reads cheap and keeps the record fixed.
- **`stock` is `UNSIGNED`.** This is the last line of defence: even buggy code can't push stock below zero.
- **Money uses `DECIMAL`, and all arithmetic uses integer paise** ([backend/app/Support/Money.php](backend/app/Support/Money.php)). This avoids float drift such as `0.1 + 0.2`.
- Deleting a product that has been sold is blocked (`restrictOnDelete`), so history never loses its lines.

### Code organisation

- **Controllers are thin.** They validate (via a Form Request), call a service and return an API Resource.
- **`OrderService::placeOrder()`** holds all the order logic: resolve the customer, lock the products, check stock, compute totals, save, deduct stock, then dispatch the job.
- **`StoreOrderRequest`** handles input validation, including rejecting duplicate products and requiring a name only for a new customer.
- **`InsufficientStockException`** renders itself as a 422 response in the same shape as a validation error, so the UI can put the message next to the right line.
- **API Resources** control the JSON shape, so internal columns never leak.

### Concurrency: no overselling

The check-and-deduct step runs inside one `DB::transaction()`:

```php
$products = Product::whereKey($ids)->orderBy('id')->lockForUpdate()->get();  // SELECT ... FOR UPDATE
// check stock -> create order + lines -> decrement stock
```

- `lockForUpdate()` takes an exclusive row lock. A second order for the same product blocks at this line until the first commits. It then reads the already-reduced stock and fails with a clean 422.
- Locks are taken in primary-key order, so two orders for overlapping products can't deadlock each other. `DB::transaction(..., attempts: 3)` retries if MySQL reports a deadlock anyway.
- Customers are created with `createOrFirst()`, so two first-time orders for the same email can't create duplicate customers.

**How it's proven:** `OrderConcurrencyTest` starts real, separate PHP processes (`php artisan orders:place …`). Each one opens its own database connection and goes through the same `OrderService` the API uses. To force the requests to overlap, rather than run one after another by chance, the test first holds the product's row lock itself. It starts all the processes, waits until they are queued behind that lock, then releases it so they compete at the same instant.

- Stock 1 with 2 buyers: exactly 1 order is placed and 1 is rejected.
- Stock 3 with 6 buyers: exactly 3 are placed, 3 are rejected, and stock ends at 0.

I checked that the test really catches the bug: with `lockForUpdate()` removed, the 6-buyer test fails. The losing requests get past the stock check and are only stopped by the unsigned column, as a 500 error rather than a clean rejection.

*Alternative considered:* a conditional atomic update, `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`, checking the number of affected rows. It is lock-free and also correct. I chose pessimistic locking because a multi-line order needs to check every line before committing to any of them, and the lock makes that all-or-nothing logic easy to follow.

### Queued jobs (email + WhatsApp)

- **`SendOrderConfirmation`** (email) and **`SendOrderWhatsAppConfirmation`** both implement `ShouldQueue` and run on the `database` queue.
- Both are dispatched **after the transaction commits**, so an order that was rolled back never notifies anyone. The WhatsApp job is dispatched only when the customer has a mobile number.
- **They are two separate jobs on purpose.** If WhatsApp is down, its retries never re-send the email, and the other way round.
- **Email:** a real Mailable (`OrderConfirmationMail`, a Markdown template) sent through the configured mailer: `log` by default, `resend` once `RESEND_API_KEY` is set.
- **WhatsApp:** [`WasenderClient`](backend/app/Services/WhatsApp/WasenderClient.php) posts `{to, body}` (number without the `+`) with a Bearer token to wasender.dev's `/messages/text` endpoint; a 2xx means WhatsApp accepted it. The message is the itemised bill. A non-2xx response throws, so the queue retries. With no token set, the job logs a warning and skips.
- Both use `tries = 3` with backoff and are **idempotent**. Each sets its own timestamp (`confirmation_sent_at` / `whatsapp_sent_at`) and skips if it is already set, so a retry never sends twice.

### Mobile numbers

- **Stored in E.164** ([backend/app/Support/Phone.php](backend/app/Support/Phone.php)). `98765 43210`, `09876543210`, `919876543210` and `+91-98765-43210` all become `+919876543210`. That makes lookups match however the number was typed, and it is the format WhatsApp needs. Ten-digit numbers get `DEFAULT_COUNTRY_CODE` (91) added.
- **The phone is unique but optional.** Email stays the customer's identity, because the brief's order-history endpoint is keyed by email. The phone is a second way to find the same customer.

---

## 8. Assumptions

1. **Customer identity is the email** (lower-cased and trimmed, so `Thomas@Example.com` is the same customer). For an existing customer the submitted name is ignored. The saved name wins, and the UI makes the name field read-only once the email is recognised. A name is required only for a new customer.
2. **Tax is calculated per line and rounded half-up to the paisa**, then summed. For example, 3 × ₹9.99 at 5% gives tax ₹1.4985, which rounds to ₹1.50.
3. **An order is all-or-nothing.** If any line is short on stock, the whole order is rejected and nothing is deducted. A partial bill at a counter would confuse the customer.
4. **Each product may appear only once per order.** A duplicate `product_id` is a validation error; the client should raise the quantity instead. Quantity must be between 1 and 10,000, with at most 50 lines.
5. **"Below the threshold" is strict** (`stock < threshold`). The default is `LOW_STOCK_THRESHOLD=10` in `.env` (read through `config/inventory.php`), and it can be overridden per request with `?threshold=`.
6. **"Amount given by customer" and "Balance to return"** from the wireframe are optional. If `amount_paid` is sent, the server checks it covers the grand total (otherwise 422) and stores the change. The note/coin breakdown (e.g. `1×₹20 + 1×₹2 + 80 paise`) is display-only and calculated in the browser.
7. **The wireframe's "emails PDF to customer"** is covered by the queued confirmation email containing the itemised bill. PDF generation was left out as outside the brief's scope ("a log entry or fake mailer is fine"). The bill can be printed from the browser.
8. **No authentication.** The brief describes an internal counter tool and doesn't mention auth. `php artisan install:api` added Sanctum, so token auth can be switched on with `auth:sanctum` on the route group.
9. **Currency is INR (₹),** following the wireframe.
10. **Mobile number:** optional on an order and never a replacement for email.
    - If a new customer gives one, it is saved. If an existing customer gives a new or different one, their record is updated.
    - A number that already belongs to *another* customer is rejected with a 422, rather than silently moving it between customers.
    - On the billing screen, a known mobile fills in email and name, and a known email fills in mobile and name. Editing the field that matched clears the auto-filled values, so a typo can't bill the wrong person.
11. **The frontend shows a live total preview** using the same integer maths as the server. The server's figures on the returned bill are the authoritative ones.

---

## 9. Frontend overview

| Screen | What it does |
|---|---|
| **New Order** (`/`) | Mobile / email / name, with two-way auto-fill for returning customers, product rows with stock-aware dropdowns, live subtotal/tax/total, amount given → change with note breakdown, Generate Bill → printable bill. Server errors appear on the matching row. Includes the Low Stock Alert panel. |
| **Order History** (`/history`) | Search by email, expandable orders with line items, pagination, and whether the confirmation email has been sent. |
| **Low Stock** (`/low-stock`) | Products below the threshold, which can be changed. |

After each order attempt, successful or not, the product list and low-stock panel reload, so stock counts reflect sales made by anyone else too.

---

## 10. AI-assisted development

This project was built with **Claude Code** (Anthropic) in VS Code. Screenshots of the prompts used are in [`/prompts`](prompts/).

Summary of how it was used:
1. Shared the task PDF and asked for a full plan first: prerequisites, every install command, and how the frontend connects to the backend (CORS). I reviewed the plan before any code was written.
2. Supplied the database credentials, which confirmed the plan. The AI then scaffolded both apps and wrote the code and tests.
3. Verification done during the session:
   - ran the full test suite;
   - mutation-checked the concurrency test by removing the lock and confirming the test fails;
   - curl-tested the CORS preflight and each endpoint;
   - ran the queue worker and confirmed the email in the log;
   - built and linted the frontend.
