const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    tenantAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

sectionSchema.index({ tenantAdmin: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Section", sectionSchema);
