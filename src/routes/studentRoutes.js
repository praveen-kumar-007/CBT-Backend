const express = require('express');
const { body, param } = require('express-validator');
const {
  getSectionsForStudents,
  getQuestionsForStudent,
  submitExam,
  getExamConfigForStudent,
  saveExamProgress,
} = require('../controllers/studentController');
const { protect, allowRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

router.use(protect, allowRoles('student'));

router.get('/exam-config', getExamConfigForStudent);

router.get('/sections', getSectionsForStudents);

router.put(
  '/sessions/:sessionId/progress',
  [
    param('sessionId').isMongoId().withMessage('Valid session id is required.'),
    body('answers')
      .isArray()
      .withMessage('Answers must be an array.'),
    body('answers.*.questionId')
      .optional()
      .isMongoId()
      .withMessage('Valid question id is required.'),
    body('answers.*.selectedOptionIndex')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 3 })
      .withMessage('selectedOptionIndex must be 0 to 3.'),
    body('examMeta')
      .optional()
      .isObject()
      .withMessage('examMeta must be an object.'),
    body('examMeta.questionInteractions')
      .optional()
      .isArray()
      .withMessage('examMeta.questionInteractions must be an array.'),
    body('examMeta.totalOptionChanges')
      .optional()
      .isInt({ min: 0 })
      .withMessage('examMeta.totalOptionChanges must be a non-negative integer.'),
    body('examMeta.cheatingAttempts')
      .optional()
      .isInt({ min: 0 })
      .withMessage('examMeta.cheatingAttempts must be a non-negative integer.'),
    validateRequest,
  ],
  saveExamProgress,
);

router.get(
  '/questions/section/:sectionId',
  [param('sectionId').isMongoId().withMessage('Valid section id is required.'), validateRequest],
  getQuestionsForStudent
);

router.post(
  '/submit',
  [
    body('sectionId').isMongoId().withMessage('Valid section id is required.'),
    body('sessionId').isMongoId().withMessage('Valid session id is required.'),
    body('answers').isArray().withMessage('Answers must be an array.'),
    body('answers.*.questionId').isMongoId().withMessage('Valid question id is required.'),
    body('answers.*.selectedOptionIndex')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 3 })
      .withMessage('selectedOptionIndex must be 0 to 3.'),
    body('remark')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 400 })
      .withMessage('remark must be a string up to 400 characters.'),
    body('examMeta')
      .optional()
      .isObject()
      .withMessage('examMeta must be an object.'),
    body('examMeta.terminatedDueToCheating')
      .optional()
      .isBoolean()
      .withMessage('examMeta.terminatedDueToCheating must be boolean.'),
    body('examMeta.terminationRemark')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 400 })
      .withMessage('examMeta.terminationRemark must be a string up to 400 characters.'),
    body('examMeta.cheatingAttempts')
      .optional()
      .isInt({ min: 0, max: 1000 })
      .withMessage('examMeta.cheatingAttempts must be a non-negative integer.'),
    body('examMeta.totalOptionChanges')
      .optional()
      .isInt({ min: 0, max: 10000 })
      .withMessage('examMeta.totalOptionChanges must be a non-negative integer.'),
    body('examMeta.questionInteractions')
      .optional()
      .isArray({ max: 500 })
      .withMessage('examMeta.questionInteractions must be an array.'),
    body('examMeta.questionInteractions.*.questionId')
      .optional()
      .isMongoId()
      .withMessage('questionInteractions questionId must be a valid question id.'),
    body('examMeta.questionInteractions.*.firstSelectedOptionIndex')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 3 })
      .withMessage('firstSelectedOptionIndex must be 0 to 3.'),
    body('examMeta.questionInteractions.*.finalSelectedOptionIndex')
      .optional({ nullable: true })
      .isInt({ min: 0, max: 3 })
      .withMessage('finalSelectedOptionIndex must be 0 to 3.'),
    body('examMeta.questionInteractions.*.changeCount')
      .optional()
      .isInt({ min: 0, max: 1000 })
      .withMessage('changeCount must be a non-negative integer.'),
    body('examMeta.questionInteractions.*.selectionHistory')
      .optional()
      .isArray({ max: 1000 })
      .withMessage('selectionHistory must be an array.'),
    body('examMeta.questionInteractions.*.selectionHistory.*')
      .optional()
      .isInt({ min: 0, max: 3 })
      .withMessage('selectionHistory option index must be 0 to 3.'),
    validateRequest
  ],
  submitExam
);

module.exports = router;
