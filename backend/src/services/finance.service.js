import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function getExpenses({ search, category, startDate, endDate, page = 1, limit = 20 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offsetNum = (pageNum - 1) * limitNum;

  const whereClauses = ['e.deleted_at IS NULL'];
  const params = [];

  if (search && search.trim()) {
    whereClauses.push('(e.title LIKE ? OR e.reference_no LIKE ? OR e.description LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (category) {
    whereClauses.push('e.category = ?');
    params.push(category);
  }

  if (startDate) {
    whereClauses.push('e.expense_date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push('e.expense_date <= ?');
    params.push(endDate);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total, COALESCE(SUM(amount), 0) AS totalAmount FROM expenses e ${whereSql}`;
  const [summaryRows] = await query(countSql, params);
  const totalItems = summaryRows?.total || 0;
  const totalAmount = parseFloat(summaryRows?.totalAmount || 0);

  const dataSql = `
    SELECT e.id, e.title, e.category, e.amount, e.expense_date AS expenseDate,
           e.payment_method AS paymentMethod, e.reference_no AS referenceNo,
           e.description, e.receipt_url AS receiptUrl,
           e.created_by_user_id AS createdByUserId, u.full_name AS createdByName,
           e.created_at AS createdAt, e.updated_at AS updatedAt
      FROM expenses e
      LEFT JOIN users u ON e.created_by_user_id = u.id
    ${whereSql}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT ? OFFSET ?
  `;
  const dataRows = await query(dataSql, [...params, limitNum, offsetNum]);

  return {
    items: dataRows,
    totalAmount,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum) || 1,
    },
  };
}

export async function getExpenseById(id) {
  const rows = await query(
    `SELECT e.id, e.title, e.category, e.amount, e.expense_date AS expenseDate,
            e.payment_method AS paymentMethod, e.reference_no AS referenceNo,
            e.description, e.receipt_url AS receiptUrl,
            e.created_by_user_id AS createdByUserId, u.full_name AS createdByName,
            e.created_at AS createdAt, e.updated_at AS updatedAt
       FROM expenses e
       LEFT JOIN users u ON e.created_by_user_id = u.id
      WHERE e.id = ? AND e.deleted_at IS NULL`,
    [id]
  );

  if (!rows || rows.length === 0) {
    throw ApiError.notFound(`Expense with ID ${id} not found.`);
  }

  return rows[0];
}

export async function createExpense(data, userId) {
  const {
    title,
    category = 'Miscellaneous',
    amount,
    expenseDate,
    paymentMethod = 'cash',
    referenceNo,
    description,
    receiptUrl,
  } = data;

  if (!title || !title.trim()) {
    throw ApiError.badRequest('Expense title is required.');
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw ApiError.badRequest('Expense amount must be a positive number.');
  }

  const dateToUse = expenseDate || new Date().toISOString().slice(0, 10);

  const result = await query(
    `INSERT INTO expenses (
       title, category, amount, expense_date, payment_method,
       reference_no, description, receipt_url, created_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title.trim(),
      category,
      parsedAmount,
      dateToUse,
      paymentMethod,
      referenceNo ? referenceNo.trim() : null,
      description ? description.trim() : null,
      receiptUrl ? receiptUrl.trim() : null,
      userId || null,
    ]
  );

  const newId = result.insertId;

  await logAudit({
    userId,
    action: 'CREATE_EXPENSE',
    table: 'expenses',
    recordId: newId,
    details: { title, category, amount: parsedAmount },
  });

  return getExpenseById(newId);
}

export async function updateExpense(id, data, userId) {
  const existing = await getExpenseById(id);

  const title = data.title !== undefined ? data.title.trim() : existing.title;
  const category = data.category !== undefined ? data.category : existing.category;
  const amount = data.amount !== undefined ? parseFloat(data.amount) : existing.amount;
  const expenseDate = data.expenseDate !== undefined ? data.expenseDate : existing.expenseDate;
  const paymentMethod = data.paymentMethod !== undefined ? data.paymentMethod : existing.paymentMethod;
  const referenceNo = data.referenceNo !== undefined ? data.referenceNo : existing.referenceNo;
  const description = data.description !== undefined ? data.description : existing.description;
  const receiptUrl = data.receiptUrl !== undefined ? data.receiptUrl : existing.receiptUrl;

  await query(
    `UPDATE expenses
        SET title = ?, category = ?, amount = ?, expense_date = ?,
            payment_method = ?, reference_no = ?, description = ?,
            receipt_url = ?
      WHERE id = ? AND deleted_at IS NULL`,
    [
      title,
      category,
      amount,
      expenseDate,
      paymentMethod,
      referenceNo,
      description,
      receiptUrl,
      id,
    ]
  );

  await logAudit({
    userId,
    action: 'UPDATE_EXPENSE',
    table: 'expenses',
    recordId: id,
    details: { title, amount },
  });

  return getExpenseById(id);
}

export async function deleteExpense(id, userId) {
  await getExpenseById(id);

  await query('UPDATE expenses SET deleted_at = NOW() WHERE id = ?', [id]);

  await logAudit({
    userId,
    action: 'DELETE_EXPENSE',
    table: 'expenses',
    recordId: id,
    details: { softDeleted: true },
  });

  return { message: 'Expense deleted successfully.', id };
}

export async function getFinancialSummary({ startDate, endDate } = {}) {
  const dateClausesSales = ["status IN ('completed', 'partially_returned')"];
  const dateClausesExp = ['deleted_at IS NULL'];
  const paramsSales = [];
  const paramsExp = [];

  if (startDate) {
    dateClausesSales.push('DATE(sale_timestamp) >= ?');
    paramsSales.push(startDate);
    dateClausesExp.push('expense_date >= ?');
    paramsExp.push(startDate);
  }
  if (endDate) {
    dateClausesSales.push('DATE(sale_timestamp) <= ?');
    paramsSales.push(endDate);
    dateClausesExp.push('expense_date <= ?');
    paramsExp.push(endDate);
  }

  const whereSales = `WHERE ${dateClausesSales.join(' AND ')}`;
  const whereExp = `WHERE ${dateClausesExp.join(' AND ')}`;

  // Total sales revenue and transactions
  const [salesSummary] = await query(
    `SELECT COUNT(*) AS totalTransactions,
            COALESCE(SUM(subtotal_amount), 0) AS subtotal,
            COALESCE(SUM(discount_amount), 0) AS discounts,
            COALESCE(SUM(tax_amount), 0) AS taxes,
            COALESCE(SUM(total_amount), 0) AS revenue
       FROM sales ${whereSales}`,
    paramsSales
  );

  const revenue = parseFloat(salesSummary?.revenue || 0);
  const totalTransactions = parseInt(salesSummary?.totalTransactions || 0, 10);

  // Cost of Goods Sold (COGS) from sale items
  const [cogsRow] = await query(
    `SELECT COALESCE(SUM(si.quantity * b.cost_price), 0) AS cogs
       FROM sale_items si
       JOIN batches b ON si.batch_id = b.id
       JOIN sales s ON si.sale_id = s.id
      ${whereSales.replace(/status/g, 's.status').replace(/sale_timestamp/g, 's.sale_timestamp')}`,
    paramsSales
  );
  const cogs = parseFloat(cogsRow?.cogs || 0);

  // Total Operating Expenses
  const [expSummary] = await query(
    `SELECT COALESCE(SUM(amount), 0) AS totalExpenses FROM expenses ${whereExp}`,
    paramsExp
  );
  const totalExpenses = parseFloat(expSummary?.totalExpenses || 0);

  // Category-wise expenses
  const expenseByCategory = await query(
    `SELECT category, COALESCE(SUM(amount), 0) AS total
       FROM expenses
      ${whereExp}
      GROUP BY category
      ORDER BY total DESC`,
    paramsExp
  );

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - totalExpenses;
  const profitMarginPercent = revenue > 0 ? parseFloat(((netProfit / revenue) * 100).toFixed(2)) : 0;

  return {
    revenue,
    cogs,
    grossProfit,
    totalExpenses,
    netProfit,
    profitMarginPercent,
    totalTransactions,
    expenseByCategory,
  };
}

export async function getCashRegisterSummary(date) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  // Payments collected for today's sales
  const paymentBreakdown = await query(
    `SELECT p.payment_method AS method, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p
       JOIN sales s ON p.sale_id = s.id
      WHERE DATE(p.payment_date) = ? AND s.status = 'completed'
      GROUP BY p.payment_method`,
    [targetDate]
  );

  // Cash expenses paid today
  const [cashExpensesRow] = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
      WHERE expense_date = ? AND payment_method = 'cash' AND deleted_at IS NULL`,
    [targetDate]
  );
  const cashExpenses = parseFloat(cashExpensesRow?.total || 0);

  let cashSales = 0;
  let cardSales = 0;
  let bankSales = 0;
  let digitalSales = 0;

  for (const row of paymentBreakdown) {
    const amt = parseFloat(row.total);
    if (row.method === 'cash') cashSales += amt;
    else if (row.method === 'card') cardSales += amt;
    else if (row.method === 'bank_transfer') bankSales += amt;
    else digitalSales += amt;
  }

  // Estimated opening cash float from standard operational setting (PKR 10,000)
  const openingFloat = 10000.00;
  const expectedCashInDrawer = openingFloat + cashSales - cashExpenses;

  return {
    date: targetDate,
    openingFloat,
    cashSales,
    cardSales,
    bankSales,
    digitalSales,
    totalSales: cashSales + cardSales + bankSales + digitalSales,
    cashExpenses,
    expectedCashInDrawer,
    paymentBreakdown,
  };
}
