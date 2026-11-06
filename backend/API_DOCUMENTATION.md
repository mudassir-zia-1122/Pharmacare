# PharmaCare REST API Documentation

> **Base URL:** `http://localhost:5000/api/v1`
> **Protocol:** HTTP/1.1 REST
> **Format:** JSON
> **Authentication:** HTTP Bearer Header (`Authorization: Bearer <JWT>`)

---

## Standard Response Format

### Success Response Envelope
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource retrieved successfully",
  "data": { ... }
}
```

### Paginated Response Envelope
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Medicines retrieved",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 284,
    "totalPages": 15
  }
}
```

### Error Response Envelope
```json
{
  "success": false,
  "statusCode": 400,
  "message": "PHARMACY SAFETY ERROR: Cannot dispense an inactive, expired, recalled, or quarantined batch.",
  "errors": []
}
```

---

## 1. System & Health

### `GET /health`
Public diagnostic endpoint reporting server status and MySQL database connectivity.

**Response (MySQL Connected):**
```json
{
  "status": "healthy",
  "serverTime": "2026-10-21T11:30:00.000Z",
  "database": {
    "ok": true,
    "database": "pharmacare_db",
    "host": "localhost",
    "port": 3306,
    "connected": true
  },
  "version": "1.0.0"
}
```

**Response (MySQL Offline):**
```json
{
  "status": "degraded",
  "serverTime": "2026-10-21T11:30:00.000Z",
  "database": {
    "ok": false,
    "database": "pharmacare_db",
    "host": "localhost",
    "port": 3306,
    "connected": false,
    "error": "connect ECONNREFUSED 127.0.0.1:3306"
  },
  "version": "1.0.0"
}
```

---

## 2. Authentication & Profile (`/auth`)

### `POST /auth/login`
Public endpoint (rate-limited: max 15 requests/15min).

**Request Body:**
```json
{
  "username": "admin",
  "password": "Password123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@pharmacare.pk",
      "fullName": "Administrator",
      "role": "admin",
      "roleDisplay": "System Administrator"
    }
  }
}
```

### `GET /auth/me`
Protected (any authenticated role). Returns profile of the current token bearer.

### `POST /auth/change-password`
Protected (any authenticated role).
**Request Body:**
```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

---

## 3. Dashboard Metrics (`/dashboard`)

### `GET /dashboard/summary`
Protected (all staff roles). Returns live KPI cards, 15-day revenue trend, and recent sales.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalMedicines": 284,
      "todayRevenue": 47850.00,
      "todaySales": 23,
      "lowStockCount": 12,
      "nearExpiryCount": 8,
      "totalSuppliers": 18
    },
    "recentSales": [ ... ],
    "salesTrend": [ ... ]
  }
}
```

---

## 4. Medicines Catalogue (`/medicines`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/medicines` | All Staff | Filterable list (`?search=amox&category=Antibiotics&page=1`) |
| `GET` | `/medicines/:id` | All Staff | Complete medicine record with active batches and packaging |
| `POST`| `/medicines` | `admin`, `pharmacist` | Create new medicine entry |
| `PUT` | `/medicines/:id` | `admin`, `pharmacist` | Update medicine specifications |
| `GET` | `/medicines/categories` | All Staff | Category list with product counts |
| `POST`| `/medicines/categories` | `admin`, `pharmacist` | Add new category |
| `GET` | `/medicines/dosage-forms`| All Staff | List of dosage forms |
| `GET` | `/medicines/manufacturers`| All Staff | List of pharmaceutical manufacturers |

---

## 5. Inventory & FEFO Batches (`/inventory`)

### `GET /inventory/batches`
Protected (all staff). Lists batches with expiry status, on-hand count, and pricing.
Query parameters: `?search=PAN&status=active&page=1&limit=20`.

### `PATCH /inventory/batches/:id/status`
Protected (`admin`, `pharmacist`). Recalls or quarantines a stock batch.
**Request Body:**
```json
{
  "status": "recalled",
  "reason": "DRAP Alert #2026-44: Packaging integrity compromise"
}
```

### `GET /inventory/movements`
Protected (`admin`, `pharmacist`, `stock_manager`). Immutable audit ledger of all inventory transactions.

---

## 6. Purchases & Stock Receiving (`/purchases`)

### `GET /purchases`
List purchase orders with supplier details.

### `POST /purchases`
Protected (`admin`, `stock_manager`). Create purchase order with line items.

### `POST /purchases/:id/receive`
Protected (`admin`, `stock_manager`). Transactionally receives delivered stock, creates or increments batch records, and logs `PURCHASE_RECEIPT` movements.

---

## 7. Point of Sale & Billing (`/pos`)

### `GET /pos/search?q=8901234567890`
Fast barcode scanner or text search returning medicines with current shelf prices and active stock.

### `POST /pos/checkout`
Protected (`admin`, `pharmacist`, `cashier`).
**Server-side processing:**
1. Validates quantities and prices.
2. Allocates stock using **FEFO (First Expired, First Out)**.
3. Calculates subtotal, item discounts, invoice discounts, and tax via decimal-safe arithmetic.
4. Decrements batch inventory and generates `INV-YYYY-XXXXX`.
5. Records payment and audit entries inside an atomic transaction.

**Request Body:**
```json
{
  "customerId": 2,
  "items": [
    { "medicineId": 1, "quantity": 2, "customDiscount": 0 },
    { "medicineId": 2, "quantity": 1, "customDiscount": 0 }
  ],
  "invoiceDiscount": 50.00,
  "paymentMethod": "cash",
  "prescriptionVerified": true
}
```

### `GET /pos/sales`
List sales history with customer and cashier names.

### `GET /pos/sales/:id`
Full sales invoice details for receipt printing (PDF or Thermal).

---

## 8. Returns Workflow (`/returns`)

### `POST /returns/sales`
Protected (`admin`, `pharmacist`).
Validates returned quantity against the original sale invoice.
**Request Body:**
```json
{
  "saleId": 12,
  "items": [
    {
      "saleItemId": 45,
      "returnQuantity": 1,
      "restockAction": "RESTOCK_ACTIVE"
    }
  ],
  "reason": "Wrong dosage dispensed by mistake",
  "notes": "Unopened strip verified by pharmacist"
}
```

---

## 9. Restricted Prescriptions (`/prescriptions`)

Protected strictly to `admin` and `pharmacist` roles. Cashiers and stock managers are blocked (403 Forbidden). Every view operation writes to `audit_logs` with action `VIEW_SENSITIVE`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/prescriptions` | Filterable list of prescriptions |
| `GET` | `/prescriptions/:id` | Full prescription details and prescribed items |
| `POST`| `/prescriptions/:id/verify` | Clinical pharmacist verification |

---

## 10. Reports & Analytics (`/reports`)

Protected (`admin`, `pharmacist`, `stock_manager`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reports/sales?startDate=2026-10-01&endDate=2026-10-21` | Sales and revenue report |
| `GET` | `/reports/valuation` | Total stock valuation at cost and retail |
| `GET` | `/reports/low-stock` | Items below reorder threshold |
| `GET` | `/reports/near-expiry` | Batches expiring within configured days (default 90) |

---

## 11. Settings & Configuration (`/settings`)

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/settings` | All Staff | Read active pharmacy settings |
| `POST`| `/settings` | `admin` | Update settings (tax rules, currency, receipt preferences) |
| `GET` | `/settings/currencies` | All Staff | Multi-currency exchange rate list |
| `GET` | `/settings/tax-rules` | All Staff | Configurable tax rates (GST) |
| `GET` | `/settings/suppliers` | All Staff | Supplier directory |
| `GET` | `/settings/customers` | All Staff | Customer / patient search |
