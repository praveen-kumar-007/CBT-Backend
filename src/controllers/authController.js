const User = require('../models/User');
const generateToken = require('../utils/generateToken');

const registerAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    const token = generateToken(admin);

    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully.',
      data: {
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        },
        token
      }
    });
  } catch (error) {
    return next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken(admin);

    return res.status(200).json({
      success: true,
      message: 'Admin login successful.',
      data: {
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        },
        token
      }
    });
  } catch (error) {
    return next(error);
  }
};

const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password, studentCredential } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const student = await User.create({
      name,
      email,
      password,
      studentCredential,
      role: 'student'
    });

    const token = generateToken(student);

    return res.status(201).json({
      success: true,
      message: 'Student account created successfully.',
      data: {
        user: {
          id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          studentCredential: student.studentCredential
        },
        token
      }
    });
  } catch (error) {
    return next(error);
  }
};

const loginStudent = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const student = await User.findOne({ email: email.toLowerCase(), role: 'student' }).select('+password');
    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isValid = await student.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken(student);

    return res.status(200).json({
      success: true,
      message: 'Student login successful.',
      data: {
        user: {
          id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          studentCredential: student.studentCredential
        },
        token
      }
    });
  } catch (error) {
    return next(error);
  }
};

const createStudentSession = async (req, res, next) => {
  try {
    const { loginId, password } = req.body;
    const normalizedLoginId = String(loginId || '').trim();

    if (!normalizedLoginId) {
      return res.status(400).json({ success: false, message: 'Login ID is required.' });
    }

    let student = await User.findOne({ role: 'student', studentCredential: normalizedLoginId });

    if (!student) {
      const safeId = normalizedLoginId
        .toLowerCase()
        .replace(/\s+/g, '.')
        .replace(/[^a-z0-9._-]/g, '');
      const generatedEmail = `${safeId || 'student'}-${Date.now()}@guest.cbt.local`;

      student = await User.create({
        name: normalizedLoginId,
        email: generatedEmail,
        password: password || `guest-${Date.now()}`,
        studentCredential: normalizedLoginId,
        role: 'student'
      });
    }

    const token = generateToken(student);

    return res.status(200).json({
      success: true,
      message: 'Student session started successfully.',
      data: {
        user: {
          id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          studentCredential: student.studentCredential
        },
        token
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  registerStudent,
  loginStudent,
  createStudentSession
};
