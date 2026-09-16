import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashPassword } from "../../utils/password.js";
import { clearPermissionCache } from "../rbac/rbac.service.js";
import { MASTER_ROLE_NAME } from "../rbac/permissions.catalog.js";
import { logSecurityEvent } from "../../utils/securityLog.js";

/**
 * Admin accounts.
 *
 * Creating one here is the whole point of the screen: a person is given an
 * email, a password and a role, and from then on they sign in the same way
 * everyone else does — password, then the one-time code sent to that address.
 * There is no separate invite flow to maintain, and no window where an account
 * exists that cannot be signed into.
 *
 * The password hash and every OTP column are stripped from everything this
 * module returns. A list of admins is not a place to leak the shape of the
 * credentials.
 */

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  roleId: true,
  roleRef: { select: { id: true, name: true, isSystem: true } },
} as const;

export async function listUsers() {
  const users = await prisma.user.findMany({
    select: SAFE_SELECT,
    orderBy: [{ createdAt: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    role: user.roleRef
      ? { id: user.roleRef.id, name: user.roleRef.name, isSystem: user.roleRef.isSystem }
      : null,
  }));
}

async function assertRoleExists(roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new ApiError(404, "That role no longer exists.");
  return role;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  roleId: string;
}) {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "An account with that email already exists.");
  }

  await assertRoleExists(input.roleId);

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      password: await hashPassword(input.password),
      roleId: input.roleId,
      isActive: true,
    },
    select: SAFE_SELECT,
  });

  logSecurityEvent("user.created", { userId: user.id, email });

  return user;
}

export async function updateUser(
  id: string,
  input: { name?: string; roleId?: string; isActive?: boolean; password?: string },
  actingUserId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roleRef: true },
  });

  if (!user) throw new ApiError(404, "That account no longer exists.");

  // Locking yourself out is the one mistake this screen can make that nobody
  // else can undo for you, so it is refused rather than confirmed.
  if (id === actingUserId && input.isActive === false) {
    throw new ApiError(400, "You cannot deactivate your own account.");
  }

  if (id === actingUserId && input.roleId && input.roleId !== user.roleId) {
    throw new ApiError(
      400,
      "You cannot change your own role. Ask another administrator to do it.",
    );
  }

  // The last account holding Master is the way back in when a permission
  // change goes wrong. It must keep the role and stay active.
  if (user.roleRef?.name === MASTER_ROLE_NAME) {
    const masters = await prisma.user.count({
      where: { roleId: user.roleId, isActive: true },
    });

    const losingIt = input.roleId && input.roleId !== user.roleId;
    const beingDisabled = input.isActive === false;

    if (masters <= 1 && (losingIt || beingDisabled)) {
      throw new ApiError(
        400,
        "This is the last active Master account. Give another account the Master role first.",
      );
    }
  }

  if (input.roleId) await assertRoleExists(input.roleId);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { password: await hashPassword(input.password) } : {}),
      // A password or role change invalidates the session: whatever that
      // account is currently allowed to do, it should be re-decided.
      ...(input.password || input.roleId ? { refreshTokenHash: null } : {}),
    },
    select: SAFE_SELECT,
  });

  clearPermissionCache(id);

  return updated;
}

export async function deleteUser(id: string, actingUserId: string) {
  if (id === actingUserId) {
    throw new ApiError(400, "You cannot delete your own account.");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { roleRef: true },
  });

  if (!user) throw new ApiError(404, "That account no longer exists.");

  if (user.roleRef?.name === MASTER_ROLE_NAME) {
    const masters = await prisma.user.count({ where: { roleId: user.roleId } });

    if (masters <= 1) {
      throw new ApiError(
        400,
        "This is the last Master account and cannot be deleted.",
      );
    }
  }

  await prisma.user.delete({ where: { id } });
  clearPermissionCache(id);

  logSecurityEvent("user.deleted", { userId: id, email: user.email });
}
