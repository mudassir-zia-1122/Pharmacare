import * as financeService from '../services/finance.service.js';

export async function getExpenses(req, res, next) {
  try {
    const result = await financeService.getExpenses(req.query);
    res.json({
      success: true,
      data: result.items,
      totalAmount: result.totalAmount,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getExpenseById(req, res, next) {
  try {
    const expense = await financeService.getExpenseById(req.params.id);
    res.json({
      success: true,
      data: expense,
    });
  } catch (err) {
    next(err);
  }
}

export async function createExpense(req, res, next) {
  try {
    const expense = await financeService.createExpense(req.body, req.user?.id);
    res.status(201).json({
      success: true,
      data: expense,
      message: 'Expense recorded successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req, res, next) {
  try {
    const expense = await financeService.updateExpense(req.params.id, req.body, req.user?.id);
    res.json({
      success: true,
      data: expense,
      message: 'Expense updated successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req, res, next) {
  try {
    const result = await financeService.deleteExpense(req.params.id, req.user?.id);
    res.json({
      success: true,
      data: result,
      message: 'Expense deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getFinancialSummary(req, res, next) {
  try {
    const summary = await financeService.getFinancialSummary(req.query);
    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCashRegister(req, res, next) {
  try {
    const register = await financeService.getCashRegisterSummary(req.query.date);
    res.json({
      success: true,
      data: register,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDailySummary(req, res, next) {
  try {
    const targetDate = req.query.date || new Date().toISOString().slice(0, 10);
    const register = await financeService.getCashRegisterSummary(targetDate);
    const summary = await financeService.getFinancialSummary({ startDate: targetDate, endDate: targetDate });
    res.json({
      success: true,
      data: {
        ...register,
        financials: summary,
      },
    });
  } catch (err) {
    next(err);
  }
}
