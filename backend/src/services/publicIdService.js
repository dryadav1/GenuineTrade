import User from "../models/User.js";
import { createPublicId } from "../utils/publicIds.js";

export const ensureUserPublicId = async (user) => {
  if (user.publicId) {
    return user.publicId;
  }

  const publicId = await createPublicId(user.role);
  user.publicId = publicId;

  if (user.isNew) {
    await user.save();
    return user.publicId;
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        publicId
      }
    }
  );

  return publicId;
};

export const ensureAllUserPublicIds = async () => {
  const users = await User.find({
    $or: [{ publicId: { $exists: false } }, { publicId: null }, { publicId: "" }]
  });

  if (!users.length) {
    return 0;
  }

  for (const user of users) {
    await ensureUserPublicId(user);
  }

  return users.length;
};
