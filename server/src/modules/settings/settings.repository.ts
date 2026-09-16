import { prisma } from "../../database/prisma.js";
import { SETTINGS_ID, SETTINGS_DEFAULTS } from "./settings.constants.js";

class SettingsRepository {
  /**
   * Settings is a singleton table — exactly one row, id = SETTINGS_ID.
   * If nobody has saved settings yet, create the row with sane defaults
   * on first read instead of making every caller handle a null case.
   */
  async getOrCreate() {
    const existing = await prisma.settings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (existing) {
      return existing;
    }

    return prisma.settings.create({
      data: {
        id: SETTINGS_ID,
        ...SETTINGS_DEFAULTS,
        updatedAt: new Date(),
      },
    });
  }

  async update(data: Record<string, unknown>) {
    return prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        id: SETTINGS_ID,
        ...SETTINGS_DEFAULTS,
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}

export default new SettingsRepository();
