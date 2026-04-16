const mongoose = require("mongoose");
const Question = require("../models/Question");
const Section = require("../models/Section");
const Submission = require("../models/Submission");
const ExamSession = require("../models/ExamSession");
const ExamConfig = require("../models/ExamConfig");
const { getTenantAdminFromUser } = require("../utils/tenantContext");

const shuffleArray = (arr) => {
  const copied = [...arr];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
};

const toSafeInt = (value, min = 0) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    return min;
  }
  return parsed;
};

const toOriginalOptionIndex = (servedQuestion, shuffledIndex) => {
  if (
    !Number.isInteger(shuffledIndex) ||
    shuffledIndex < 0 ||
    shuffledIndex > 3
  ) {
    return null;
  }
  const mapped = servedQuestion.optionOrder?.[shuffledIndex];
  return Number.isInteger(mapped) && mapped >= 0 && mapped <= 3 ? mapped : null;
};

const getSectionsForStudents = async (req, res, next) => {
  try {
    const tenantAdmin = getTenantAdminFromUser(req.user);
    const sections = await Section.find({ tenantAdmin, isActive: true }).sort({
      createdAt: 1,
    });
    return res.status(200).json({ success: true, data: sections });
  } catch (error) {
    return next(error);
  }
};

const getQuestionsForStudent = async (req, res, next) => {
  try {
    const tenantAdmin = getTenantAdminFromUser(req.user);
    const { sectionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid section id." });
    }

    const section = await Section.findOne({
      _id: sectionId,
      tenantAdmin,
      isActive: true,
    });
    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found or inactive." });
    }

    const config = await ExamConfig.findOne({ tenantAdmin });
    const now = new Date();
    if (config?.startAt && now < config.startAt) {
      return res.status(403).json({
        success: false,
        message: `Exam access opens at ${config.startAt.toISOString()}. Please try again after the scheduled start time.`,
      });
    }
    if (config?.forceEndedAt && now >= config.forceEndedAt) {
      return res.status(403).json({
        success: false,
        message:
          "The scheduled exam period has ended. Contact your administrator for more information.",
      });
    }

    const existingSession = await ExamSession.findOne({
      tenantAdmin,
      student: req.user._id,
      section: sectionId,
    });

    if (existingSession) {
      if (existingSession.isSubmitted) {
        return res.status(400).json({
          success: false,
          message: "You have already submitted this section.",
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
            imageUrl: q.imageUrl,
          })),
          progressAnswers: (existingSession.progressAnswers || []).map(
            (item) => ({
              questionId: String(item.question),
              selectedOptionIndex:
                item.selectedOptionIndex !== undefined
                  ? item.selectedOptionIndex
                  : null,
            }),
          ),
        },
      });
    }

    const questionDocs = await Question.find({
      tenantAdmin,
      section: sectionId,
    })
      .select("questionText options marks imageUrl section correctOptionIndex")
      .lean();

    if (!questionDocs.length) {
      return res.status(400).json({
        success: false,
        message: "No questions found for this section.",
      });
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
        imageUrl: q.imageUrl,
      };
    });

    const session = await ExamSession.create({
      tenantAdmin,
      student: req.user._id,
      section: sectionId,
      servedQuestions,
      isSubmitted: false,
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
          imageUrl: q.imageUrl,
        })),
        progressAnswers: [],
      },
    });
  } catch (error) {
    return next(error);
  }
};

const saveExamProgress = async (req, res, next) => {
  try {
    const tenantAdmin = getTenantAdminFromUser(req.user);
    const { sessionId } = req.params;
    const { answers, examMeta } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid session id." });
    }

    const session = await ExamSession.findOne({
      _id: sessionId,
      tenantAdmin,
      student: req.user._id,
      isSubmitted: false,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Active exam session not found.",
      });
    }

    const config = await ExamConfig.findOne({ tenantAdmin });
    const now = new Date();
    if (config?.startAt && now < config.startAt) {
      return res.status(403).json({
        success: false,
        message: `Exam access opens at ${config.startAt.toISOString()}.`,
      });
    }
    if (config?.forceEndedAt && now >= config.forceEndedAt) {
      return res.status(403).json({
        success: false,
        message: "The exam has ended and progress can no longer be updated.",
      });
    }

    const validQuestionIds = new Set(
      session.servedQuestions.map((q) => String(q.question)),
    );

    const newProgressMap = new Map(
      (session.progressAnswers || []).map((item) => [
        String(item.question),
        item,
      ]),
    );

    for (const item of answers) {
      const questionId = String(item.questionId || "");
      if (!validQuestionIds.has(questionId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid question id in progress update: ${questionId}`,
        });
      }

      if (
        item.selectedOptionIndex === null ||
        item.selectedOptionIndex === undefined
      ) {
        newProgressMap.delete(questionId);
      } else {
        newProgressMap.set(questionId, {
          question: questionId,
          selectedOptionIndex: item.selectedOptionIndex,
          lastUpdatedAt: new Date(),
        });
      }
    }

    session.progressAnswers = Array.from(newProgressMap.values());
    const normalizeQuestionInteractions = (rawInteractions) => {
      const normalized = [];
      const seenQuestionIds = new Set();

      const servedQuestionMap = new Map(
        session.servedQuestions.map((q) => [String(q.question), q]),
      );

      if (!Array.isArray(rawInteractions)) {
        return [];
      }

      for (const interaction of rawInteractions) {
        const questionId = String(interaction?.questionId || interaction?.question || "");
        if (!questionId || seenQuestionIds.has(questionId)) {
          continue;
        }

        const servedQuestion = servedQuestionMap.get(questionId);
        if (!servedQuestion) {
          continue;
        }

        const rawHistory = Array.isArray(interaction?.selectionHistory)
          ? interaction.selectionHistory
          : [];

        const selectionHistory = rawHistory
          .map((idx) => toOriginalOptionIndex(servedQuestion, Number(idx)))
          .filter((idx) => idx !== null);

        const firstMapped = toOriginalOptionIndex(
          servedQuestion,
          Number(interaction?.firstSelectedOptionIndex),
        );
        const finalMapped = toOriginalOptionIndex(
          servedQuestion,
          Number(interaction?.finalSelectedOptionIndex),
        );

        normalized.push({
          question: servedQuestion.question,
          firstSelectedOptionIndex:
            firstMapped !== null
              ? firstMapped
              : selectionHistory.length
                ? selectionHistory[0]
                : null,
          finalSelectedOptionIndex:
            finalMapped !== null
              ? finalMapped
              : selectionHistory.length
                ? selectionHistory[selectionHistory.length - 1]
                : null,
          changeCount: toSafeInt(interaction?.changeCount, 0),
          selectionHistory,
        });

        seenQuestionIds.add(questionId);
      }

      return normalized;
    };

    const normalizeSecurityEvents = (rawEvents) => {
      if (!Array.isArray(rawEvents)) return session.progressMeta?.securityEvents || [];
      return rawEvents
        .filter((event) => event && typeof event.type === "string")
        .map((event) => ({
          type: event.type,
          message: typeof event.message === "string" ? event.message : String(event.message || ""),
          timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        }));
    };

    session.progressMeta = {
      terminatedDueToCheating:
        Boolean(examMeta?.terminatedDueToCheating) ||
        Boolean(session.progressMeta?.terminatedDueToCheating),
      terminationRemark:
        typeof examMeta?.terminationRemark === "string"
          ? examMeta.terminationRemark
          : session.progressMeta?.terminationRemark || "",
      cheatingAttempts: Number.isInteger(examMeta?.cheatingAttempts)
        ? examMeta.cheatingAttempts
        : session.progressMeta?.cheatingAttempts || 0,
      totalOptionChanges: Number.isInteger(examMeta?.totalOptionChanges)
        ? examMeta.totalOptionChanges
        : session.progressMeta?.totalOptionChanges || 0,
      questionInteractions: normalizeQuestionInteractions(
        examMeta?.questionInteractions || session.progressMeta?.questionInteractions,
      ),
      securityEvents: normalizeSecurityEvents(
        examMeta?.securityEvents || session.progressMeta?.securityEvents,
      ),
    };

    await session.save();

    return res.status(200).json({
      success: true,
      message: "Exam progress saved successfully.",
      data: {
        progressAnswers: session.progressAnswers.map((item) => ({
          questionId: String(item.question),
          selectedOptionIndex:
            item.selectedOptionIndex !== undefined
              ? item.selectedOptionIndex
              : null,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const submitExam = async (req, res, next) => {
  try {
    const tenantAdmin = getTenantAdminFromUser(req.user);
    const { sectionId, sessionId, answers, remark, examMeta } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid section id." });
    }

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid session id." });
    }

    const section = await Section.findOne({ _id: sectionId, tenantAdmin });
    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found." });
    }

    const session = await ExamSession.findOne({
      _id: sessionId,
      tenantAdmin,
      student: req.user._id,
      section: sectionId,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Exam session not found for this student.",
      });
    }

    if (session.isSubmitted) {
      return res.status(400).json({
        success: false,
        message: "This section is already submitted.",
      });
    }

    if (!session.servedQuestions.length) {
      return res.status(400).json({
        success: false,
        message: "No questions found in exam session.",
      });
    }

    const providedAnswers = Array.isArray(answers) ? answers : [];
    const servedQuestionIdSet = new Set(
      session.servedQuestions.map((q) => String(q.question)),
    );
    const answerMap = new Map();

    for (const item of providedAnswers) {
      const questionId = String(item.questionId || "");

      if (!servedQuestionIdSet.has(questionId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid question id in submission: ${questionId}`,
        });
      }

      if (answerMap.has(questionId)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate answer entry for question: ${questionId}`,
        });
      }

      if (
        item.selectedOptionIndex !== null &&
        item.selectedOptionIndex !== undefined
      ) {
        const indexValue = Number(item.selectedOptionIndex);
        if (!Number.isInteger(indexValue) || indexValue < 0 || indexValue > 3) {
          return res.status(400).json({
            success: false,
            message: `Invalid selected option index for question: ${questionId}`,
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

    const servedQuestionMap = new Map(
      session.servedQuestions.map((q) => [String(q.question), q]),
    );

    const normalizeQuestionInteractions = () => {
      const rawInteractions = Array.isArray(examMeta?.questionInteractions)
        ? examMeta.questionInteractions
        : Array.isArray(session.progressMeta?.questionInteractions)
          ? session.progressMeta.questionInteractions
          : [];

      const normalized = [];
      const seenQuestionIds = new Set();

      for (const interaction of rawInteractions) {
        const questionId = String(interaction?.questionId || "");
        if (!questionId || seenQuestionIds.has(questionId)) {
          continue;
        }

        const servedQuestion = servedQuestionMap.get(questionId);
        if (!servedQuestion) {
          continue;
        }

        const rawHistory = Array.isArray(interaction?.selectionHistory)
          ? interaction.selectionHistory
          : [];

        const selectionHistory = rawHistory
          .map((idx) => toOriginalOptionIndex(servedQuestion, Number(idx)))
          .filter((idx) => idx !== null);

        const firstMapped = toOriginalOptionIndex(
          servedQuestion,
          Number(interaction?.firstSelectedOptionIndex),
        );
        const finalMapped = toOriginalOptionIndex(
          servedQuestion,
          Number(interaction?.finalSelectedOptionIndex),
        );

        normalized.push({
          question: servedQuestion.question,
          firstSelectedOptionIndex:
            firstMapped !== null
              ? firstMapped
              : selectionHistory.length
                ? selectionHistory[0]
                : null,
          finalSelectedOptionIndex:
            finalMapped !== null
              ? finalMapped
              : selectionHistory.length
                ? selectionHistory[selectionHistory.length - 1]
                : null,
          changeCount: toSafeInt(interaction?.changeCount, 0),
          selectionHistory,
        });

        seenQuestionIds.add(questionId);
      }

      return normalized;
    };

    const processedAnswers = session.servedQuestions.map((servedQuestion) => {
      const questionId = String(servedQuestion.question);
      const selectedShuffledIndex = answerMap.has(questionId)
        ? answerMap.get(questionId)
        : null;

      const attempted =
        selectedShuffledIndex !== null && selectedShuffledIndex !== undefined;
      if (attempted) {
        attemptedQuestions += 1;
      }

      const originalSelectedOptionIndex = attempted
        ? servedQuestion.optionOrder[selectedShuffledIndex]
        : null;

      const isCorrect =
        attempted &&
        originalSelectedOptionIndex === servedQuestion.correctOptionIndex;
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
        marksAwarded,
      };
    });

    const cleanedRemark = typeof remark === "string" ? remark.trim() : "";
    const questionInteractions = normalizeQuestionInteractions();

    const submission = await Submission.create({
      tenantAdmin,
      student: req.user._id,
      section: sectionId,
      answers: processedAnswers,
      totalQuestions: session.servedQuestions.length,
      attemptedQuestions,
      score,
      maxScore,
      remark: cleanedRemark,
      examMeta: {
        terminatedDueToCheating: Boolean(examMeta?.terminatedDueToCheating),
        terminationRemark:
          typeof examMeta?.terminationRemark === "string"
            ? examMeta.terminationRemark.trim()
            : "",
        cheatingAttempts: toSafeInt(examMeta?.cheatingAttempts, 0),
        totalOptionChanges: toSafeInt(examMeta?.totalOptionChanges, 0),
        questionInteractions,
      },
    });

    session.isSubmitted = true;
    session.submittedAt = new Date();
    await session.save();

    return res.status(201).json({
      success: true,
      message: "Exam submitted successfully. Score is available to admin only.",
      data: {
        submissionId: submission._id,
        totalQuestions: session.servedQuestions.length,
        attemptedQuestions,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getExamConfigForStudent = async (req, res, next) => {
  try {
    const tenantAdmin = getTenantAdminFromUser(req.user);
    const config = await ExamConfig.findOne({ tenantAdmin });

    return res.status(200).json({
      success: true,
      data: {
        durationInMinutes: config?.durationInMinutes || 60,
        examinerName: config?.examinerName || "CBT Examination Cell",
        startAt: config?.startAt || null,
        forceEndedAt: config?.forceEndedAt || null,
        autoSubmitAfterTime:
          typeof config?.autoSubmitAfterTime === "boolean"
            ? config.autoSubmitAfterTime
            : true,
        calculatorEnabled: config?.calculatorEnabled ?? false,
        activeCalculatorType: config?.activeCalculatorType || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSectionsForStudents,
  getQuestionsForStudent,
  saveExamProgress,
  submitExam,
  getExamConfigForStudent,
};
