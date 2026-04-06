import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { createPublicId } from "../utils/publicIds.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ["exporter", "buyer", "admin"],
      required: true,
      index: true
    },
    company: {
      type: String,
      trim: true,
      default: ""
    },
    country: {
      type: String,
      trim: true,
      default: ""
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    iec: {
      type: String,
      trim: true,
      default: ""
    },
    gst: {
      type: String,
      trim: true,
      default: ""
    },
    hsnCode: {
      type: String,
      trim: true,
      default: ""
    },
    productName: {
      type: String,
      trim: true,
      default: ""
    },
    productCategory: {
      type: String,
      trim: true,
      default: ""
    },
    importId: {
      type: String,
      trim: true,
      default: ""
    },
    requirement: {
      type: String,
      trim: true,
      default: ""
    },
    documents: {
      iecFile: {
        type: String,
        default: ""
      },
      gstFile: {
        type: String,
        default: ""
      },
      productImages: {
        type: [String],
        default: []
      }
    },
    profileCompleted: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true
    },
    badge: {
      type: String,
      enum: ["none", "verified", "trusted", "top_supplier"],
      default: "none"
    },
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "blocked"],
      default: "active",
      index: true
    },
    adminAccessLevel: {
      type: String,
      enum: ["none", "sub_admin", "super_admin"],
      default: "none"
    },
    publicId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    emailVerified: {
      type: Boolean,
      default: true
    },
    phoneVerified: {
      type: Boolean,
      default: false
    },
    subscriptionPlan: {
      type: String,
      trim: true,
      default: "free"
    },
    planStartDate: {
      type: Date,
      default: null
    },
    planExpiry: {
      type: Date,
      default: null
    },
    otp: {
      type: String,
      default: "",
      select: false
    },
    otpExpiry: {
      type: Date,
      default: null,
      select: false
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ role: 1, accountStatus: 1, createdAt: -1 });
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ subscriptionPlan: 1, planExpiry: 1 });

userSchema.pre("validate", async function assignPublicId(next) {
  if (!this.isNew || this.publicId) {
    next();
    return;
  }

  try {
    this.publicId = await createPublicId(this.role);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre("save", async function savePassword(next) {
  if (!this.isModified("password")) {
    next();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
