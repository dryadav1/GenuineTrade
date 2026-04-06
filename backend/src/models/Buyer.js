import mongoose from "mongoose";
import {
  createProductSearchTerms,
  normalizeCountry,
  normalizeValue,
  parseProducts
} from "../utils/matchHelpers.js";

const computeBuyerTrustScore = ({ kycStatus, certifications }) => {
  if (kycStatus === "rejected") {
    return 0.08;
  }

  if (kycStatus === "verified") {
    return certifications.length ? 0.88 : 0.8;
  }

  if (kycStatus === "pending") {
    return certifications.length ? 0.48 : 0.42;
  }

  return certifications.length ? 0.28 : 0.18;
};

const buyerSchema = new mongoose.Schema(
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
    businessId: {
      type: String,
      trim: true,
      default: ""
    },
    businessType: {
      type: String,
      trim: true,
      default: ""
    },
    importProducts: {
      type: [String],
      default: []
    },
    normalizedImportProducts: {
      type: [String],
      default: []
    },
    importProductTokens: {
      type: [String],
      default: []
    },
    certifications: {
      type: [String],
      default: []
    },
    normalizedCertifications: {
      type: [String],
      default: []
    },
    trustScore: {
      type: Number,
      default: 0.18
    },
    kycStatus: {
      type: String,
      enum: ["not_started", "pending", "verified", "rejected"],
      default: "not_started"
    },
    savedExporterIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Exporter",
      default: []
    }
  },
  {
    timestamps: true
  }
);

buyerSchema.pre("validate", function setNormalizedFields(next) {
  this.importProducts = parseProducts(this.importProducts);
  this.normalizedImportProducts = this.importProducts.map((product) =>
    normalizeValue(product)
  );
  this.importProductTokens = createProductSearchTerms(this.importProducts);
  this.certifications = parseProducts(this.certifications);
  this.normalizedCertifications = this.certifications.map((item) =>
    normalizeValue(item)
  );
  this.normalizedCountry = normalizeCountry(this.country);
  this.trustScore = computeBuyerTrustScore({
    kycStatus: this.kycStatus,
    certifications: this.certifications
  });
  next();
});

buyerSchema.index({ country: 1 });
buyerSchema.index({ importProductTokens: 1 });
buyerSchema.index({ normalizedCertifications: 1 });
buyerSchema.index({ trustScore: -1, kycStatus: 1 });

const Buyer = mongoose.model("Buyer", buyerSchema);

export default Buyer;
