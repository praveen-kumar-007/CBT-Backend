const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const normalizeTenantKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const makeTenantKeySeed = (input) =>
  String(input || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24) || "tenant";

const buildTenantKey = async (baseSeed) => {
  const base = makeTenantKeySeed(baseSeed);

  for (let i = 0; i < 20; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base}-${suffix}`;

    // eslint-disable-next-line no-await-in-loop
    const existing = await User.findOne({
      role: "admin",
      tenantKey: candidate,
    }).select("_id");
    if (!existing) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
};

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  tenantAdmin: user.tenantAdmin || null,
  tenantKey: user.tenantKey || null,
  studentCredential: user.studentCredential || null,
  phone: user.phone || null,
  plan: user.plan || "Enterprise Business",
  studentLimit: user.studentLimit || 0,
});

const registerSuperAdmin = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingSuperAdmins = await User.countDocuments({
      role: "super_admin",
    });
    if (existingSuperAdmins > 0) {
      return res.status(403).json({
        success: false,
        message:
          "Super admin self-signup is disabled. Use an existing super administrator account.",
      });
    }

    const existing = await User.findOne({
      role: { $in: ["super_admin", "admin"] },
      email: email.toLowerCase(),
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    const superAdmin = await User.create({
      name,
      email,
      password,
      phone,
      role: "super_admin",
    });

    const token = generateToken(superAdmin);

    return res.status(201).json({
      success: true,
      message: "Super administrator account created successfully.",
      data: {
        user: serializeUser(superAdmin),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const loginSuperAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const superAdmin = await User.findOne({
      email: email.toLowerCase(),
      role: "super_admin",
    }).select("+password");
    if (!superAdmin) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const isValid = await superAdmin.comparePassword(password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const token = generateToken(superAdmin);

    return res.status(200).json({
      success: true,
      message: "Super admin login successful.",
      data: {
        user: serializeUser(superAdmin),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const registerAdmin = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingAdmins = await User.countDocuments({ role: "admin" });
    if (existingAdmins > 0) {
      return res.status(403).json({
        success: false,
        message:
          "Admin self-signup is disabled. Contact a super administrator.",
      });
    }

    const existing = await User.findOne({
      role: { $in: ["super_admin", "admin"] },
      email: email.toLowerCase(),
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    const tenantKey = await buildTenantKey(name || email);

    const admin = await User.create({
      name,
      email,
      password,
      phone,
      role: "admin",
      tenantKey,
    });

    const token = generateToken(admin);

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully.",
      data: {
        user: serializeUser(admin),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({
      email: email.toLowerCase(),
      role: "admin",
    }).select("+password");
    if (!admin) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const token = generateToken(admin);

    return res.status(200).json({
      success: true,
      message: "Admin login successful.",
      data: {
        user: serializeUser(admin),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const registerStudent = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      studentCredential,
      tenantKey: rawTenantKey,
      organizationCode,
    } = req.body;

    const tenantKey = normalizeTenantKey(rawTenantKey || organizationCode);
    if (!tenantKey) {
      return res
        .status(400)
        .json({ success: false, message: "organizationCode is required." });
    }

    const tenantAdmin = await User.findOne({ role: "admin", tenantKey });
    if (!tenantAdmin) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid organization code." });
    }

    // Enforce Student Limit
    const currentCount = await User.countDocuments({
      role: "student",
      tenantAdmin: tenantAdmin._id,
    });
    if (currentCount >= (tenantAdmin.studentLimit || 0)) {
      return res.status(403).json({
        success: false,
        message: `Student seat limit reached (${tenantAdmin.studentLimit || 0}). Contact your administrator for more seats.`,
      });
    }

    const existing = await User.findOne({
      role: "student",
      tenantAdmin: tenantAdmin._id,
      email: email.toLowerCase(),
    });

    if (existing) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email already registered in this tenant.",
        });
    }

    const student = await User.create({
      name,
      email,
      password,
      studentCredential,
      role: "student",
      tenantAdmin: tenantAdmin._id,
      createdBy: tenantAdmin._id,
    });

    const token = generateToken(student);

    return res.status(201).json({
      success: true,
      message: "Student account created successfully.",
      data: {
        user: serializeUser(student),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const loginStudent = async (req, res, next) => {
  try {
    const {
      email,
      password,
      tenantKey: rawTenantKey,
      organizationCode,
    } = req.body;

    const tenantKey = normalizeTenantKey(rawTenantKey || organizationCode);
    if (!tenantKey) {
      return res
        .status(400)
        .json({ success: false, message: "organizationCode is required." });
    }

    const tenantAdmin = await User.findOne({ role: "admin", tenantKey }).select(
      "_id",
    );
    if (!tenantAdmin) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid organization code." });
    }

    const student = await User.findOne({
      email: email.toLowerCase(),
      role: "student",
      tenantAdmin: tenantAdmin._id,
    }).select("+password");

    if (!student) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const isValid = await student.comparePassword(password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials." });
    }

    const token = generateToken(student);

    return res.status(200).json({
      success: true,
      message: "Student login successful.",
      data: {
        user: serializeUser(student),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createStudentSession = async (req, res, next) => {
  try {
    const {
      loginId,
      password,
      tenantKey: rawTenantKey,
      organizationCode,
    } = req.body;
    const normalizedLoginId = String(loginId || "").trim();
    const tenantKey = normalizeTenantKey(rawTenantKey || organizationCode);

    if (!normalizedLoginId) {
      return res
        .status(400)
        .json({ success: false, message: "Login ID is required." });
    }

    if (!tenantKey) {
      return res
        .status(400)
        .json({ success: false, message: "organizationCode is required." });
    }

    const tenantAdmin = await User.findOne({ role: "admin", tenantKey });
    if (!tenantAdmin) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid organization code." });
    }

    let student = await User.findOne({
      role: "student",
      tenantAdmin: tenantAdmin._id,
      studentCredential: normalizedLoginId,
    });

    if (!student) {
      // Enforce Student Limit for session-based auto-creation
      const currentCount = await User.countDocuments({
        role: "student",
        tenantAdmin: tenantAdmin._id,
      });
      if (currentCount >= (tenantAdmin.studentLimit || 0)) {
        return res.status(403).json({
          success: false,
          message: `Student seat limit reached (${tenantAdmin.studentLimit || 0}). Contact your administrator for more seats.`,
        });
      }

      const safeId = normalizedLoginId
        .toLowerCase()
        .replace(/\s+/g, ".")
        .replace(/[^a-z0-9._-]/g, "");
      const generatedEmail = `${safeId || "student"}-${Date.now()}@${tenantKey}.cbt.local`;

      student = await User.create({
        name: normalizedLoginId,
        email: generatedEmail,
        password: password || `guest-${Date.now()}`,
        studentCredential: normalizedLoginId,
        role: "student",
        tenantAdmin: tenantAdmin._id,
        createdBy: tenantAdmin._id,
      });
    }

    const token = generateToken(student);

    return res.status(200).json({
      success: true,
      message: "Student session started successfully.",
      data: {
        user: serializeUser(student),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerSuperAdmin,
  loginSuperAdmin,
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  createStudentSession,
  buildTenantKey,
};
