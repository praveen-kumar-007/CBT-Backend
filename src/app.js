const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");

const app = express();
const configuredOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://examindo.vercel.app",
  "https://exam.indocreonix.com",
];

const wildcardOrigins = configuredOrigins.filter((origin) =>
  origin.includes("*"),
);
const exactOrigins = configuredOrigins.filter(
  (origin) => !origin.includes("*"),
);
const allowedOrigins = [...new Set([...exactOrigins, ...defaultOrigins])];

const originPatternToRegExp = (pattern) =>
  new RegExp(
    "^" +
      pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*") +
      "$",
    "i",
  );

const isOriginAllowed = (origin) => {
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (
    wildcardOrigins.some((pattern) =>
      originPatternToRegExp(pattern).test(origin),
    )
  ) {
    return true;
  }

  return false;
};

const adminFrontendBase =
  process.env.FRONTEND_ADMIN_URL ||
  allowedOrigins[0] ||
  "http://localhost:3000";

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Allow-Origin",
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.options("/*", cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/public", express.static(path.join(__dirname, "..", "public")));

app.get("/admin/login", (req, res) => {
  res.redirect(`${adminFrontendBase}/admin/login`);
});

app.get("/admin/super-admin/login", (req, res) => {
  res.redirect(`${adminFrontendBase}/admin/super-admin/login`);
});

app.get("/admin/dashboard", (req, res) => {
  res.redirect(`${adminFrontendBase}/admin/dashboard`);
});

app.get("/admin", (req, res) => {
  res.redirect("/admin/login");
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CBT backend is running.",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      admin: "/api/admin",
      student: "/api/student",
      adminLoginShortcut: "/admin/login",
      superAdminLoginShortcut: "/admin/super-admin/login",
      adminDashboardShortcut: "/admin/dashboard",
      frontendAdminBase: adminFrontendBase,
    },
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Healthy" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/student", studentRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
