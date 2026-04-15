const User = require("../models/User");

/**
 * When a super admin sends `x-demo-paper: 1`, resolve the fixed demo org admin id
 * so admin APIs can target the demo tenant without selecting an organization context.
 */
const attachDemoPaperTenant = async (req, res, next) => {
  req.demoPaperTenantId = undefined;
  req.demoPaperMissing = false;

  if (!req.user || req.user.role !== "super_admin") {
    return next();
  }

  const raw = req.headers["x-demo-paper"];
  const wantsDemo = raw === "1" || raw === "true";
  if (!wantsDemo) {
    return next();
  }

  try {
    const demo = await User.findOne({ role: "admin", tenantKey: "demo" })
      .select("_id")
      .lean();

    if (!demo) {
      req.demoPaperMissing = true;
      return next();
    }

    req.demoPaperTenantId = demo._id;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { attachDemoPaperTenant };
