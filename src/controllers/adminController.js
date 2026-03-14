const streamifier = require('streamifier');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Section = require('../models/Section');
const Submission = require('../models/Submission');
const User = require('../models/User');
const ExamConfig = require('../models/ExamConfig');
const { cloudinary } = require('../config/cloudinary');

const uploadBufferToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) {
        return reject(error);
      }
      return resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

const createSection = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const existing = await Section.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Section already exists.' });
    }

    const section = await Section.create({ name, description });

    return res.status(201).json({
      success: true,
      message: 'Section created successfully.',
      data: section
    });
  } catch (error) {
    return next(error);
  }
};

const getSections = async (req, res, next) => {
  try {
    const sections = await Section.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: sections });
  } catch (error) {
    return next(error);
  }
};

const updateSection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const { name, description, isActive } = req.body;

    const section = await Section.findByIdAndUpdate(
      sectionId,
      { name, description, isActive },
      { new: true, runValidators: true }
    );

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Section updated successfully.',
      data: section
    });
  } catch (error) {
    return next(error);
  }
};

const deleteSection = async (req, res, next) => {
  try {
    const { sectionId } = req.params;

    const questionCount = await Question.countDocuments({ section: sectionId });
    if (questionCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete section with existing questions. Remove questions first.'
      });
    }

    const deleted = await Section.findByIdAndDelete(sectionId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    return res.status(200).json({ success: true, message: 'Section deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

const createQuestion = async (req, res, next) => {
  try {
    const { section, questionText, options, correctOptionIndex, marks } = req.body;

    const sectionExists = await Section.findById(section);
    if (!sectionExists) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'cbt/questions');
      imageUrl = uploaded.secure_url;
      imagePublicId = uploaded.public_id;
    }

    const question = await Question.create({
      section,
      questionText,
      options,
      correctOptionIndex,
      marks,
      imageUrl,
      imagePublicId,
      createdBy: req.user._id
    });

    const populated = await question.populate('section', 'name');

    return res.status(201).json({
      success: true,
      message: 'Question created successfully.',
      data: populated
    });
  } catch (error) {
    return next(error);
  }
};

const getQuestionsBySectionForAdmin = async (req, res, next) => {
  try {
    const { sectionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return res.status(400).json({ success: false, message: 'Invalid section id.' });
    }

    const questions = await Question.find({ section: sectionId })
      .populate('section', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: questions });
  } catch (error) {
    return next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const { section, questionText, options, correctOptionIndex, marks } = req.body;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    if (section) {
      const sectionExists = await Section.findById(section);
      if (!sectionExists) {
        return res.status(404).json({ success: false, message: 'Section not found.' });
      }
      question.section = section;
    }

    if (typeof questionText === 'string') {
      question.questionText = questionText;
    }

    if (Array.isArray(options)) {
      question.options = options;
    }

    if (typeof correctOptionIndex === 'number') {
      question.correctOptionIndex = correctOptionIndex;
    }

    if (typeof marks === 'number') {
      question.marks = marks;
    }

    if (req.file) {
      if (question.imagePublicId) {
        await cloudinary.uploader.destroy(question.imagePublicId);
      }

      const uploaded = await uploadBufferToCloudinary(req.file.buffer, 'cbt/questions');
      question.imageUrl = uploaded.secure_url;
      question.imagePublicId = uploaded.public_id;
    }

    await question.save();

    const populated = await question.populate('section', 'name');

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully.',
      data: populated
    });
  } catch (error) {
    return next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    if (question.imagePublicId) {
      await cloudinary.uploader.destroy(question.imagePublicId);
    }

    await question.deleteOne();

    return res.status(200).json({ success: true, message: 'Question deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

const getAllStudents = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: students });
  } catch (error) {
    return next(error);
  }
};

const getStudentSubmissions = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findOne({ _id: studentId, role: 'student' }).select('-password');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const submissions = await Submission.find({ student: studentId })
      .populate('section', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        student,
        submissions
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const [studentsCount, sectionsCount, questionsCount, submissionsCount] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Section.countDocuments({}),
      Question.countDocuments({}),
      Submission.countDocuments({})
    ]);

    const aggregate = await Submission.aggregate([
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' },
          avgMaxScore: { $avg: '$maxScore' },
          bestScore: { $max: '$score' },
          cheatingTerminations: {
            $sum: {
              $cond: [
                { $eq: ['$examMeta.terminatedDueToCheating', true] },
                1,
                0
              ]
            }
          },
          totalCheatingAttempts: { $sum: { $ifNull: ['$examMeta.cheatingAttempts', 0] } },
          totalOptionChanges: { $sum: { $ifNull: ['$examMeta.totalOptionChanges', 0] } },
          avgOptionChanges: { $avg: { $ifNull: ['$examMeta.totalOptionChanges', 0] } }
        }
      }
    ]);

    const scoreInfo = aggregate[0] || {
      avgScore: 0,
      avgMaxScore: 0,
      bestScore: 0,
      cheatingTerminations: 0,
      totalCheatingAttempts: 0,
      totalOptionChanges: 0,
      avgOptionChanges: 0
    };
    const averagePercent = scoreInfo.avgMaxScore > 0
      ? Number(((scoreInfo.avgScore / scoreInfo.avgMaxScore) * 100).toFixed(2))
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
        avgOptionChanges: Number((scoreInfo.avgOptionChanges || 0).toFixed(2))
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getRecentSubmissions = async (req, res, next) => {
  try {
    const recent = await Submission.find({})
      .populate('student', 'name email studentCredential')
      .populate('section', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({ success: true, data: recent });
  } catch (error) {
    return next(error);
  }
};

const getInsights = async (req, res, next) => {
  try {
    const scoreDistributionAgg = await Submission.aggregate([
      {
        $project: {
          percent: {
            $cond: [
              { $gt: ['$maxScore', 0] },
              { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $project: {
          bucket: {
            $switch: {
              branches: [
                { case: { $lt: ['$percent', 40] }, then: '0-39' },
                { case: { $lt: ['$percent', 60] }, then: '40-59' },
                { case: { $lt: ['$percent', 75] }, then: '60-74' },
                { case: { $lt: ['$percent', 90] }, then: '75-89' }
              ],
              default: '90-100'
            }
          }
        }
      },
      { $group: { _id: '$bucket', count: { $sum: 1 } } }
    ]);

    const sectionPerformanceAgg = await Submission.aggregate([
      {
        $project: {
          section: 1,
          percent: {
            $cond: [
              { $gt: ['$maxScore', 0] },
              { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: '$section',
          avgPercent: { $avg: '$percent' },
          attempts: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'sections',
          localField: '_id',
          foreignField: '_id',
          as: 'sectionDoc'
        }
      },
      { $unwind: { path: '$sectionDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          sectionName: { $ifNull: ['$sectionDoc.name', 'Unknown Section'] },
          avgPercent: { $round: ['$avgPercent', 2] },
          attempts: 1
        }
      },
      { $sort: { avgPercent: -1 } }
    ]);

    const topStudentsAgg = await Submission.aggregate([
      {
        $project: {
          student: 1,
          percent: {
            $cond: [
              { $gt: ['$maxScore', 0] },
              { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: '$student',
          avgPercent: { $avg: '$percent' },
          attempts: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'studentDoc'
        }
      },
      { $unwind: { path: '$studentDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          studentName: { $ifNull: ['$studentDoc.name', 'Unknown Student'] },
          studentCredential: { $ifNull: ['$studentDoc.studentCredential', ''] },
          avgPercent: { $round: ['$avgPercent', 2] },
          attempts: 1
        }
      },
      { $sort: { avgPercent: -1, attempts: -1 } },
      { $limit: 10 }
    ]);

    const timelineAgg = await Submission.aggregate([
      {
        $project: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          cheatingAttempts: { $ifNull: ['$examMeta.cheatingAttempts', 0] },
          optionChanges: { $ifNull: ['$examMeta.totalOptionChanges', 0] },
          terminatedDueToCheating: { $ifNull: ['$examMeta.terminatedDueToCheating', false] }
        }
      },
      {
        $group: {
          _id: '$day',
          submissions: { $sum: 1 },
          cheatingAttempts: { $sum: '$cheatingAttempts' },
          optionChanges: { $sum: '$optionChanges' },
          terminations: {
            $sum: {
              $cond: [{ $eq: ['$terminatedDueToCheating', true] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const orderedScoreBuckets = ['0-39', '40-59', '60-74', '75-89', '90-100'];
    const scoreMap = new Map(scoreDistributionAgg.map((item) => [item._id, item.count]));
    const scoreDistribution = orderedScoreBuckets.map((bucket) => ({
      bucket,
      count: scoreMap.get(bucket) || 0
    }));

    const timeline = timelineAgg.slice(-14).map((item) => ({
      day: item._id,
      submissions: item.submissions,
      cheatingAttempts: item.cheatingAttempts,
      optionChanges: item.optionChanges,
      terminations: item.terminations
    }));

    return res.status(200).json({
      success: true,
      data: {
        scoreDistribution,
        sectionPerformance: sectionPerformanceAgg,
        topStudents: topStudentsAgg,
        timeline
      }
    });
  } catch (error) {
    return next(error);
  }
};

const getExamConfig = async (req, res, next) => {
  try {
    let config = await ExamConfig.findOne({}).sort({ createdAt: -1 });

    if (!config) {
      config = await ExamConfig.create({
        durationInMinutes: 60,
        examinerName: req.user?.name || 'CBT Examination Cell',
        updatedBy: req.user._id
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        durationInMinutes: config.durationInMinutes,
        examinerName: config.examinerName || 'CBT Examination Cell',
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateExamConfig = async (req, res, next) => {
  try {
    const { durationInMinutes, examinerName } = req.body;

    const config = await ExamConfig.findOneAndUpdate(
      {},
      {
        durationInMinutes,
        examinerName: (typeof examinerName === 'string' && examinerName.trim())
          ? examinerName.trim()
          : 'CBT Examination Cell',
        updatedBy: req.user._id
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Exam duration updated successfully.',
      data: {
        durationInMinutes: config.durationInMinutes,
        examinerName: config.examinerName || 'CBT Examination Cell',
        updatedAt: config.updatedAt
      }
    });
  } catch (error) {
    return next(error);
  }
};

const exportStudentSubmissionsCsv = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findOne({ _id: studentId, role: 'student' }).select('name email studentCredential');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const submissions = await Submission.find({ student: studentId })
      .populate('section', 'name')
      .sort({ createdAt: -1 });

    const header = [
      'student_name',
      'student_email',
      'student_credential',
      'section',
      'score',
      'max_score',
      'attempted_questions',
      'total_questions',
      'terminated_due_to_cheating',
      'termination_remark',
      'cheating_attempts',
      'option_changes',
      'submitted_at'
    ];

    const rows = submissions.map((submission) => [
      student.name,
      student.email,
      student.studentCredential || '',
      submission.section?.name || '',
      submission.score,
      submission.maxScore,
      submission.attemptedQuestions,
      submission.totalQuestions,
      submission.examMeta?.terminatedDueToCheating ? 'TRUE' : 'FALSE',
      submission.examMeta?.terminationRemark || submission.remark || '',
      submission.examMeta?.cheatingAttempts || 0,
      submission.examMeta?.totalOptionChanges || 0,
      submission.createdAt.toISOString()
    ]);

    const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="student-${studentId}-submissions.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};

const exportAllSubmissionsDetailedCsv = async (req, res, next) => {
  try {
    const submissions = await Submission.find({})
      .populate('student', 'name email studentCredential')
      .populate('section', 'name')
      .sort({ createdAt: -1 });

    const header = [
      'student_name',
      'student_email',
      'student_roll_number',
      'section',
      'score',
      'max_score',
      'attempted_questions',
      'total_questions',
      'terminated_due_to_cheating',
      'termination_remark',
      'cheating_attempts',
      'option_changes',
      'submitted_at',
      'question_number',
      'question_text',
      'selected_option_index',
      'selected_option_text',
      'correct_option_index',
      'correct_option_text',
      'is_correct',
      'marks_awarded'
    ];

    const rows = [];

    for (const submission of submissions) {
      const studentName = submission.student?.name || 'Unknown Student';
      const studentEmail = submission.student?.email || '';
      const studentRoll = submission.student?.studentCredential || '';
      const sectionName = submission.section?.name || '';

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
          submission.examMeta?.terminatedDueToCheating ? 'TRUE' : 'FALSE',
          submission.examMeta?.terminationRemark || submission.remark || '',
          submission.examMeta?.cheatingAttempts || 0,
          submission.examMeta?.totalOptionChanges || 0,
          submission.createdAt.toISOString(),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ]);
        continue;
      }

      submission.answers.forEach((answer, index) => {
        const selectedIndex = answer.selectedOptionIndex;
        const correctIndex = answer.correctOptionIndex;

        const selectedText = (selectedIndex === null || selectedIndex === undefined)
          ? 'Not answered'
          : (answer.options?.[selectedIndex] || 'Invalid option');

        const correctText = answer.options?.[correctIndex] || 'Invalid option';

        rows.push([
          studentName,
          studentEmail,
          studentRoll,
          sectionName,
          submission.score,
          submission.maxScore,
          submission.attemptedQuestions,
          submission.totalQuestions,
          submission.examMeta?.terminatedDueToCheating ? 'TRUE' : 'FALSE',
          submission.examMeta?.terminationRemark || submission.remark || '',
          submission.examMeta?.cheatingAttempts || 0,
          submission.examMeta?.totalOptionChanges || 0,
          submission.createdAt.toISOString(),
          index + 1,
          answer.questionText,
          selectedIndex === null || selectedIndex === undefined ? '' : selectedIndex,
          selectedText,
          correctIndex,
          correctText,
          answer.isCorrect ? 'TRUE' : 'FALSE',
          answer.marksAwarded
        ]);
      });
    }

    const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="all-students-detailed-submissions.csv"');
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    await Submission.deleteMany({ student: studentId });
    await student.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Student and related submissions deleted successfully.'
    });
  } catch (error) {
    return next(error);
  }
};

const resetAllStudentsData = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' }).select('_id');
    const studentIds = students.map((student) => student._id);

    if (!studentIds.length) {
      return res.status(200).json({
        success: true,
        message: 'No student data found to reset.',
        data: {
          deletedStudents: 0,
          deletedSubmissions: 0
        }
      });
    }

    const [submissionResult, userResult] = await Promise.all([
      Submission.deleteMany({ student: { $in: studentIds } }),
      User.deleteMany({ _id: { $in: studentIds }, role: 'student' })
    ]);

    return res.status(200).json({
      success: true,
      message: 'All student data reset successfully.',
      data: {
        deletedStudents: userResult.deletedCount || 0,
        deletedSubmissions: submissionResult.deletedCount || 0
      }
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
  updateExamConfig
};
