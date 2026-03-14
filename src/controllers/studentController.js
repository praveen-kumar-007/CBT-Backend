const mongoose = require('mongoose');
const Question = require('../models/Question');
const Section = require('../models/Section');
const Submission = require('../models/Submission');
const ExamSession = require('../models/ExamSession');
const ExamConfig = require('../models/ExamConfig');

const shuffleArray = (arr) => {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
};

const getSectionsForStudents = async (req, res, next) => {
  try {
    const sections = await Section.find({ isActive: true }).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, data: sections });
  } catch (error) {
    return next(error);
  }
};

const getQuestionsForStudent = async (req, res, next) => {
  try {
    const { sectionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    const section = await Section.findOne({ _id: sectionId, isActive: true });
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found or inactive.' });
    }

    const existingSession = await ExamSession.findOne({
      student: req.user._id,
      section: sectionId
    });

    if (existingSession) {
      if (existingSession.isSubmitted) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted this section.'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          section,
          sessionId: existingSession._id,
          questions: existingSession.servedQuestions.map((q) => ({
            id: String(q.question),
            questionText: q.questionText,
            options: q.shuffledOptions,
            marks: q.marks,
            imageUrl: q.imageUrl
          }))
        }
      });
    }

    const questionDocs = await Question.find({ section: sectionId })
      .select('questionText options marks imageUrl section correctOptionIndex')
      .lean();

    if (!questionDocs.length) {
      return res.status(400).json({ success: false, message: 'No questions found for this section.' });
    }

    const randomizedQuestionDocs = shuffleArray(questionDocs);

    const servedQuestions = randomizedQuestionDocs.map((q) => {
      const optionOrder = shuffleArray([0, 1, 2, 3]);
      const shuffledOptions = optionOrder.map((idx) => q.options[idx]);

      return {
        question: q._id,
        questionText: q.questionText,
        originalOptions: q.options,
        shuffledOptions,
        optionOrder,
        correctOptionIndex: q.correctOptionIndex,
        marks: q.marks,
        imageUrl: q.imageUrl
      };
    });

    const session = await ExamSession.create({
      student: req.user._id,
      section: sectionId,
      servedQuestions,
      isSubmitted: false
    });

    return res.status(200).json({
      success: true,
      data: {
        section,
        sessionId: session._id,
        questions: servedQuestions.map((q) => ({
          id: String(q.question),
          questionText: q.questionText,
          options: q.shuffledOptions,
          marks: q.marks,
          imageUrl: q.imageUrl
        }))
      }
    });
  } catch (error) {
    return next(error);
  }
};

const submitExam = async (req, res, next) => {
  try {
    const { sectionId, sessionId, answers } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid session id.' });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const session = await ExamSession.findOne({
      _id: sessionId,
      student: req.user._id,
      section: sectionId
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found for this student.' });
    }

    if (session.isSubmitted) {
      return res.status(400).json({ success: false, message: 'This section is already submitted.' });
    }

    if (!session.servedQuestions.length) {
      return res.status(400).json({ success: false, message: 'No questions found in exam session.' });
    }

    const providedAnswers = Array.isArray(answers) ? answers : [];
    const servedQuestionIdSet = new Set(session.servedQuestions.map((q) => String(q.question)));
    const answerMap = new Map();

    for (const item of providedAnswers) {
      const questionId = String(item.questionId || '');

      if (!servedQuestionIdSet.has(questionId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid question id in submission: ${questionId}`
        });
      }

      if (answerMap.has(questionId)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate answer entry for question: ${questionId}`
        });
      }

      if (item.selectedOptionIndex !== null && item.selectedOptionIndex !== undefined) {
        const indexValue = Number(item.selectedOptionIndex);
        if (!Number.isInteger(indexValue) || indexValue < 0 || indexValue > 3) {
          return res.status(400).json({
            success: false,
            message: `Invalid selected option index for question: ${questionId}`
          });
        }
        answerMap.set(questionId, indexValue);
      } else {
        answerMap.set(questionId, null);
      }
    }

    let attemptedQuestions = 0;
    let score = 0;
    let maxScore = 0;

    const processedAnswers = session.servedQuestions.map((servedQuestion) => {
      const questionId = String(servedQuestion.question);
      const selectedShuffledIndex = answerMap.has(questionId)
        ? answerMap.get(questionId)
        : null;

      const attempted = selectedShuffledIndex !== null && selectedShuffledIndex !== undefined;
      if (attempted) {
        attemptedQuestions += 1;
      }

      const originalSelectedOptionIndex = attempted
        ? servedQuestion.optionOrder[selectedShuffledIndex]
        : null;

      const isCorrect = attempted && originalSelectedOptionIndex === servedQuestion.correctOptionIndex;
      const marksAwarded = isCorrect ? servedQuestion.marks : 0;
      if (isCorrect) {
        score += servedQuestion.marks;
      }
      maxScore += servedQuestion.marks;

      return {
        question: servedQuestion.question,
        questionText: servedQuestion.questionText,
        options: servedQuestion.originalOptions,
        selectedOptionIndex: attempted ? originalSelectedOptionIndex : null,
        correctOptionIndex: servedQuestion.correctOptionIndex,
        isCorrect,
        marksAwarded
      };
    });

    const submission = await Submission.create({
      student: req.user._id,
      section: sectionId,
      answers: processedAnswers,
      totalQuestions: session.servedQuestions.length,
      attemptedQuestions,
      score,
      maxScore
    });

    session.isSubmitted = true;
    session.submittedAt = new Date();
    await session.save();

    return res.status(201).json({
      success: true,
      message: 'Exam submitted successfully. Score is available to admin only.',
      data: {
        submissionId: submission._id,
        totalQuestions: session.servedQuestions.length,
        attemptedQuestions
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getExamConfigForStudent = async (req, res, next) => {
  try {
    const config = await ExamConfig.findOne({}).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        durationInMinutes: config?.durationInMinutes || 60
      }
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSectionsForStudents,
  getQuestionsForStudent,
  submitExam,
  getExamConfigForStudent
};
