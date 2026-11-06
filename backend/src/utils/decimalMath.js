// =============================================================================
// Decimal-Safe Precision Financial Arithmetic
// Prevents JavaScript IEEE-754 floating-point rounding errors (e.g. 0.1 + 0.2 !== 0.3)
// =============================================================================

const SCALE = 100; // 2 decimal places precision for currency cents / paisas

/**
 * Rounds a number to exactly 2 decimal places using half-up rounding.
 * @param {number|string} val
 * @returns {number}
 */
export function roundCurrency(val) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return 0.00;
  return Math.round((num + Number.EPSILON) * SCALE) / SCALE;
}

/**
 * Adds two monetary amounts with decimal safety.
 */
export function addMoney(a, b) {
  const centsA = Math.round(roundCurrency(a) * SCALE);
  const centsB = Math.round(roundCurrency(b) * SCALE);
  return (centsA + centsB) / SCALE;
}

/**
 * Subtracts monetary amount b from a with decimal safety.
 */
export function subtractMoney(a, b) {
  const centsA = Math.round(roundCurrency(a) * SCALE);
  const centsB = Math.round(roundCurrency(b) * SCALE);
  return (centsA - centsB) / SCALE;
}

/**
 * Multiplies a unit price by an integer quantity.
 */
export function multiplyLineTotal(unitPrice, quantity) {
  const cents = Math.round(roundCurrency(unitPrice) * SCALE);
  const qty = parseInt(quantity, 10) || 0;
  return (cents * qty) / SCALE;
}

/**
 * Calculates tax on a taxable amount using a percentage rate.
 * @param {number} taxableAmount - Subtotal minus any applicable discount
 * @param {number} ratePercent - e.g. 18.0 for 18% GST
 * @returns {number}
 */
export function calculateTax(taxableAmount, ratePercent) {
  const amount = roundCurrency(taxableAmount);
  const rate = typeof ratePercent === 'string' ? parseFloat(ratePercent) : ratePercent;
  if (!rate || rate <= 0) return 0.00;
  return roundCurrency((amount * rate) / 100);
}

/**
 * Validates and calculates complete checkout totals on the server.
 * Never trusts subtotal, discount, tax, or total passed from client.
 *
 * @param {Array<{quantity: number, unit_price: number, tax_rate?: number, discount_amount?: number}>} items
 * @param {number} invoiceDiscount - Overall invoice discount amount
 * @param {boolean} taxEnabled - Global tax toggle
 * @returns {{subtotal: number, discountTotal: number, taxTotal: number, netTotal: number, validatedItems: Array}}
 */
export function calculateCheckoutTotals(items, invoiceDiscount = 0, taxEnabled = false) {
  let subtotal = 0.00;
  let itemsDiscountTotal = 0.00;
  let taxTotal = 0.00;

  const validatedItems = items.map(item => {
    const qty = parseInt(item.quantity, 10);
    if (!qty || qty <= 0) {
      throw new Error(`Invalid item quantity: ${item.quantity}`);
    }

    const price = roundCurrency(item.unit_price);
    if (price < 0) {
      throw new Error(`Invalid unit price: ${item.unit_price}`);
    }

    const itemDiscount = roundCurrency(item.discount_amount || 0);
    const lineSubtotal = multiplyLineTotal(price, qty);
    const lineAfterDiscount = Math.max(0.00, subtractMoney(lineSubtotal, itemDiscount));

    const rate = taxEnabled ? (parseFloat(item.tax_rate) || 0) : 0;
    const lineTax = taxEnabled ? calculateTax(lineAfterDiscount, rate) : 0.00;
    const lineTotal = addMoney(lineAfterDiscount, lineTax);

    subtotal = addMoney(subtotal, lineSubtotal);
    itemsDiscountTotal = addMoney(itemsDiscountTotal, itemDiscount);
    taxTotal = addMoney(taxTotal, lineTax);

    return {
      ...item,
      quantity: qty,
      unit_price: price,
      discount_amount: itemDiscount,
      tax_rate: rate,
      tax_amount: lineTax,
      line_total: lineTotal,
    };
  });

  const parsedInvoiceDiscount = roundCurrency(invoiceDiscount);
  const totalDiscount = addMoney(itemsDiscountTotal, parsedInvoiceDiscount);

  // Net total: subtotal - totalDiscount + taxTotal
  const taxableBase = Math.max(0.00, subtractMoney(subtotal, totalDiscount));
  const netTotal = addMoney(taxableBase, taxTotal);

  return {
    subtotal,
    discountTotal: totalDiscount,
    taxTotal,
    netTotal,
    validatedItems,
  };
}

export default {
  roundCurrency,
  addMoney,
  subtractMoney,
  multiplyLineTotal,
  calculateTax,
  calculateCheckoutTotals,
};
