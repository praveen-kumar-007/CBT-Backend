const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true
    },
    questionText: {
      type: String,
      required: true
    },
    options: {
      type: [String],
      required: true
    },
    selectedOptionIndex: {
      type: Number,
      default: null
    },
    correctOptionIndex: {
      type: Number,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    },
    marksAwarded: {
      type: Number,
      required: true
    }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true
    },
    answers: {
      type: [answerSchema],
      default: []
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    attemptedQuestions: {
      type: Number,
      required: true
    },
    score: {
      type: Number,
      required: true
    },
    maxScore: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Submission', submissionSchema);
