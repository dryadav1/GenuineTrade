import Buyer from "../models/Buyer.js";
import Exporter from "../models/Exporter.js";

export const getProfileByUser = async (user) => {
  if (user.role === "exporter") {
    return Exporter.findOne({ userId: user._id }).populate(
      "userId",
      "email phone role"
    );
  }

  if (user.role === "buyer") {
    return Buyer.findOne({ userId: user._id }).populate(
      "userId",
      "email phone role"
    );
  }

  return null;
};
