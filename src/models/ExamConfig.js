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
