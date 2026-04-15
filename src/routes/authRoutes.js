const express = require("express");
const { body } = require("express-validator");
const {
  loginSuperAdmin,
  loginAdmin,
  loginStudent,
  createStudentSession,
  createDemoGuestSession,
} = require("../controllers/authController");
const validateRequest = require("../middlewares/validateRequest");

const router = express.Router();

const commonEmailValidation = body("email")
  .isEmail()
  .withMessage("Valid email is required.");
const commonPasswordValidation = body("password")
  .isLength({ min: 6 })
  .withMessage("Password must be at least 6 characters.");

router.post(
  "/super-admin/login",
  [commonEmailValidation, commonPasswordValidation, validateRequest],
  loginSuperAdmin,
);

router.post(
  "/admin/login",
  [commonEmailValidation, commonPasswordValidation, validateRequest],
  loginAdmin,
);

router.post(
  "/student/login",
  [
    commonEmailValidation,
    commonPasswordValidation,
    body("organizationCode")
      .optional()
      .isString()
      .withMessage("organizationCode must be a string."),
    body("tenantKey")
      .optional()
      .isString()
      .withMessage("tenantKey must be a string."),
    body().custom((value) => {
      const hasCode = Boolean(value?.organizationCode || value?.tenantKey);
      if (!hasCode) {
        throw new Error("organizationCode is required.");
      }
      return true;
    }),
    validateRequest,
  ],
  loginStudent,
);

router.post("/student/demo-session", createDemoGuestSession);

router.post(
  "/student/session",
  [
    body("loginId").notEmpty().withMessage("Login ID is required."),
    body("organizationCode")
      .optional()
      .isString()
      .withMessage("organizationCode must be a string."),
    body("tenantKey")
      .optional()
      .isString()
      .withMessage("tenantKey must be a string."),
    body().custom((value) => {
      const hasCode = Boolean(value?.organizationCode || value?.tenantKey);
      if (!hasCode) {
        throw new Error("organizationCode is required.");
      }
      return true;
    }),
    body("password").notEmpty().withMessage("Password is required."),
    validateRequest,
  ],
  createStudentSession,
);

module.exports = router;
