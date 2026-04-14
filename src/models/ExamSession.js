const mongoose = require("mongoose");

const servedQuestionSchema = new mongoose.Schema(
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
    originalOptions: {
      type: [String],
      required: true,
    },
    shuffledOptions: {
      type: [String],
      required: true,
    },
    optionOrder: {
      type: [Number],
      required: true,
    },
    correctOptionIndex: {
      type: Number,
      required: true,
    },
    marks: {
      type: Number,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const examSessionSchema = new mongoose.Schema(
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
    servedQuestions: {
      type: [servedQuestionSchema],
      default: [],
    },
    isSubmitted: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

examSessionSchema.index(
  { tenantAdmin: 1, student: 1, section: 1 },
  { unique: true },
);

module.exports = mongoose.model("ExamSession", examSessionSchema);
