import { z } from "zod";

// Section and slot schemas used to live here. Hero-ring frames are ordinary
// Editor fields now (see media.constants.ts), so the only parameter this
// module still validates is the asset id on DELETE.

export const idParamSchema = z.object({
  id: z.string().min(1),
});
