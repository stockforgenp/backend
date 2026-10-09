import { AdminService } from "../services/admin.service";

async function main() {
  console.log("🌱 Seeding Super Admin user...");
  try {
    const admin = await AdminService.seedSuperAdmin();
    console.log("🎉 Super Admin configured successfully:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}`);
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Failed to seed Super Admin:", err.message);
    process.exit(1);
  }
}

main();
