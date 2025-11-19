const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    donatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    donatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donor",
      required: true,
    },
    isBloodAccepted: {
      type: Boolean,
      default: false,
    },
    isBloodRejected: {
      type: Boolean,
      default: false,
    },
    isCertificateIssued: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Donation", donationSchema);