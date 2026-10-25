import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateId } from "../../utils/helpers.js";
import { storageService } from "../../config/storage.service.js";
import { STORAGE_BUCKETS } from "../../config/storage.config.js";
import { TEAM_MESSAGES } from "./team.constants.js";

/**
 * The people shown on the website's Our Team page.
 *
 * One row per person: a name, a role, an optional line about them, an optional
 * photograph, whether they are shown, and where they sit in the line-up. The
 * photograph lives in Supabase Storage (bucket "team"); the row keeps only its
 * address.
 *
 * Every write here is a write to the API, so the public cache is emptied by the
 * middleware and the change is on the website at once.
 */

export interface TeamInput {
  name?: string;
  designation?: string;
  bio?: string;
  displayOrder?: number;
  isActive?: boolean;
  kind?: string;
  category?: string;
  /** True when the admin pressed "remove photo" without choosing a new one. */
  removePhoto?: boolean;
}

/** What the website needs, and nothing it does not. */
function toPublic(row: {
  id: string;
  name: string;
  designation: string;
  bio: string | null;
  photoUrl: string | null;
  kind: string;
  category: string;
}) {
  return {
    id: row.id,
    name: row.name,
    designation: row.designation,
    bio: row.bio,
    photoUrl: row.photoUrl,
    kind: row.kind,
    category: row.category,
  };
}

class TeamService {
  // ---- Public ----

  async listPublic() {
    const rows = await prisma.team_members.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    return rows.map(toPublic);
  }

  // ---- Admin ----

  listAdmin() {
    return prisma.team_members.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async getById(id: string) {
    const member = await prisma.team_members.findUnique({ where: { id } });
    if (!member) throw new ApiError(404, TEAM_MESSAGES.NOT_FOUND);
    return member;
  }

  private async uploadPhoto(file: Express.Multer.File) {
    // A timestamp keeps two people's "photo.jpg" apart; the bucket never
    // overwrites (upsert is off), so a clash would be an error rather than a
    // silent swap of someone else's picture.
    const safeName = file.originalname.replace(/[^A-Za-z0-9._-]/g, "_");
    return storageService.uploadFile(
      STORAGE_BUCKETS.TEAM,
      `members/${Date.now()}-${safeName}`,
      file.buffer,
      file.mimetype,
    );
  }

  private async deletePhoto(url?: string | null) {
    if (!url) return;
    const path = storageService.extractPathFromUrl(url, STORAGE_BUCKETS.TEAM);
    if (!path) return;
    await storageService.deleteFileSafe(STORAGE_BUCKETS.TEAM, path);
  }

  async create(input: Required<Pick<TeamInput, "name" | "designation">> & TeamInput, file?: Express.Multer.File) {
    const photoUrl = file ? await this.uploadPhoto(file) : null;

    try {
      // New people go to the end of the line unless an order is given.
      const displayOrder =
        input.displayOrder ?? ((await prisma.team_members.aggregate({ _max: { displayOrder: true } }))._max.displayOrder ?? -1) + 1;

      return await prisma.team_members.create({
        data: {
          id: generateId(),
          name: input.name,
          designation: input.designation,
          bio: input.bio || null,
          photoUrl,
          displayOrder,
          isActive: input.isActive ?? true,
          kind: input.kind ?? "leader",
          category: input.category ?? "promise-jewels",
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // The row did not save, so the picture just uploaded belongs to no one.
      await this.deletePhoto(photoUrl);
      throw error;
    }
  }

  async update(id: string, input: TeamInput, file?: Express.Multer.File) {
    const existing = await this.getById(id);

    const newPhotoUrl = file ? await this.uploadPhoto(file) : undefined;

    try {
      const photoUrl = newPhotoUrl !== undefined ? newPhotoUrl : input.removePhoto ? null : undefined;

      const member = await prisma.team_members.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.designation !== undefined ? { designation: input.designation } : {}),
          ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
          ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(photoUrl !== undefined ? { photoUrl } : {}),
          updatedAt: new Date(),
        },
      });

      // Only after the row points at the new picture is the old one let go.
      if (photoUrl !== undefined) await this.deletePhoto(existing.photoUrl);

      return member;
    } catch (error) {
      await this.deletePhoto(newPhotoUrl);
      throw error;
    }
  }

  async remove(id: string) {
    const member = await this.getById(id);
    await prisma.team_members.delete({ where: { id } });
    await this.deletePhoto(member.photoUrl);
    return { id };
  }

  async toggleStatus(id: string) {
    const member = await this.getById(id);
    return prisma.team_members.update({
      where: { id },
      data: { isActive: !member.isActive, updatedAt: new Date() },
    });
  }

  /** Saves a new line-up. `ids` is every person, first to last. */
  async reorder(ids: string[]) {
    await prisma.$transaction(
      ids.map((id, displayOrder) =>
        prisma.team_members.update({ where: { id }, data: { displayOrder, updatedAt: new Date() } }),
      ),
    );
    return { updated: ids.length };
  }
}

export default new TeamService();
