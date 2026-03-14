const mongoose = require('mongoose');

const examConfigSchema = new mongoose.Schema(
  {
    durationInMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 600,
      default: 60
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ExamConfig', examConfigSchema);
