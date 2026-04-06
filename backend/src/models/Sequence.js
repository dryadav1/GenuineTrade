import mongoose from "mongoose";

const sequenceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const Sequence = mongoose.model("Sequence", sequenceSchema);

export default Sequence;
