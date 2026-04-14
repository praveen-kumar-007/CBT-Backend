const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "student"],
      required: true,
      default: "student",
    },
    tenantAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    tenantKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    studentCredential: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    plan: {
      type: String,
      trim: true,
      default: "Enterprise Business",
    },
    studentLimit: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index(
  { role: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: { $in: ["super_admin", "admin"] },
    },
  },
);

userSchema.index(
  { role: 1, tenantAdmin: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "student",
    },
  },
);

userSchema.index(
  { role: 1, tenantAdmin: 1, studentCredential: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "student",
      studentCredential: { $type: "string" },
    },
  },
);

userSchema.index(
  { role: 1, tenantKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: "admin",
      tenantKey: { $type: "string" },
    },
  },
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return;
});

userSchema.methods.comparePassword = async function comparePassword(
  inputPassword,
) {
  return bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
