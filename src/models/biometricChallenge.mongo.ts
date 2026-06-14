import mongoose, { Document, Schema } from "mongoose";

export interface IBiometricChallenge extends Document {
  userId: mongoose.Types.ObjectId;
  challenge: string;
  type: "registration" | "authentication";
  expiresAt: Date;
  createdAt: Date;
}

const biometricChallengeSchema = new Schema<IBiometricChallenge>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    challenge: {
      type: String,
      required: true,
      select: false,
    },
    type: {
      type: String,
      enum: ["registration", "authentication"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index → Mongo auto deletes expired challenges (same pattern as RefreshToken)
biometricChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const BiometricChallengeModel = mongoose.model<IBiometricChallenge>(
  "BiometricChallenge",
  biometricChallengeSchema,
);

export default BiometricChallengeModel;
