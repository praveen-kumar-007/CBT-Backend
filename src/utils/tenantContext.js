const mongoose = require("mongoose");

const getTenantAdminFromUser = (user) => {
  if (!user) {
    return null;
  }

  if (user.role === "admin") {
    return user._id;
  }

  if (user.role === "student") {
    return user.tenantAdmin || null;
  }

  return null;
};

const resolveTenantForAdminRequest = (req, { required = true } = {}) => {
  if (!req.user) {
    return null;
  }

  if (req.user.role === "admin") {
    return req.user._id;
  }

  if (req.user.role !== "super_admin") {
    return null;
  }

  const headerValue =
    req.headers["x-organization-admin-id"] || req.headers["x-tenant-admin-id"];
  const queryValue = req.query.organizationAdminId || req.query.tenantAdminId;
  const tenantAdminId = String(headerValue || queryValue || "").trim();

  if (!tenantAdminId) {
    if (!required) {
      return null;
    }

    const error = new Error(
      "Super admin must select an organization admin context.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(tenantAdminId)) {
    const error = new Error(
      "Invalid organization admin id in request context.",
    );
    error.statusCode = 400;
    throw error;
  }

  return new mongoose.Types.ObjectId(tenantAdminId);
};

const ensureSuperAdmin = (req) => {
  if (!req.user || req.user.role !== "super_admin") {
    const error = new Error(
      "Only super administrators can perform this action.",
    );
    error.statusCode = 403;
    throw error;
  }
};

module.exports = {
  getTenantAdminFromUser,
  resolveTenantForAdminRequest,
  ensureSuperAdmin,
};
