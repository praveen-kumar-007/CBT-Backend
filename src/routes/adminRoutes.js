const express = require('express');
const multer = require('multer');
const { body, param } = require('express-validator');
const {
  createSection,
  getSections,
  updateSection,
  deleteSection,
  createQuestion,
  getQuestionsBySectionForAdmin,
  updateQuestion,
  deleteQuestion,
  getAllStudents,
  getStudentSubmissions,
  deleteStudent,
  resetAllStudentsData,
  getAnalytics,
  getRecentSubmissions,
  exportStudentSubmissionsCsv,
  exportAllSubmissionsDetailedCsv,
  getExamConfig,
  updateExamConfig
} = require('../controllers/adminController');
const { protect, allowRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(protect, allowRoles('admin'));

router.get('/analytics', getAnalytics);
router.get('/submissions/recent', getRecentSubmissions);
router.get('/submissions/export/detailed', exportAllSubmissionsDetailedCsv);
router.get('/exam-config', getExamConfig);

router.put(
  '/exam-config',
  [
    body('durationInMinutes')
      .isInt({ min: 1, max: 600 })
      .withMessage('durationInMinutes must be between 1 and 600.'),
    body('examinerName')
      .optional()
      .isString()
      .isLength({ min: 2, max: 120 })
      .withMessage('examinerName must be 2 to 120 characters.'),
    validateRequest
  ],
  updateExamConfig
);

router.post(
  '/sections',
  [
    body('name').notEmpty().withMessage('Section name is required.'),
    body('description').optional().isString(),
    validateRequest
  ],
  createSection
);

router.get('/sections', getSections);

router.put(
  '/sections/:sectionId',
  [
    param('sectionId').isMongoId().withMessage('Valid section id is required.'),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('isActive').optional().isBoolean(),
    validateRequest
  ],
  updateSection
);

router.delete(
  '/sections/:sectionId',
  [param('sectionId').isMongoId().withMessage('Valid section id is required.'), validateRequest],
  deleteSection
);

router.post(
  '/questions',
  upload.single('questionImage'),
  [
    body('section').isMongoId().withMessage('Valid section id is required.'),
    body('questionText').notEmpty().withMessage('Question text is required.'),
    body('options').isArray({ min: 4, max: 4 }).withMessage('Exactly 4 options are required.'),
    body('options.*').isString().withMessage('Each option must be a string.'),
    body('correctOptionIndex').isInt({ min: 0, max: 3 }).withMessage('correctOptionIndex must be 0 to 3.'),
    body('marks').optional().isInt({ min: 1 }).withMessage('Marks must be at least 1.'),
    validateRequest
  ],
  createQuestion
);

router.get(
  '/questions/section/:sectionId',
  [param('sectionId').isMongoId().withMessage('Valid section id is required.'), validateRequest],
  getQuestionsBySectionForAdmin
);

router.put(
  '/questions/:questionId',
  upload.single('questionImage'),
  [
    param('questionId').isMongoId().withMessage('Valid question id is required.'),
    body('section').optional().isMongoId().withMessage('Valid section id is required.'),
    body('questionText').optional().isString(),
    body('options').optional().isArray({ min: 4, max: 4 }).withMessage('Exactly 4 options are required.'),
    body('options.*').optional().isString().withMessage('Each option must be a string.'),
    body('correctOptionIndex').optional().isInt({ min: 0, max: 3 }),
    body('marks').optional().isInt({ min: 1 }),
    validateRequest
  ],
  updateQuestion
);

router.delete(
  '/questions/:questionId',
  [param('questionId').isMongoId().withMessage('Valid question id is required.'), validateRequest],
  deleteQuestion
);

router.get('/students', getAllStudents);

router.delete('/students/reset-all', resetAllStudentsData);

router.get(
  '/students/:studentId/submissions',
  [param('studentId').isMongoId().withMessage('Valid student id is required.'), validateRequest],
  getStudentSubmissions
);

router.get(
  '/students/:studentId/submissions/export',
  [param('studentId').isMongoId().withMessage('Valid student id is required.'), validateRequest],
  exportStudentSubmissionsCsv
);

router.delete(
  '/students/:studentId',
  [param('studentId').isMongoId().withMessage('Valid student id is required.'), validateRequest],
  deleteStudent
);

module.exports = router;
