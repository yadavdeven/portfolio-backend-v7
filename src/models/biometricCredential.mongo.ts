import mongoose, { Document, Schema } from "mongoose";

export interface IBiometricCredential extends Document {
  userId: mongoose.Types.ObjectId;
  credentialId: string;
  deviceId: string;
  publicKey: string;
  counter: number;
  deviceName: string;
  transports: string[];
  lastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

const biometricCredentialSchema = new Schema<IBiometricCredential>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    credentialId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Stable, client-generated identifier for the physical device (persisted in
    // the device keychain). Unlike `credentialId` it survives re-enrollment, so
    // it's the key we dedupe on: re-enabling from the same device updates that
    // device's credential instead of creating a duplicate row.
    deviceId: {
      type: String,
      required: true,
    },
    publicKey: {
      type: String,
      required: true,
      select: false,
    },
    counter: {
      type: Number,
      required: true,
      default: 0,
    },
    deviceName: {
      type: String,
      default: "My Device",
    },
    transports: {
      type: [String],
      default: [],
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One credential per physical device, per user — enrolling again from the same
// device replaces the existing row rather than stacking duplicates.
biometricCredentialSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

const BiometricCredentialModel = mongoose.model<IBiometricCredential>(
  "BiometricCredential",
  biometricCredentialSchema,
);

export default BiometricCredentialModel;
