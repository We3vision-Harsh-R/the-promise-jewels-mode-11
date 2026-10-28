import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  ALL_PERMISSIONS,
  MASTER_ROLE_NAME,
  RESOURCES,
  type Action,
  isValidPermission,
  permissionKey,
} from "./permissions.catalog.js";

/**
 * Reading and writing what a role may do.
 *
 * The permission set for one user is read on every protected request, so it is
 * cached in memory for a few seconds. That is a deliberate trade: a role edited
 * in one tab takes up to CACHE_TTL_MS to bite in another, and in exchange a
 * burst of requests from one admin does not become a burst of queries. Any
 * write through this service clears the cache immediately, so the delay only
 * ever applies to a change made somewhere this process cannot see — another
 * instance, or the database edited directly.
 */

const CACHE_TTL_MS = 10_000;

interface CachedPermissions {
  permissions: Set<string>;
  roleName: string | null;
  isMaster: boolean;
  expiresAt: number;
}

const cache = new Map<string, CachedPermissions>();

// The signed-in account, held beside its permissions. A request used to cost
// one database round trip for the account, then (for Prisma's nested select)
// three more for role and permissions - each a network hop to a database that
// is far from the server. Now ONE query reads all of it, and both caches are
// filled from it. Cleared by clearPermissionCache(id), which user.service
// calls whenever a role or the active flag changes.
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: string;
  lastLoginAt: Date | null;
};
const authUserCache = new Map<string, { user: AuthUser; expiresAt: number }>();
const AUTH_USER_MAX = 200;

export function clearAuthUserCache(userId?: string): void {
  if (userId) authUserCache.delete(userId);
  else authUserCache.clear();
}

async function loadBundle(userId: string): Promise<AuthUser | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      email: string;
      isActive: boolean;
      role: string;
      lastLoginAt: Date | null;
      roleName: string | null;
      isSystem: boolean | null;
      perms: Array<{ resource: string; action: string }>;
    }>
  >(Prisma.sql`
    SELECT
      u."id", u."name", u."email", u."isActive", u."role"::text AS "role", u."lastLoginAt",
      r."name" AS "roleName", r."isSystem" AS "isSystem",
      COALESCE(
        json_agg(json_build_object('resource', p."resource", 'action', p."action"))
          FILTER (WHERE p."id" IS NOT NULL),
        '[]'::json
      ) AS "perms"
    FROM "users" u
    LEFT JOIN "roles" r ON r."id" = u."roleId"
    LEFT JOIN "role_permissions" p ON p."roleId" = r."id"
    WHERE u."id" = ${userId}
    GROUP BY u."id", r."id"
  `);
  const row = rows[0];
  if (!row) return null;

  const isMaster = Boolean(row.isSystem && row.roleName === MASTER_ROLE_NAME);
  const now = Date.now();
  cache.set(userId, {
    permissions: new Set(
      isMaster ? ALL_PERMISSIONS : row.perms.map((p) => permissionKey(p.resource, p.action as Action)),
    ),
    roleName: row.roleName,
    isMaster,
    expiresAt: now + CACHE_TTL_MS,
  });

  const user: AuthUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    isActive: row.isActive,
    role: row.role,
    lastLoginAt: row.lastLoginAt,
  };
  if (authUserCache.size >= AUTH_USER_MAX) authUserCache.clear();
  authUserCache.set(userId, { user, expiresAt: now + CACHE_TTL_MS });
  return user;
}

/** The account for a request, from cache or one query. null = no such user. */
export async function getAuthUser(userId: string): Promise<AuthUser | null> {
  const hit = authUserCache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.user;
  return loadBundle(userId);
}

export function clearPermissionCache(userId?: string): void {
  clearAuthUserCache(userId);
  if (userId) cache.delete(userId);
  else cache.clear();
}

/**
 * What this user may do, right now.
 *
 * A user with no role gets an empty set rather than an error: having no
 * permissions is a valid state, and it is the state every account created
 * before RBAC existed is in until someone assigns it a role.
 */
export async function permissionsFor(userId: string): Promise<{
  permissions: Set<string>;
  roleName: string | null;
  isMaster: boolean;
}> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit;

  await loadBundle(userId);
  const loaded = cache.get(userId);
  if (loaded) return loaded;

  // No such account: nothing is granted.
  return { permissions: new Set<string>(), roleName: null, isMaster: false };
}

export async function userCan(
  userId: string,
  resource: string,
  action: Action,
): Promise<boolean> {
  const { permissions } = await permissionsFor(userId);
  return permissions.has(permissionKey(resource, action));
}

/** The catalogue plus this user's grants — what the panel needs to draw itself. */
export async function accessProfileFor(userId: string) {
  const { permissions, roleName, isMaster } = await permissionsFor(userId);

  return {
    role: roleName,
    isMaster,
    // Sent as a plain array so the browser holds exactly what the server
    // checked, rather than deriving its own idea of the same thing.
    permissions: [...permissions],
    resources: RESOURCES,
  };
}

// --- roles ----------------------------------------------------------------

function assertPermissionList(permissions: string[]): void {
  const unknown = permissions.filter((p) => !isValidPermission(p));

  if (unknown.length > 0) {
    throw new ApiError(
      400,
      `Unknown permission${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
    );
  }
}

export async function listRoles() {
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      permissions: { select: { resource: true, action: true } },
      _count: { select: { users: true } },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.users,
    // The master role's grants are implicit; report them in full so the form
    // shows the truth rather than an empty set it would then try to save.
    permissions:
      role.isSystem && role.name === MASTER_ROLE_NAME
        ? ALL_PERMISSIONS
        : role.permissions
            .map((p) => permissionKey(p.resource, p.action as Action))
            // A grant for a screen that no longer exists (the removed Exhibition
            // operations, for one) is left in the table but not offered back, so
            // saving the role cannot be refused over it.
            .filter(isValidPermission),
    createdAt: role.createdAt,
  }));
}

export async function createRole(input: {
  name: string;
  description?: string;
  permissions: string[];
}) {
  assertPermissionList(input.permissions);

  const existing = await prisma.role.findUnique({ where: { name: input.name } });
  if (existing) throw new ApiError(409, "A role with that name already exists.");

  const role = await prisma.role.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      permissions: {
        create: input.permissions.map((key) => {
          const [resource, action] = key.split(":");
          return { resource, action };
        }),
      },
    },
  });

  return role;
}

export async function updateRole(
  id: string,
  input: { name?: string; description?: string; permissions?: string[] },
) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new ApiError(404, "That role no longer exists.");

  // The master role is the way back in when a permission change locks everyone
  // out of everything. It cannot be renamed or reduced.
  if (role.isSystem) {
    throw new ApiError(
      400,
      `${role.name} is a system role — its name and permissions are fixed.`,
    );
  }

  if (input.permissions) assertPermissionList(input.permissions);

  if (input.name && input.name !== role.name) {
    const clash = await prisma.role.findUnique({ where: { name: input.name } });
    if (clash) throw new ApiError(409, "A role with that name already exists.");
  }

  // Replace rather than diff: the form always posts the full set, so anything
  // absent from it was deliberately unticked.
  return prisma.$transaction(async (tx) => {
    if (input.permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: input.permissions.map((key) => {
          const [resource, action] = key.split(":");
          return { roleId: id, resource, action };
        }),
      });
    }

    const updated = await tx.role.update({
      where: { id },
      data: {
        name: input.name ?? role.name,
        description: input.description ?? role.description,
      },
    });

    clearPermissionCache();
    return updated;
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!role) throw new ApiError(404, "That role no longer exists.");

  if (role.isSystem) {
    throw new ApiError(400, `${role.name} is a system role and cannot be deleted.`);
  }

  // Deleting a role that people hold would silently strip their access, which
  // is a security change disguised as tidying up. Make it explicit instead.
  if (role._count.users > 0) {
    throw new ApiError(
      409,
      `${role._count.users} account${role._count.users > 1 ? "s hold" : " holds"} this role. Move them to another role first.`,
    );
  }

  await prisma.role.delete({ where: { id } });
  clearPermissionCache();
}

/**
 * Creates the master role if it is missing, and gives it to any account that
 * has no role at all.
 *
 * Run at boot. Without it, the first deploy of RBAC would lock the existing
 * admin out of the panel entirely: every account predates the roles table, so
 * every account would have an empty permission set and no way to grant itself
 * one.
 */
export async function ensureMasterRole(): Promise<void> {
  const master = await prisma.role.upsert({
    where: { name: MASTER_ROLE_NAME },
    update: { isSystem: true },
    create: {
      name: MASTER_ROLE_NAME,
      description:
        "Full control of the panel, including roles and accounts. Cannot be edited or deleted.",
      isSystem: true,
    },
  });

  const orphaned = await prisma.user.updateMany({
    where: { roleId: null },
    data: { roleId: master.id },
  });

  if (orphaned.count > 0) clearPermissionCache();
}
