const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const createWindowLimiter = ({ windowMs, maxRequests }) => {
  const buckets = new Map();

  return (key) => {
    const now = Date.now();
    const current = buckets.get(key) || [];
    const recent = current.filter((timestamp) => now - timestamp < windowMs);

    if (recent.length >= maxRequests) {
      buckets.set(key, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((windowMs - (now - recent[0])) / 1000)
      };
    }

    recent.push(now);
    buckets.set(key, recent);
    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  };
};

const analyticsWindowMs = parsePositiveInt(process.env.ADMIN_ANALYTICS_RATE_WINDOW_MS, 60 * 1000);
const analyticsMaxRequests = parsePositiveInt(process.env.ADMIN_ANALYTICS_RATE_MAX_REQUESTS, 60);
const exportWindowMs = parsePositiveInt(process.env.ADMIN_EXPORT_RATE_WINDOW_MS, 10 * 60 * 1000);
const exportMaxRequests = parsePositiveInt(process.env.ADMIN_EXPORT_RATE_MAX_REQUESTS, 10);

const analyticsLimiter = createWindowLimiter({
  windowMs: analyticsWindowMs,
  maxRequests: analyticsMaxRequests
});

const exportLimiter = createWindowLimiter({
  windowMs: exportWindowMs,
  maxRequests: exportMaxRequests
});

const adminAnalyticsAuditLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const payload = {
      event: 'admin_analytics_access',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      adminId: String(req.user?._id || ''),
      adminEmail: req.user?.email || '',
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || ''
    };

    console.info(`[ADMIN_AUDIT] ${JSON.stringify(payload)}`);
  });

  next();
};

const rateLimitBy = (limiter, scope) => (req, res, next) => {
  const key = `${scope}:${String(req.user?._id || 'anonymous')}:${getClientIp(req)}:${req.path}`;
  const check = limiter(key);

  if (!check.allowed) {
    res.setHeader('Retry-After', String(check.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please retry shortly.'
    });
  }

  return next();
};

const adminAnalyticsRateLimit = rateLimitBy(analyticsLimiter, 'analytics');
const adminExportRateLimit = rateLimitBy(exportLimiter, 'export');

module.exports = {
  adminAnalyticsAuditLogger,
  adminAnalyticsRateLimit,
  adminExportRateLimit
};
