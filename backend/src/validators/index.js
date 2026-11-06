import { body } from 'express-validator';

export const loginValidator = [
  body().custom((value, { req }) => {
    const identifier = req.body.username || req.body.email || req.body.identifier;
    if (!identifier || !identifier.toString().trim()) {
      throw new Error('Username or email is required');
    }
    return true;
  }),
  body('password').notEmpty().withMessage('Password is required'),
];

export const changePasswordValidator = [
  body('oldPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 10 })
    .withMessage('New password must be at least 10 characters long')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter (A-Z)')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter (a-z)')
    .matches(/[0-9]/)
    .withMessage('New password must contain at least one numeric digit (0-9)')
    .matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/)
    .withMessage('New password must contain at least one special character (!@#$%^&*...)'),
];

export const checkoutValidator = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Checkout items must be a non-empty array'),
  body('items.*.medicineId')
    .isInt({ min: 1 })
    .withMessage('Each item must have a valid medicineId'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Each item must have a positive integer quantity'),
];

export const medicineValidator = [
  body('genericName').custom((val, { req }) => {
    const v = val || req.body.generic_name;
    if (!v || !v.toString().trim()) {
      throw new Error('Generic chemical name is required');
    }
    return true;
  }),
  body('brandName').custom((val, { req }) => {
    const v = val || req.body.brand_name;
    if (!v || !v.toString().trim()) {
      throw new Error('Brand / trade name is required');
    }
    return true;
  }),
  body('categoryId').custom((val, { req }) => {
    const v = val || req.body.category_id;
    if (v === undefined || v === null || isNaN(parseInt(v, 10)) || parseInt(v, 10) < 1) {
      throw new Error('Valid therapeutic category ID is required');
    }
    return true;
  }),
  body('dosageFormId').custom((val, { req }) => {
    const v = val || req.body.dosage_form_id;
    if (v === undefined || v === null || isNaN(parseInt(v, 10)) || parseInt(v, 10) < 1) {
      throw new Error('Valid dosage form ID is required');
    }
    return true;
  }),
  body('strength').trim().notEmpty().withMessage('Strength is required'),
];
