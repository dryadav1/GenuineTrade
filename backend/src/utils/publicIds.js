import Sequence from "../models/Sequence.js";

const rolePrefixMap = {
  exporter: "EXP",
  buyer: "BUY",
  admin: "ADM"
};

const buildSequenceKey = (role) => `public-id:${role}`;

export const createPublicId = async (role) => {
  const prefix = rolePrefixMap[role] || "USR";
  const sequence = await Sequence.findByIdAndUpdate(
    buildSequenceKey(role),
    {
      $inc: {
        value: 1
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  return `GT-${prefix}-${String(sequence.value).padStart(4, "0")}`;
};
