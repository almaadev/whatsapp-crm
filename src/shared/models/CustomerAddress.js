import mongoose from "mongoose";

const CustomerAddressSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  city: { type: String, default: "" },
  district: { type: String, default: "" },
  state: { type: String, default: "" },
  pincode: { type: String, default: "" },
  address: { type: String, default: "" },
  landmark: { type: String, default: "" },
  latitude: { type: Number },
  longitude: { type: Number },
  isCurrent: { type: Boolean, default: true, index: true },
  validFrom: { type: Date, default: Date.now },
  validTo: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Prevent model caching issues during hot-reload
if (mongoose.models.CustomerAddress) {
  delete mongoose.models.CustomerAddress;
}

export default mongoose.models.CustomerAddress || mongoose.model("CustomerAddress", CustomerAddressSchema);
