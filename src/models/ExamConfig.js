const mongoose = require("mongoose");

const examConfigSchema = new mongoose.Schema(
  {
    tenantAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    durationInMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 600,
      default: 60,
    },
    officialEntryWindowInMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
      default: 30,
    },
    sectionReentryWindowInMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
      default: 15,
    },
    startAt: {
      type: Date,
      default: null,
    },
    forceEndedAt: {
      type: Date,
      default: null,
    },
    autoSubmitAfterTime: {
      type: Boolean,
      default: true,
    },
    calculatorEnabled: {
      type: Boolean,
      default: false,
    },
    activeCalculatorType: {
      type: String,
      enum: ["Simple", "Scientific ES991", "Scientific ES82", "Financial"],
      default: null,
    },
    maxCheatingAttempts: {
      type: Number,
      required: true,
      min: 1,
      max: 99,
      default: 3,
    },
    examinerName: {
      type: String,
      trim: true,
      default: "CBT Examination Cell",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

examConfigSchema.index({ tenantAdmin: 1 }, { unique: true });

module.exports = mongoose.model("ExamConfig", examConfigSchema);
