const express = require('express');
const { body } = require('express-validator');
const {
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  createStudentSession
} = require('../controllers/authController');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

const commonEmailValidation = body('email').isEmail().withMessage('Valid email is required.');
const commonPasswordValidation = body('password')
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters.');

router.post(
  '/admin/signup',
  [
    body('name').notEmpty().withMessage('Admin name is required.'),
    commonEmailValidation,
    commonPasswordValidation,
    validateRequest
  ],
  registerAdmin
);

router.post(
  '/admin/login',
  [commonEmailValidation, commonPasswordValidation, validateRequest],
  loginAdmin
);

router.post(
  '/student/signup',
  [
    body('name').notEmpty().withMessage('Student name is required.'),
    commonEmailValidation,
    commonPasswordValidation,
    body('studentCredential')
      .notEmpty()
      .withMessage('Student credential (mobile/roll number) is required.'),
    validateRequest
  ],
  registerStudent
);

router.post(
  '/student/login',
  [commonEmailValidation, commonPasswordValidation, validateRequest],
  loginStudent
);

router.post(
  '/student/session',
  [
    body('loginId').notEmpty().withMessage('Login ID is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
    validateRequest
  ],
  createStudentSession
);

module.exports = router;
