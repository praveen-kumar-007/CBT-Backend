const streamifier = require("streamifier");
const mongoose = require("mongoose");
const Question = require("../models/Question");
const Section = require("../models/Section");
const Submission = require("../models/Submission");
const User = require("../models/User");
const ExamConfig = require("../models/ExamConfig");
const ExamSession = require("../models/ExamSession");
const { cloudinary } = require("../config/cloudinary");
const { buildTenantKey } = require("./authController");
const {
  resolveTenantForAdminRequest,
  ensureSuperAdmin,
} = require("../utils/tenantContext");

const uploadBufferToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      },
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

const toTenantObjectId = (value) => {
  if (!value) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(value));
};

const createSection = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const tenantAdmin = resolveTenantForAdminRequest(req);

    const existing = await Section.findOne({ tenantAdmin, name: name.trim() });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Section already exists." });
    }

    const section = await Section.create({ tenantAdmin, name, description });

    return res.status(201).json({
      success: true,
      message: "Section created successfully.",
      data: section,
    });
  } catch (error) {
    return next(error);
  }
};

const getSections = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const sections = await Section.find({ tenantAdmin }).sort({
      createdAt: -1,
    });
    return res.status(200).json({ success: true, data: sections });
  } catch (error) {
    return next(error);
  }
};

const updateSection = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { sectionId } = req.params;
    const { name, description, isActive } = req.body;

    const section = await Section.findOneAndUpdate(
      { _id: sectionId, tenantAdmin },
      { name, description, isActive },
      { new: true, runValidators: true },
    );

    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Section updated successfully.",
      data: section,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteSection = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { sectionId } = req.params;

    const questionCount = await Question.countDocuments({
      tenantAdmin,
      section: sectionId,
    });
    if (questionCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete section with existing questions. Remove questions first.",
      });
    }

    const deleted = await Section.findOneAndDelete({
      _id: sectionId,
      tenantAdmin,
    });
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found." });
    }

    await ExamSession.deleteMany({ tenantAdmin, section: sectionId });

    return res
      .status(200)
      .json({ success: true, message: "Section deleted successfully." });
  } catch (error) {
    return next(error);
  }
};

const createQuestion = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { section, questionText, options, correctOptionIndex, marks } =
      req.body;

    const sectionExists = await Section.findOne({ _id: section, tenantAdmin });
    if (!sectionExists) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found." });
    }

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(
        req.file.buffer,
        "cbt/questions",
      );
      imageUrl = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    const question = await Question.create({
      tenantAdmin,
      section,
      questionText,
      options,
      correctOptionIndex,
      marks,
      imageUrl,
      imagePublicId,
      createdBy: req.user._id,
    });

    const populated = await question.populate("section", "name");

    return res.status(201).json({
      success: true,
      message: "Question created successfully.",
      data: populated,
    });
  } catch (error) {
    return next(error);
  }
};

const getQuestionsBySectionForAdmin = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { sectionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid section id." });
    }

    const questions = await Question.find({ tenantAdmin, section: sectionId })
      .populate("section", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: questions });
  } catch (error) {
    return next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { questionId } = req.params;
    const { section, questionText, options, correctOptionIndex, marks } =
      req.body;

    const question = await Question.findOne({ _id: questionId, tenantAdmin });
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found." });
    }

    if (section) {
      const sectionExists = await Section.findOne({
        _id: section,
        tenantAdmin,
      });
      if (!sectionExists) {
        return res
          .status(404)
          .json({ success: false, message: "Section not found." });
      }
      question.section = section;
    }

    if (typeof questionText === "string") {
      question.questionText = questionText;
    }

    if (Array.isArray(options)) {
      question.options = options;
    }

    if (correctOptionIndex !== undefined) {
      question.correctOptionIndex = Number(correctOptionIndex);
    }

    if (marks !== undefined) {
      question.marks = Number(marks);
    }

    if (req.file) {
      if (question.imagePublicId) {
        await cloudinary.uploader.destroy(question.imagePublicId);
      }

      const uploaded = await uploadBufferToCloudinary(
        req.file.buffer,
        "cbt/questions",
      );
      question.imageUrl = uploaded.secure_url;
      question.imagePublicId = uploaded.public_id;
    }

    await question.save();

    const populated = await question.populate("section", "name");

    return res.status(200).json({
      success: true,
      message: "Question updated successfully.",
      data: populated,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { questionId } = req.params;

    const question = await Question.findOne({ _id: questionId, tenantAdmin });
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found." });
    }

    if (question.imagePublicId) {
      await cloudinary.uploader.destroy(question.imagePublicId);
    }

    await question.deleteOne();

    return res
      .status(200)
      .json({ success: true, message: "Question deleted successfully." });
  } catch (error) {
    return next(error);
  }
};

const getAllStudents = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const students = await User.find({ role: "student", tenantAdmin })
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: students });
  } catch (error) {
    return next(error);
  }
};

const getStudentSubmissions = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { studentId } = req.params;

    const student = await User.findOne({
      _id: studentId,
      role: "student",
      tenantAdmin,
    }).select("-password");
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found." });
    }

    const submissions = await Submission.find({
      tenantAdmin,
      student: studentId,
    })
      .populate("section", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        student,
        submissions,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);

    const [studentsCount, sectionsCount, questionsCount, submissionsCount] =
      await Promise.all([
        User.countDocuments({ role: "student", tenantAdmin }),
        Section.countDocuments({ tenantAdmin }),
        Question.countDocuments({ tenantAdmin }),
        Submission.countDocuments({ tenantAdmin }),
      ]);

    const aggregate = await Submission.aggregate([
      { $match: { tenantAdmin: toTenantObjectId(tenantAdmin) } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: "$score" },
          avgMaxScore: { $avg: "$maxScore" },
          bestScore: { $max: "$score" },
          cheatingTerminations: {
            $sum: {
              $cond: [
                { $eq: ["$examMeta.terminatedDueToCheating", true] },
                1,
                0,
              ],
            },
          },
          totalCheatingAttempts: {
            $sum: { $ifNull: ["$examMeta.cheatingAttempts", 0] },
          },
          totalOptionChanges: {
            $sum: { $ifNull: ["$examMeta.totalOptionChanges", 0] },
          },
          avgOptionChanges: {
            $avg: { $ifNull: ["$examMeta.totalOptionChanges", 0] },
          },
        },
      },
    ]);

    const scoreInfo = aggregate[0] || {
      avgScore: 0,
      avgMaxScore: 0,
      bestScore: 0,
      cheatingTerminations: 0,
      totalCheatingAttempts: 0,
      totalOptionChanges: 0,
      avgOptionChanges: 0,
    };

    const averagePercent =
      scoreInfo.avgMaxScore > 0
        ? Number(
            ((scoreInfo.avgScore / scoreInfo.avgMaxScore) * 100).toFixed(2),
          )
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        studentsCount,
        sectionsCount,
        questionsCount,
        submissionsCount,
        averagePercent,
        bestScore: scoreInfo.bestScore || 0,
        cheatingTerminations: scoreInfo.cheatingTerminations || 0,
        totalCheatingAttempts: scoreInfo.totalCheatingAttempts || 0,
        totalOptionChanges: scoreInfo.totalOptionChanges || 0,
        avgOptionChanges: Number((scoreInfo.avgOptionChanges || 0).toFixed(2)),
      },
    });
  } catch (error) {
    return next(error);
  }
};


const getRecentSubmissions = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);

    const grouped = await Submission.aggregate([
      { $match: { tenantAdmin: toTenantObjectId(tenantAdmin) } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$student",
          totalScore: { $sum: "$score" },
          totalMaxScore: { $sum: "$maxScore" },
          totalAttempted: { $sum: "$attemptedQuestions" },
          totalQuestions: { $sum: "$totalQuestions" },
          submissionsCount: { $sum: 1 },
          lastSubmittedAt: { $max: "$createdAt" },
          terminatedDueToCheating: { $max: { $ifNull: ["$examMeta.terminatedDueToCheating", false] } },
          cheatingAttempts: { $max: { $ifNull: ["$examMeta.cheatingAttempts", 0] } },
          totalOptionChanges: { $sum: { $ifNull: ["$examMeta.totalOptionChanges", 0] } },
          sections: {
            $push: {
              section: "$section",
              score: "$score",
              maxScore: "$maxScore",
              attemptedQuestions: "$attemptedQuestions",
              totalQuestions: "$totalQuestions",
              createdAt: "$createdAt",
              terminatedDueToCheating: { $ifNull: ["$examMeta.terminatedDueToCheating", false] },
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "studentDoc",
        },
      },
      { $unwind: { path: "$studentDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "sections",
          localField: "sections.section",
          foreignField: "_id",
          as: "sectionDocs",
        },
      },
      {
        $addFields: {
          sections: {
            $map: {
              input: "$sections",
              as: "s",
              in: {
                name: {
                  $let: {
                    vars: {
                      match: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$sectionDocs",
                              as: "sd",
                              cond: { $eq: ["$$sd._id", "$$s.section"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $ifNull: ["$$match.name", "Unknown Section"] },
                  },
                },
                score: "$$s.score",
                maxScore: "$$s.maxScore",
                attemptedQuestions: "$$s.attemptedQuestions",
                totalQuestions: "$$s.totalQuestions",
                createdAt: "$$s.createdAt",
                terminatedDueToCheating: "$$s.terminatedDueToCheating",
              },
            },
          },
        },
      },
      { $sort: { lastSubmittedAt: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 1,
          student: {
            _id: "$studentDoc._id",
            name: { $ifNull: ["$studentDoc.name", "Unknown Student"] },
            email: { $ifNull: ["$studentDoc.email", ""] },
            studentCredential: { $ifNull: ["$studentDoc.studentCredential", ""] },
          },
          totalScore: 1,
          totalMaxScore: 1,
          totalAttempted: 1,
          totalQuestions: 1,
          submissionsCount: 1,
          percent: {
            $cond: [
              { $gt: ["$totalMaxScore", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalScore", "$totalMaxScore"] }, 100] }, 1] },
              0,
            ],
          },
          lastSubmittedAt: 1,
          terminatedDueToCheating: 1,
          cheatingAttempts: 1,
          totalOptionChanges: 1,
          sections: 1,
        },
      },
    ]);

    const result = grouped.map((entry) => ({
      _id: String(entry._id),
      student: entry.student || { name: "Unknown Student", email: "", studentCredential: "" },
      totalScore: entry.totalScore || 0,
      totalMaxScore: entry.totalMaxScore || 0,
      totalAttempted: entry.totalAttempted || 0,
      totalQuestions: entry.totalQuestions || 0,
      submissionsCount: entry.submissionsCount || 0,
      percent: entry.percent || 0,
      lastSubmittedAt: entry.lastSubmittedAt,
      terminatedDueToCheating: Boolean(entry.terminatedDueToCheating),
      cheatingAttempts: entry.cheatingAttempts || 0,
      totalOptionChanges: entry.totalOptionChanges || 0,
      sections: Array.isArray(entry.sections) ? entry.sections : [],
    }));

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};


const getInsights = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const tenantMatch = {
      $match: { tenantAdmin: toTenantObjectId(tenantAdmin) },
    };

    const scoreDistributionAgg = await Submission.aggregate([
      tenantMatch,
      {
        $project: {
          percent: {
            $cond: [
              { $gt: ["$maxScore", 0] },
              { $multiply: [{ $divide: ["$score", "$maxScore"] }, 100] },
              0,
            ],
          },
        },
      },
      {
        $project: {
          bucket: {
            $switch: {
              branches: [
                { case: { $lt: ["$percent", 40] }, then: "0-39" },
                { case: { $lt: ["$percent", 60] }, then: "40-59" },
                { case: { $lt: ["$percent", 75] }, then: "60-74" },
                { case: { $lt: ["$percent", 90] }, then: "75-89" },
              ],
              default: "90-100",
            },
          },
        },
      },
      { $group: { _id: "$bucket", count: { $sum: 1 } } },
    ]);

    const sectionPerformanceAgg = await Submission.aggregate([
      tenantMatch,
      {
        $project: {
          section: 1,
          percent: {
            $cond: [
              { $gt: ["$maxScore", 0] },
              { $multiply: [{ $divide: ["$score", "$maxScore"] }, 100] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$section",
          avgPercent: { $avg: "$percent" },
          attempts: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "sections",
          localField: "_id",
          foreignField: "_id",
          as: "sectionDoc",
        },
      },
      { $unwind: { path: "$sectionDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          sectionName: { $ifNull: ["$sectionDoc.name", "Unknown Section"] },
          avgPercent: { $round: ["$avgPercent", 2] },
          attempts: 1,
        },
      },
      { $sort: { avgPercent: -1 } },
    ]);

    const topStudentsAgg = await Submission.aggregate([
      tenantMatch,
      {
        $project: {
          student: 1,
          percent: {
            $cond: [
              { $gt: ["$maxScore", 0] },
              { $multiply: [{ $divide: ["$score", "$maxScore"] }, 100] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$student",
          avgPercent: { $avg: "$percent" },
          attempts: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "studentDoc",
        },
      },
      { $unwind: { path: "$studentDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          studentName: { $ifNull: ["$studentDoc.name", "Unknown Student"] },
          studentCredential: { $ifNull: ["$studentDoc.studentCredential", ""] },
          avgPercent: { $round: ["$avgPercent", 2] },
          attempts: 1,
        },
      },
      { $sort: { avgPercent: -1, attempts: -1 } },
      { $limit: 10 },
    ]);

    const timelineAgg = await Submission.aggregate([
      tenantMatch,
      {
        $project: {
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          cheatingAttempts: { $ifNull: ["$examMeta.cheatingAttempts", 0] },
          optionChanges: { $ifNull: ["$examMeta.totalOptionChanges", 0] },
          terminatedDueToCheating: {
            $ifNull: ["$examMeta.terminatedDueToCheating", false],
          },
        },
      },
      {
        $group: {
          _id: "$day",
          submissions: { $sum: 1 },
          cheatingAttempts: { $sum: "$cheatingAttempts" },
          optionChanges: { $sum: "$optionChanges" },
          terminations: {
            $sum: {
              $cond: [{ $eq: ["$terminatedDueToCheating", true] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const orderedScoreBuckets = ["0-39", "40-59", "60-74", "75-89", "90-100"];
    const scoreMap = new Map(
      scoreDistributionAgg.map((item) => [item._id, item.count]),
    );
    const scoreDistribution = orderedScoreBuckets.map((bucket) => ({
      bucket,
      count: scoreMap.get(bucket) || 0,
    }));

    const timeline = timelineAgg.slice(-14).map((item) => ({
      day: item._id,
      submissions: item.submissions,
      cheatingAttempts: item.cheatingAttempts,
      optionChanges: item.optionChanges,
      terminations: item.terminations,
    }));

    return res.status(200).json({
      success: true,
      data: {
        scoreDistribution,
        sectionPerformance: sectionPerformanceAgg,
        topStudents: topStudentsAgg,
        timeline,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createSubmissionFromSession = async (session, remark, progressMeta = {}) => {
  const answerMap = new Map(
    (session.progressAnswers || []).map((item) => [String(item.question), item.selectedOptionIndex]),
  );

  let attemptedQuestions = 0;
  let score = 0;
  let maxScore = 0;

  const answers = session.servedQuestions.map((servedQuestion) => {
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
      selectedOptionIndex: originalSelectedOptionIndex,
      correctOptionIndex: servedQuestion.correctOptionIndex,
      isCorrect,
      marksAwarded,
    };
  });

  const submission = await Submission.create({
    tenantAdmin: session.tenantAdmin,
    student: session.student,
    section: session.section,
    answers,
    totalQuestions: session.servedQuestions.length,
    attemptedQuestions,
    score,
    maxScore,
    remark,
    examMeta: {
      terminatedDueToCheating: Boolean(progressMeta.terminatedDueToCheating),
      terminationRemark:
        typeof progressMeta.terminationRemark === "string"
          ? progressMeta.terminationRemark
          : "",
      cheatingAttempts: Number.isInteger(progressMeta.cheatingAttempts)
        ? progressMeta.cheatingAttempts
        : 0,
      totalOptionChanges: Number.isInteger(progressMeta.totalOptionChanges)
        ? progressMeta.totalOptionChanges
        : 0,
      questionInteractions: Array.isArray(progressMeta.questionInteractions)
        ? progressMeta.questionInteractions
        : [],
    },
  });

  return submission;
};

const getExamConfig = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);

    let config = await ExamConfig.findOne({ tenantAdmin });

    if (!config) {
      config = await ExamConfig.create({
        tenantAdmin,
        durationInMinutes: 60,
        autoSubmitAfterTime: true,
        examinerName: req.user?.name || "CBT Examination Cell",
        updatedBy: req.user._id,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        durationInMinutes: config.durationInMinutes,
        examinerName: config.examinerName || "CBT Examination Cell",
        startAt: config.startAt || null,
        forceEndedAt: config.forceEndedAt || null,
        autoSubmitAfterTime: config.autoSubmitAfterTime,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateExamConfig = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { durationInMinutes, examinerName, startAt, autoSubmitAfterTime } = req.body;

    let parsedStartAt = null;
    if (startAt) {
      parsedStartAt = new Date(startAt);
      if (Number.isNaN(parsedStartAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'startAt must be a valid ISO date string',
        });
      }
    }

    const config = await ExamConfig.findOneAndUpdate(
      { tenantAdmin },
      {
        tenantAdmin,
        durationInMinutes,
        startAt: parsedStartAt,
        autoSubmitAfterTime: typeof autoSubmitAfterTime === 'boolean' ? autoSubmitAfterTime : true,
        examinerName:
          typeof examinerName === "string" && examinerName.trim()
            ? examinerName.trim()
            : "CBT Examination Cell",
        updatedBy: req.user._id,
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Exam configuration updated successfully.",
      data: {
        durationInMinutes: config.durationInMinutes,
        examinerName: config.examinerName || "CBT Examination Cell",
        startAt: config.startAt || null,
        forceEndedAt: config.forceEndedAt || null,
        autoSubmitAfterTime: config.autoSubmitAfterTime,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const forceEndExam = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const now = new Date();

    const config = await ExamConfig.findOneAndUpdate(
      { tenantAdmin },
      {
        forceEndedAt: now,
        updatedBy: req.user._id,
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    const activeSessions = await ExamSession.find({ tenantAdmin, isSubmitted: false });
    let processedCount = 0;

    for (const session of activeSessions) {
      const hasAnyAnswer = (session.progressAnswers || []).some(
        (item) => item.selectedOptionIndex !== null && item.selectedOptionIndex !== undefined,
      );

      session.isSubmitted = true;
      session.submittedAt = now;

      if (hasAnyAnswer) {
        await createSubmissionFromSession(
          session,
          'Auto-submitted due to exam being ended by admin.',
          session.progressMeta || {},
        );
        processedCount += 1;
      }

      await session.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Exam was ended and active student sessions were finalized.',
      data: {
        forceEndedAt: config.forceEndedAt,
        activeSessionCount: activeSessions.length,
        processedSessionCount: processedCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const exportStudentSubmissionsCsv = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { studentId } = req.params;

    const student = await User.findOne({
      _id: studentId,
      role: "student",
      tenantAdmin,
    }).select("name email studentCredential");
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found." });
    }

    const submissions = await Submission.find({
      tenantAdmin,
      student: studentId,
    })
      .populate("section", "name")
      .sort({ createdAt: -1 });

    const header = [
      "student_name",
      "student_email",
      "student_credential",
      "section",
      "score",
      "max_score",
      "attempted_questions",
      "total_questions",
      "terminated_due_to_cheating",
      "termination_remark",
      "cheating_attempts",
      "option_changes",
      "submitted_at",
    ];

    const rows = submissions.map((submission) => [
      student.name,
      student.email,
      student.studentCredential || "",
      submission.section?.name || "",
      submission.score,
      submission.maxScore,
      submission.attemptedQuestions,
      submission.totalQuestions,
      submission.examMeta?.terminatedDueToCheating ? "TRUE" : "FALSE",
      submission.examMeta?.terminationRemark || submission.remark || "",
      submission.examMeta?.cheatingAttempts || 0,
      submission.examMeta?.totalOptionChanges || 0,
      submission.createdAt.toISOString(),
    ]);

    const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, ...rows]
      .map((line) => line.map(csvEscape).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="student-${studentId}-submissions.csv"`,
    );
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};

const exportAllSubmissionsDetailedCsv = async (req, res, next) => {
  try {
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const submissions = await Submission.find({ tenantAdmin })
      .populate("student", "name email studentCredential")
      .populate("section", "name")
      .sort({ createdAt: -1 });

    const header = [
      "student_name",
      "student_email",
      "student_roll_number",
      "section",
      "score",
      "max_score",
      "attempted_questions",
      "total_questions",
      "terminated_due_to_cheating",
      "termination_remark",
      "cheating_attempts",
      "option_changes",
      "submitted_at",
      "question_number",
      "question_text",
      "selected_option_index",
      "selected_option_text",
      "correct_option_index",
      "correct_option_text",
      "is_correct",
      "marks_awarded",
    ];

    const rows = [];

    for (const submission of submissions) {
      const studentName = submission.student?.name || "Unknown Student";
      const studentEmail = submission.student?.email || "";
      const studentRoll = submission.student?.studentCredential || "";
      const sectionName = submission.section?.name || "";

      if (!submission.answers?.length) {
        rows.push([
          studentName,
          studentEmail,
          studentRoll,
          sectionName,
          submission.score,
          submission.maxScore,
          submission.attemptedQuestions,
          submission.totalQuestions,
          submission.examMeta?.terminatedDueToCheating ? "TRUE" : "FALSE",
          submission.examMeta?.terminationRemark || submission.remark || "",
          submission.examMeta?.cheatingAttempts || 0,
          submission.examMeta?.totalOptionChanges || 0,
          submission.createdAt.toISOString(),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        continue;
      }

      submission.answers.forEach((answer, index) => {
        const selectedIndex = answer.selectedOptionIndex;
        const correctIndex = answer.correctOptionIndex;

        const selectedText =
          selectedIndex === null || selectedIndex === undefined
            ? "Not answered"
            : answer.options?.[selectedIndex] || "Invalid option";

        const correctText = answer.options?.[correctIndex] || "Invalid option";

        rows.push([
          studentName,
          studentEmail,
          studentRoll,
          sectionName,
          submission.score,
          submission.maxScore,
          submission.attemptedQuestions,
          submission.totalQuestions,
          submission.examMeta?.terminatedDueToCheating ? "TRUE" : "FALSE",
          submission.examMeta?.terminationRemark || submission.remark || "",
          submission.examMeta?.cheatingAttempts || 0,
          submission.examMeta?.totalOptionChanges || 0,
          submission.createdAt.toISOString(),
          index + 1,
          answer.questionText,
          selectedIndex === null || selectedIndex === undefined
            ? ""
            : selectedIndex,
          selectedText,
          correctIndex,
          correctText,
          answer.isCorrect ? "TRUE" : "FALSE",
          answer.marksAwarded,
        ]);
      });
    }

    const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, ...rows]
      .map((line) => line.map(csvEscape).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="all-students-detailed-submissions.csv"',
    );
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    ensureSuperAdmin(req);
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const { studentId } = req.params;

    const student = await User.findOne({
      _id: studentId,
      role: "student",
      tenantAdmin,
    });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found." });
    }

    await Submission.deleteMany({ tenantAdmin, student: studentId });
    await ExamSession.deleteMany({ tenantAdmin, student: studentId });
    await student.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Student and related submissions deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

const resetAllStudentsData = async (req, res, next) => {
  try {
    ensureSuperAdmin(req);
    const tenantAdmin = resolveTenantForAdminRequest(req);
    const students = await User.find({ role: "student", tenantAdmin }).select(
      "_id",
    );
    const studentIds = students.map((student) => student._id);

    if (!studentIds.length) {
      return res.status(200).json({
        success: true,
        message: "No student data found to reset.",
        data: {
          deletedStudents: 0,
          deletedSubmissions: 0,
        },
      });
    }

    const [submissionResult, sessionResult, userResult] = await Promise.all([
      Submission.deleteMany({ tenantAdmin, student: { $in: studentIds } }),
      ExamSession.deleteMany({ tenantAdmin, student: { $in: studentIds } }),
      User.deleteMany({
        _id: { $in: studentIds },
        role: "student",
        tenantAdmin,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "All student data reset successfully.",
      data: {
        deletedStudents: userResult.deletedCount || 0,
        deletedSubmissions:
          (submissionResult.deletedCount || 0) +
          (sessionResult.deletedCount || 0),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getManagedAdmins = async (req, res, next) => {
  try {
    ensureSuperAdmin(req);

    const admins = await User.find({ role: "admin" })
      .select("name email phone studentLimit tenantKey createdAt createdBy")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: admins });
  } catch (error) {
    return next(error);
  }
};

const createManagedAdmin = async (req, res, next) => {
  try {
    ensureSuperAdmin(req);

    const {
      name,
      email,
      password,
      phone,
      studentLimit,
      tenantKey: rawTenantKey,
      organizationCode,
    } = req.body;

    const normalizedEmail = String(email || "").toLowerCase();
    const existing = await User.findOne({
      role: { $in: ["admin", "super_admin"] },
      email: normalizedEmail,
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    let tenantKey = String(rawTenantKey || organizationCode || "")
      .trim()
      .toLowerCase();
    if (!tenantKey) {
      tenantKey = await buildTenantKey(name || email);
    }

    const tenantExists = await User.findOne({
      role: "admin",
      tenantKey,
    }).select("_id");
    if (tenantExists) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Organization code is already in use.",
        });
    }

    const admin = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone,
      studentLimit: Number(studentLimit) || 0,
      role: "admin",
      tenantKey,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Organization admin created successfully.",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        studentLimit: admin.studentLimit,
        tenantKey: admin.tenantKey,
        organizationCode: admin.tenantKey,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createAdditionalSuperAdmin = async (req, res, next) => {
  try {
    ensureSuperAdmin(req);

    const { name, email, password, phone } = req.body;
    const normalizedEmail = String(email || "").toLowerCase();

    const existing = await User.findOne({
      role: { $in: ["admin", "super_admin"] },
      email: normalizedEmail,
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }

    const superAdmin = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone,
      role: "super_admin",
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Super administrator created successfully.",
      data: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        phone: superAdmin.phone,
        role: superAdmin.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const deleteManagedAdmin = async (req, res, next) => {
  try {
    ensureSuperAdmin(req);
    const { adminId } = req.params;

    const admin = await User.findOne({ _id: adminId, role: "admin" });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Organization admin not found." });
    }

    // We don't delete student data or questions automatically for safety, 
    // but we remove the admin account.
    await admin.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Organization admin deleted successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
  getInsights,
  getRecentSubmissions,
  exportStudentSubmissionsCsv,
  exportAllSubmissionsDetailedCsv,
  getExamConfig,
  updateExamConfig,
  forceEndExam,
  getManagedAdmins,
  createManagedAdmin,
  deleteManagedAdmin,
  createAdditionalSuperAdmin,
};
