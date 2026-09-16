import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "thepromisejewels@gmail.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log("✅ Admin already exists");
  } else {
    // Read from the environment because the repository is public.
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;

    if (!adminPassword) {
      throw new Error(
        "Set SEED_ADMIN_PASSWORD in .env to create the admin account.",
      );
    }

    await prisma.user.create({
      data: {
        name: "Admin",
        email: adminEmail,
        password: await bcrypt.hash(adminPassword, 10),
        isActive: true,
        isOtpVerified: true,
      },
    });

    console.log("✅ Admin created");
  }

  // Site settings. `update` is populated (not left empty like the admin user
  // above) so re-running the seed CORRECTS an existing row — that is the
  // point: the live database was still holding placeholder test values
  // (test@promisejewels.com / "Surat, Gujarat") which the public site reads
  // and renders. Running this once brings the deployed site in line.
  const siteSettings = {
    siteName: "Promise Jewels",
    email: "thepromisejewels@gmail.com",
    phone: "+91 95966 62900",
    address:
      "Sy No- 311/5, Laxmi Niwas, 1st Floor, Plot No - 101, Vasta Devdi Rd, Katargam, Surat, Gujarat 395004",
    businessHours: "Monday - Saturday\n10:00 AM - 7:00 PM\nSunday Closed",
    instagramUrl:
      "https://www.instagram.com/promise_jewels_pvt_ltd?igsi=ZDNlZDc0MzIxNw==",
    facebookUrl: "https://www.facebook.com/share/18UKWe1KTg/",
    linkedinUrl: "https://www.linkedin.com/company/promise-jewels/posts/?feedView=all",
    updatedAt: new Date(),
  };

  await prisma.settings.upsert({
    where: { id: "default" },
    update: siteSettings,
    create: { id: "default", ...siteSettings },
  });

  console.log("✅ Site settings updated");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
