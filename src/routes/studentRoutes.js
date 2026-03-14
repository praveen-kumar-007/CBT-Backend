const express = require('express');
const { body, param } = require('express-validator');
const {
  getSectionsForStudents,
  getQuestionsForStudent,
  submitExam,
  getExamConfigForStudent
} = require('../controllers/studentController');
const { protect, allowRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = express.Router();

router.use(protect, allowRoles('student'));

router.get('/exam-config', getExamConfigForStudent);

router.get('/sections', getSectionsForStudents);

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
    validateRequest
  ],
  submitExam
);

module.exports = router;
