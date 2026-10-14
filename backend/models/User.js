const mongoose = require('mongoose')

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
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      minlength: 8,
      select: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    emailVerificationTokenHash: {
      type: String,
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      select: false,
    },

    passwordResetToken: {
    type: String,
    default: null,
    },

    passwordResetExpiresAt: {
    type: Date,
    default: null,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    phone: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },

    address: {
       street: { type: String, default: "" },
       city: { type: String, default: "" },
       state: { type: String, default: "" },
       country: { type: String, default: "" },
       postalCode: { type: String, default: "" }
     },

    profilePicture: {
      type: String,
      default: "",
    },

    company: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    jobTitle: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },

    authProviders: {
      email: {
        type: Boolean,
        default: false,
      },

      google: {
        type: Boolean,
        default: false,
      },

      facebook: {
        type: Boolean,
        default: false,
      },
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    facebookId: {
      type: String,
      unique: true,
      sparse: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema)

module.exports = User