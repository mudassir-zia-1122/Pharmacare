import { query } from '../config/db.js';

export async function getSalesReport({ startDate, endDate }) {
  const whereClauses = ['s.status = "completed"'];
  const params = [];

  if (startDate) {
    whereClauses.push('DATE(s.sale_timestamp) >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('DATE(s.sale_timestamp) <= ?');
    params.push(endDate);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const [dailyTrend, topMedicines, totals] = await Promise.all([
    query(
      `SELECT DATE(s.sale_timestamp) AS date,
              COUNT(*) AS totalTransactions,
              COALESCE(SUM(s.subtotal_amount), 0) AS subtotal,
              COALESCE(SUM(s.discount_amount), 0) AS discount,
              COALESCE(SUM(s.tax_amount), 0) AS tax,
              COALESCE(SUM(s.total_amount), 0) AS revenue
         FROM sales s
       ${whereSql}
        GROUP BY DATE(s.sale_timestamp)
        ORDER BY DATE(s.sale_timestamp) ASC`,
      params
    ),
    query(
      `SELECT m.generic_name AS genericName, m.brand_name AS brandName,
              SUM(si.quantity) AS unitsSold,
              COALESCE(SUM(si.line_total), 0) AS totalRevenue
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN medicines m ON si.medicine_id = m.id
       ${whereSql}
        GROUP BY m.id, m.generic_name, m.brand_name
        ORDER BY unitsSold DESC
        LIMIT 10`,
      params
    ),
    query(
      `SELECT COUNT(*) AS totalSales,
              COALESCE(SUM(s.total_amount), 0) AS totalRevenue,
              COALESCE(SUM(s.discount_amount), 0) AS totalDiscount,
              COALESCE(SUM(s.tax_amount), 0) AS totalTax
         FROM sales s
       ${whereSql}`,
      params
    ),
  ]);

  return {
    summary: totals[0] || {},
    dailyTrend,
    topMedicines,
  };
}

export async function getStockValuationReport() {
  const [summaryRows, batchRows] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'active' AND expiry_date > CURRENT_DATE THEN quantity_on_hand * cost_price ELSE 0 END), 0) AS activeStockValueCost,
         COALESCE(SUM(CASE WHEN status = 'active' AND expiry_date > CURRENT_DATE THEN quantity_on_hand * selling_price ELSE 0 END), 0) AS activeStockValueRetail,
         COALESCE(SUM(CASE WHEN status = 'expired' OR expiry_date <= CURRENT_DATE THEN quantity_on_hand * cost_price ELSE 0 END), 0) AS expiredStockLossCost,
         COUNT(DISTINCT CASE WHEN status = 'active' AND quantity_on_hand > 0 THEN medicine_id END) AS activeMedicinesCount
       FROM batches`
    ),
    query(
      `SELECT b.id, b.batch_number AS batchNo, m.generic_name AS genericName,
              m.brand_name AS brandName, b.quantity_on_hand AS qty,
              b.cost_price AS costPrice, b.selling_price AS sellingPrice,
              (b.quantity_on_hand * b.cost_price) AS totalCostValue,
              (b.quantity_on_hand * b.selling_price) AS totalRetailValue,
              b.expiry_date AS expiryDate, b.status
         FROM batches b
         JOIN medicines m ON b.medicine_id = m.id
        WHERE b.quantity_on_hand > 0
        ORDER BY totalCostValue DESC
        LIMIT 50`
    ),
  ]);

  return {
    summary: summaryRows[0] || {},
    batches: batchRows,
  };
}

export async function getLowStockReport() {
  return query('SELECT * FROM v_low_stock_alerts ORDER BY deficit_quantity DESC');
}

export async function getNearExpiryReport() {
  return query('SELECT * FROM v_near_expiry_batches ORDER BY days_until_expiry ASC');
}

export async function getDepartmentPrescriptionReport() {
  return query(`
    SELECT d.id AS departmentId, d.name AS departmentName, d.code AS departmentCode,
           COUNT(p.id) AS totalPrescriptions,
           SUM(CASE WHEN p.status = 'verified' THEN 1 ELSE 0 END) AS verifiedCount,
           SUM(CASE WHEN p.status = 'dispensed' THEN 1 ELSE 0 END) AS dispensedCount,
           SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) AS pendingCount
      FROM departments d
      LEFT JOIN prescriptions p ON d.id = p.department_id
     GROUP BY d.id, d.name, d.code
     ORDER BY totalPrescriptions DESC, d.name ASC
  `);
}

export async function getProfitLossReport({ startDate, endDate } = {}) {
  const whereSales = ['s.status = "completed"'];
  const whereExp = ['e.deleted_at IS NULL'];
  const paramsSales = [];
  const paramsExp = [];

  if (startDate) {
    whereSales.push('DATE(s.sale_timestamp) >= ?');
    paramsSales.push(startDate);
    whereExp.push('e.expense_date >= ?');
    paramsExp.push(startDate);
  }
  if (endDate) {
    whereSales.push('DATE(s.sale_timestamp) <= ?');
    paramsSales.push(endDate);
    whereExp.push('e.expense_date <= ?');
    paramsExp.push(endDate);
  }

  const [sales] = await query(
    `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS transactions
       FROM sales s
      WHERE ${whereSales.join(' AND ')}`,
    paramsSales
  );

  const [cogs] = await query(
    `SELECT COALESCE(SUM(si.quantity * b.cost_price), 0) AS cogs
       FROM sale_items si
       JOIN batches b ON si.batch_id = b.id
       JOIN sales s ON si.sale_id = s.id
      WHERE ${whereSales.join(' AND ')}`,
    paramsSales
  );

  const [expenses] = await query(
    `SELECT COALESCE(SUM(amount), 0) AS totalExpenses
       FROM expenses e
      WHERE ${whereExp.join(' AND ')}`,
    paramsExp
  );

  const revenue = parseFloat(sales?.revenue || 0);
  const costOfGoods = parseFloat(cogs?.cogs || 0);
  const grossProfit = revenue - costOfGoods;
  const totalExpenses = parseFloat(expenses?.totalExpenses || 0);
  const netProfit = grossProfit - totalExpenses;

  return {
    revenue,
    cogs: costOfGoods,
    grossProfit,
    totalExpenses,
    netProfit,
    margin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0,
  };
}

export default {
  getSalesReport,
  getStockValuationReport,
  getLowStockReport,
  getNearExpiryReport,
  getDepartmentPrescriptionReport,
  getProfitLossReport,
};
