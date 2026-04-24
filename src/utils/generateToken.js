const jwt = require("jsonwebtoken");

const computeDefaultTokenExpiry = () => {
  const now = new Date();
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const expiryMs =
    Math.max(sixHoursLater.getTime(), midnight.getTime()) - now.getTime();
  return `${Math.ceil(expiryMs / 1000)}s`;
};

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing in environment variables.");
  }

  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || computeDefaultTokenExpiry() },
  );
};

module.exports = generateToken;
