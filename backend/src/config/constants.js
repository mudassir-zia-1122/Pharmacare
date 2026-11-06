// =============================================================================
// PharmaCare Backend Constants
// =============================================================================

export const ROLES = {
  ADMIN: 'admin',
  PHARMACIST: 'pharmacist',
  STOCK_MANAGER: 'stock_manager',
  CASHIER: 'cashier',
  DOCTOR: 'doctor',
  RECEPTION: 'reception',
};

export const APPOINTMENT_STATUS = {
  BOOKED: 'booked',
  CHECKED_IN: 'checked_in',
  WAITING: 'waiting',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
  RESCHEDULED: 'rescheduled',
};

export const APPOINTMENT_TYPE = {
  ONLINE: 'online',
  WALK_IN: 'walk_in',
  EMERGENCY: 'emergency',
};

export const PRIORITY_LEVEL = {
  NORMAL: 'normal',
  EMERGENCY: 'emergency',
};

export const TOKEN_STATUS = {
  ISSUED: 'issued',
  CALLING: 'calling',
  SERVING: 'serving',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
};

export const DOCTOR_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_LEAVE: 'on_leave',
};

export const BATCH_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  RECALLED: 'recalled',
  QUARANTINED: 'quarantined',
  EXHAUSTED: 'exhausted',
};

export const MOVEMENT_TYPES = {
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  SALE_DISPENSE: 'SALE_DISPENSE',
  SALE_RETURN: 'SALE_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
  DAMAGE_DISPOSAL: 'DAMAGE_DISPOSAL',
  EXPIRED_WRITE_OFF: 'EXPIRED_WRITE_OFF',
  AUDIT_ADJUSTMENT: 'AUDIT_ADJUSTMENT',
};

export const RETURN_TYPES = {
  SALE_RETURN: 'SALE_RETURN',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
};

export const RESTOCK_ACTIONS = {
  RESTOCK_ACTIVE: 'RESTOCK_ACTIVE',
  QUARANTINE_DAMAGED: 'QUARANTINE_DAMAGED',
  DISPOSE_EXPIRED: 'DISPOSE_EXPIRED',
};

export const PRESCRIPTION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  DISPENSED: 'dispensed',
  CANCELLED: 'cancelled',
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
