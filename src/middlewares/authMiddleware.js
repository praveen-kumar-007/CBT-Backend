const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401);
      throw new Error('Authorization token is missing.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401);
      throw new Error('User not found for the provided token.');
    }

    req.user = user;
    return next();
  } catch (error) {
    const tokenError = new Error('Invalid or expired token.');
    tokenError.statusCode = 401;
    res.status(401);
    return next(tokenError);
  }
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    const roleError = new Error('You are not allowed to access this resource.');
    roleError.statusCode = 403;
    res.status(403);
    return next(roleError);
  }

  return next();
};

module.exports = {
  protect,
  allowRoles
};
