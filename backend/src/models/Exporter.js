import mongoose from "mongoose";
import {
  createProductSearchTerms,
  normalizeCountry,
  normalizeValue,
  parseProducts,
  tokenizeValue
} from "../utils/matchHelpers.js";

const computeTrustScore = ({ status, approvalState, verificationStage }) => {
  if (approvalState === "rejected" || verificationStage === "rejected") {
    return 0.05;
  }

  if (status === "Top Supplier" && verificationStage === "verified") {
    return 1;
  }

  if (status === "Verified" && verificationStage === "verified") {
    return 0.82;
  }

  if (verificationStage === "under_review") {
    return 0.35;
  }

  if (verificationStage === "documents_requested") {
    return 0.22;
  }

  return 0.15;
};

const exporterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    companyName: {
      type: String,
      required: true,
      trim: true
    },
    gstNumber: {
      type: String,
      required: true,
      trim: true
    },
    iecCode: {
      type: String,
      required: true,
      trim: true
    },
    products: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one product is required"
      }
    },
    certifications: {
      type: [String],
      default: []
    },
    normalizedProducts: {
      type: [String],
      default: []
    },
    normalizedCertifications: {
      type: [String],
      default: []
    },
    productTokens: {
      type: [String],
      default: []
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    normalizedCountry: {
      type: String,
      default: "",
      index: true
    },
    status: {
      type: String,
      enum: ["New", "Verified", "Top Supplier"],
      default: "New"
    },
    approvalState: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    verificationStage: {
      type: String,
      enum: [
        "submitted",
        "under_review",
        "documents_requested",
        "verified",
        "rejected"
      ],
      default: "submitted"
    },
    verificationChecklist: {
      companyProfile: {
        type: Boolean,
        default: false
      },
      gstDocumentUploaded: {
        type: Boolean,
        default: false
      },
      gstValidated: {
        type: Boolean,
        default: false
      },
      iecDocumentUploaded: {
        type: Boolean,
        default: false
      },
      iecValidated: {
        type: Boolean,
        default: false
      },
      bankProofUploaded: {
        type: Boolean,
        default: false
      },
      bankValidated: {
        type: Boolean,
        default: false
      },
      phoneValidated: {
        type: Boolean,
        default: false
      },
      exportReadiness: {
        type: Boolean,
        default: false
      }
    },
    verificationNotes: {
      type: String,
      trim: true,
      default: ""
    },
    verificationHistory: [
      {
        stage: {
          type: String,
          trim: true,
          required: true
        },
        note: {
          type: String,
          trim: true,
          default: ""
        },
        updatedByEmail: {
          type: String,
          trim: true,
          default: ""
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    reviewedAt: {
      type: Date,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    trustScore: {
      type: Number,
      default: 0.15
    },
    profileViews: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

exporterSchema.pre("validate", function setNormalizedFields(next) {
  this.products = parseProducts(this.products);
  this.certifications = parseProducts(this.certifications);
  this.normalizedProducts = this.products.map((product) => normalizeValue(product));
  this.normalizedCertifications = this.certifications.map((item) =>
    normalizeValue(item)
  );
  this.productTokens = createProductSearchTerms(this.products).concat(
    this.products.flatMap((product) => tokenizeValue(product))
  );
  this.productTokens = Array.from(new Set(this.productTokens)).filter(Boolean);
  this.normalizedCountry = normalizeCountry(this.country);
  this.trustScore = computeTrustScore({
    status: this.status,
    approvalState: this.approvalState,
    verificationStage: this.verificationStage
  });
  next();
});

exporterSchema.index({ approvalState: 1, status: 1, normalizedCountry: 1 });
exporterSchema.index({ verificationStage: 1, reviewedAt: -1 });
exporterSchema.index({ productTokens: 1 });
exporterSchema.index({ normalizedCertifications: 1 });

const Exporter = mongoose.model("Exporter", exporterSchema);

export default Exporter;
