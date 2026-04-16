const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
    },
    selectedOptionIndex: {
      type: Number,
      default: null,
    },
    correctOptionIndex: {
      type: Number,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    marksAwarded: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const interactionSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    firstSelectedOptionIndex: {
      type: Number,
      default: null,
    },
    finalSelectedOptionIndex: {
      type: Number,
      default: null,
    },
    changeCount: {
      type: Number,
      default: 0,
    },
    selectionHistory: {
      type: [Number],
      default: [],
    },
  },
  { _id: false },
);

const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      default: "",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const examMetaSchema = new mongoose.Schema(
  {
    terminatedDueToCheating: {
      type: Boolean,
      default: false,
    },
    terminationRemark: {
      type: String,
      default: "",
    },
    cheatingAttempts: {
      type: Number,
      default: 0,
    },
    totalOptionChanges: {
      type: Number,
      default: 0,
    },
    questionInteractions: {
      type: [interactionSchema],
      default: [],
    },
    securityEvents: {
      type: [securityEventSchema],
      default: [],
    },
  },
  { _id: false },
);

const submissionSchema = new mongoose.Schema(
  {
    tenantAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    attemptedQuestions: {
      type: Number,
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    maxScore: {
      type: Number,
      required: true,
    },
    remark: {
      type: String,
      default: "",
    },
    examMeta: {
      type: examMetaSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

submissionSchema.index({ tenantAdmin: 1, student: 1, createdAt: -1 });

module.exports = mongoose.model("Submission", submissionSchema);
