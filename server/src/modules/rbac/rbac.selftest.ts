import { prisma } from "../../database/prisma.js";
import {
  clearPermissionCache,
  createRole,
  deleteRole,
  listRoles,
  permissionsFor,
  updateRole,
  userCan,
} from "./rbac.service.js";

const ok = (label: string, pass: boolean) =>
  console.log(`${pass ? "  PASS" : "  FAIL"}  ${label}`);

let failures = 0;
const check = (label: string, pass: boolean) => {
  if (!pass) failures += 1;
  ok(label, pass);
};

// --- a throwaway role with a deliberately narrow grant ---------------------
const NAME = "__rbac_test_role";

await prisma.role
  .delete({ where: { name: NAME } })
  .catch(() => {/* first run */});

const role = await createRole({
  name: NAME,
  description: "temporary, created by a test",
  permissions: ["collections:view", "collections:edit", "blog:view"],
});

console.log("\n1. A role holds exactly what it was granted");
const listed = (await listRoles()).find((r) => r.id === role.id)!;
check("three permissions stored", listed.permissions.length === 3);
check("collections:view granted", listed.permissions.includes("collections:view"));
check("collections:delete NOT granted", !listed.permissions.includes("collections:delete"));

// --- attach it to a real account, then read the effective set --------------
console.log("\n2. A user's effective permissions come from their role");
const subject = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

if (!subject) {
  console.log("  SKIPPED — no accounts in this database");
} else {
  const originalRoleId = subject.roleId;

  await prisma.user.update({ where: { id: subject.id }, data: { roleId: role.id } });
  clearPermissionCache();

  check("may edit collections", await userCan(subject.id, "collections", "edit"));
  check("may NOT delete collections", !(await userCan(subject.id, "collections", "delete")));
  check("may NOT view users", !(await userCan(subject.id, "users", "view")));
  check("may NOT view roles", !(await userCan(subject.id, "roles", "view")));

  const profile = await permissionsFor(subject.id);
  check("not treated as master", profile.isMaster === false);

  // --- 3. the master role is unconditional --------------------------------
  console.log("\n3. The master role holds everything, without stored rows");
  const master = await prisma.role.findFirst({ where: { isSystem: true } });

  if (master) {
    await prisma.user.update({ where: { id: subject.id }, data: { roleId: master.id } });
    clearPermissionCache();

    const asMaster = await permissionsFor(subject.id);
    check("flagged as master", asMaster.isMaster === true);
    check("may delete collections", await userCan(subject.id, "collections", "delete"));
    check("may edit roles", await userCan(subject.id, "roles", "edit"));

    const stored = await prisma.rolePermission.count({ where: { roleId: master.id } });
    check("holds it with zero stored rows", stored === 0);
  }

  // Put the account back exactly as it was.
  await prisma.user.update({
    where: { id: subject.id },
    data: { roleId: originalRoleId },
  });
  clearPermissionCache();
}

// --- 4. the guards that stop RBAC being used to lock everyone out ----------
console.log("\n4. Guard rails");

const master = await prisma.role.findFirst({ where: { isSystem: true } });

if (master) {
  let blocked = false;
  await updateRole(master.id, { name: "Renamed" }).catch(() => { blocked = true; });
  check("master role cannot be edited", blocked);

  blocked = false;
  await deleteRole(master.id).catch(() => { blocked = true; });
  check("master role cannot be deleted", blocked);
}

let rejected = false;
await createRole({
  name: "__rbac_bad_perm",
  permissions: ["collections:launch_rockets"],
}).catch(() => { rejected = true; });
check("a permission not in the catalogue is refused", rejected);

let duplicate = false;
await createRole({ name: NAME, permissions: [] }).catch(() => { duplicate = true; });
check("a duplicate role name is refused", duplicate);

// --- clean up --------------------------------------------------------------
await prisma.role.delete({ where: { name: NAME } }).catch(() => {});
await prisma.role.delete({ where: { name: "__rbac_bad_perm" } }).catch(() => {});

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
