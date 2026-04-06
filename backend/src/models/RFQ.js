import mongoose from "mongoose";
import {
  createProductSearchTerms,
  normalizeCountry,
  normalizeValue
} from "../utils/matchHelpers.js";

const rfqSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: true
    },
    product: {
      type: String,
      required: true,
      trim: true
    },
    normalizedProduct: {
      type: String,
      default: "",
      index: true
    },
    productTokens: {
      type: [String],
      default: []
    },
    quantity: {
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
    budget: {
      type: Number,
      default: null
    },
    matchCount: {
      type: Number,
      default: 0
    },
    topMatchScore: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

rfqSchema.pre("validate", function setNormalizedFields(next) {
  this.normalizedProduct = normalizeValue(this.product);
  this.productTokens = createProductSearchTerms([this.product]);
  this.normalizedCountry = normalizeCountry(this.country);
  next();
});

rfqSchema.index({ buyerId: 1, createdAt: -1 });
rfqSchema.index({ normalizedCountry: 1, createdAt: -1 });
rfqSchema.index({ normalizedProduct: 1, createdAt: -1 });

const RFQ = mongoose.model("RFQ", rfqSchema);

export default RFQ;
