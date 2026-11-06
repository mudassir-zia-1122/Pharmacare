import { query } from '../config/db.js';

export async function getDashboardSummary() {
  // Query summary metrics, alerts, and tables in parallel
  const [
    totalMedsRows,
    todaySalesRows,
    lowStockRows,
    nearExpiryRows,
    suppliersRows,
    customersRows,
    recentSalesRows,
    salesTrendRows,
    stockSummaryRows,
    inquiryStatsRows,
    recentInquiriesRows,
    lowStockAlertsRows,
    nearExpiryAlertsRows,
    categoryBreakdownRows,
  ] = await Promise.all([
    query('SELECT COUNT(*) AS total FROM medicines WHERE deleted_at IS NULL AND status = "active"'),
    query(`SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue
             FROM sales
            WHERE DATE(sale_timestamp) = CURRENT_DATE AND status IN ("completed", "partially_returned")`),
    query('SELECT COUNT(*) AS count FROM v_low_stock_alerts'),
    query('SELECT COUNT(*) AS count FROM v_near_expiry_batches'),
    query('SELECT COUNT(*) AS count FROM suppliers WHERE status = "active"'),
    query('SELECT COUNT(*) AS count FROM customers WHERE deleted_at IS NULL'),
    query(`SELECT s.id, s.invoice_number AS invoiceNumber, COALESCE(c.name, 'Walk-in') AS customer,
                  s.total_amount AS total, u.full_name AS cashier,
                  DATE_FORMAT(s.sale_timestamp, '%H:%i') AS time,
                  (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS items
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             JOIN users u ON s.cashier_user_id = u.id
            ORDER BY s.sale_timestamp DESC, s.id DESC
            LIMIT 5`),
    query(`SELECT DATE_FORMAT(sale_timestamp, '%b %e') AS date,
                  COALESCE(SUM(total_amount), 0) AS revenue,
                  COUNT(*) AS count
             FROM sales
            WHERE sale_timestamp >= DATE_SUB(CURRENT_DATE, INTERVAL 14 DAY)
              AND status IN ("completed", "partially_returned")
            GROUP BY DATE(sale_timestamp), DATE_FORMAT(sale_timestamp, '%b %e')
            ORDER BY DATE(sale_timestamp) ASC`),
    query(`SELECT
             COALESCE(SUM(CASE WHEN status = 'active' AND expiry_date > CURRENT_DATE THEN quantity_on_hand ELSE 0 END), 0) AS saleableUnits,
             COALESCE(SUM(CASE WHEN status != 'active' OR expiry_date <= CURRENT_DATE THEN quantity_on_hand ELSE 0 END), 0) AS blockedUnits,
             COALESCE(SUM(quantity_on_hand), 0) AS totalStockUnits
             FROM batches`),
    query(`SELECT
             COUNT(*) AS totalInquiries,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pendingInquiries,
             COALESCE(SUM(CASE WHEN status IN ('pending', 'in_review') THEN 1 ELSE 0 END), 0) AS pendingResponses
             FROM doctor_inquiries`),
    query(`SELECT id, reference_no AS referenceNo, doctor_name AS doctorName,
                  clinic_hospital_name AS clinicHospitalName, email, status,
                  email_status AS emailStatus, created_at AS createdAt
             FROM doctor_inquiries
            ORDER BY created_at DESC
            LIMIT 5`),
    query(`SELECT medicine_id AS id, generic_name AS genericName, brand_name AS brandName,
                  strength, strength_unit AS strengthUnit, dosage_form AS dosageForm,
                  total_stock_on_hand AS stock, reorder_level AS reorderLevel,
                  deficit_quantity AS deficit
             FROM v_low_stock_alerts
            LIMIT 6`),
    query(`SELECT batch_id AS id, batch_number AS batchNumber, generic_name AS genericName,
                  brand_name AS brandName, quantity_on_hand AS quantity,
                  DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiryDate,
                  days_until_expiry AS daysUntilExpiry
             FROM v_near_expiry_batches
            LIMIT 6`),
    query(`SELECT c.name, COUNT(m.id) AS medicineCount
             FROM categories c
             LEFT JOIN medicines m ON m.category_id = c.id AND m.deleted_at IS NULL
            GROUP BY c.id, c.name
            ORDER BY medicineCount DESC
            LIMIT 6`),
  ]);

  return {
    stats: {
      totalMedicines: totalMedsRows[0]?.total || 0,
      todayRevenue: parseFloat(todaySalesRows[0]?.revenue || 0),
      todaySales: todaySalesRows[0]?.count || 0,
      lowStockCount: lowStockRows[0]?.count || 0,
      nearExpiryCount: nearExpiryRows[0]?.count || 0,
      totalSuppliers: suppliersRows[0]?.count || 0,
      totalCustomers: customersRows[0]?.count || 0,
      totalStockUnits: parseInt(stockSummaryRows[0]?.totalStockUnits || 0, 10),
      saleableStockUnits: parseInt(stockSummaryRows[0]?.saleableUnits || 0, 10),
      blockedStockUnits: parseInt(stockSummaryRows[0]?.blockedUnits || 0, 10),
      totalInquiries: parseInt(inquiryStatsRows[0]?.totalInquiries || 0, 10),
      pendingInquiries: parseInt(inquiryStatsRows[0]?.pendingInquiries || 0, 10),
      pendingResponses: parseInt(inquiryStatsRows[0]?.pendingResponses || 0, 10),
    },
    recentSales: recentSalesRows || [],
    salesTrend: salesTrendRows || [],
    recentInquiries: recentInquiriesRows || [],
    lowStockAlerts: lowStockAlertsRows || [],
    nearExpiryAlerts: nearExpiryAlertsRows || [],
    categoryBreakdown: categoryBreakdownRows || [],
  };
}

export default {
  getDashboardSummary,
};
