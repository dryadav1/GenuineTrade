import PlatformSetting from "../models/PlatformSetting.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeExporter } from "../utils/serializers.js";

export const getPublicPlatformContent = asyncHandler(async (req, res) => {
  const settings = await PlatformSetting.findOne({ singletonKey: "platform" }).populate({
    path: "featuredExporterIds",
    populate: {
      path: "userId",
      select: "email phone role"
    }
  });

  if (!settings) {
    res.json({
      homepage: {
        heroTitle: "Where Genuine Exporters Meet Real Buyers",
        heroSubtitle:
          "Verified suppliers, ranked matches, and secure trade workflows built for global B2B commerce.",
        announcement: ""
      },
      platform: {
        maintenanceMode: false,
        allowNewRegistrations: true,
        supportEmail: "support@genuinetrade.com"
      },
      featuredExporters: []
    });
    return;
  }

  res.json({
    homepage: settings.homepage,
    platform: settings.platform,
    featuredExporters: settings.featuredExporterIds.map(serializeExporter)
  });
});
