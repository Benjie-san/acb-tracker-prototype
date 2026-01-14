const mongoose = require("mongoose");

const AirShipmentSchema = new mongoose.Schema(
  {
    client: { type: String, trim: true },
    flightNumber: { type: String, trim: true },
    flightStatus: { type: String, trim: true },
    etaEst: { type: Date },
    etaStatus: { type: String, trim: true },
    preAlertDate: { type: Date },
    etaDate: { type: Date },
    releaseDate: { type: Date },
    releaseStatus: { type: String, trim: true },
    port: { type: String, trim: true },
    nameAddress: { type: Boolean },
    lateSecured: { type: Boolean },
    goodsDescription: { type: Boolean },
    changeMAWB: { type: Boolean },
    changeCounts: { type: Boolean },
    mismatchValues: { type: Boolean },
    awb: { type: String, trim: true },
    clvs: { type: Number },
    lvs: { type: Number },
    pga: { type: Number },
    total: { type: Number },
    totalFoodItems: { type: Number },
    analyst: { type: String, trim: true },
    shipmentComments: { type: String, trim: true },

    cadTransactionNumber: { type: String, trim: true },
    cadTransNumStatus: { type: String, trim: true },
    dutiesLvs: { type: Number },
    taxesLvs: { type: Number },
    dutiesPga: { type: Number },
    taxesPga: { type: Number },
    invoiceNumber: { type: String, trim: true },
    billingDate: { type: Date },
    billingClerk: { type: String, trim: true },
    droppedToSftp: { type: Boolean },
    billingComments: { type: String, trim: true },

    activityLogs: { type: String, trim: true },

    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

AirShipmentSchema.index({ deletedAt: 1 });

module.exports = mongoose.model("AirShipment", AirShipmentSchema);
