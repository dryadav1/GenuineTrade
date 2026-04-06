import mongoose from "mongoose";

const platformSettingSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "platform"
    },
    homepage: {
      heroTitle: {
        type: String,
        trim: true,
        default: "Where Genuine Exporters Meet Real Buyers"
      },
      heroSubtitle: {
        type: String,
        trim: true,
        default:
          "Verified suppliers, ranked matches, and secure trade workflows built for global B2B commerce."
      },
      announcement: {
        type: String,
        trim: true,
        default: ""
      }
    },
    featuredExporterIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Exporter",
      default: []
    },
    platform: {
      maintenanceMode: {
        type: Boolean,
        default: false
      },
      allowNewRegistrations: {
        type: Boolean,
        default: true
      },
      supportEmail: {
        type: String,
        trim: true,
        default: "support@genuinetrade.com"
      }
    }
  },
  {
    timestamps: true
  }
);

const PlatformSetting = mongoose.model("PlatformSetting", platformSettingSchema);

export default PlatformSetting;
