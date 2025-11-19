const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    donorType: {
      type: String,
      enum: ["student", "faculty", "other","Student", "Faculty", "Other"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Donor', donorSchema);