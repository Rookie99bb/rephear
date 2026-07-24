"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getCurrentAdmin } from "@/lib/admin";
import {
  setUserLocation,
  setUserAdmin,
  countAdmins,
  findUserById,
} from "@/db/users";
import { isValidLocation } from "@/lib/locations";
import { recordAuditLog, AUDIT_ACTIONS } from "@/db/auditLog";
import { getRequestContext } from "@/lib/requestContext";

export interface ActionResult {
  error?: string;
}

// Used both for the required first-time choice (LocationGate) and for
// changing it later from Settings.
export async function setLocationAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to set a location." };
  }

  const location = String(formData.get("location") || "").trim();
  if (!isValidLocation(location)) {
    return { error: "Please choose a valid location." };
  }

  await setUserLocation(user.id, location);
  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/settings");
  return {};
}

// Plain (formData) => Promise<void> wrapper for binding directly to a
// native <form action={...}> without useFormState (used by LocationGate
// and Settings, which don't need per-field error state).
export async function submitLocationAction(formData: FormData): Promise<void> {
  await setLocationAction({}, formData);
}

export interface SetAdminResult {
  error?: string;
}

// Grants or revokes admin access for another user. Only an existing
// admin may call this (see src/app/admin/users). Two safety guards
// beyond the auth check: an admin can't revoke their own access (so
// nobody accidentally locks themselves out of the panel mid-edit), and
// the very last remaining admin can never be revoked by anyone (so the
// panel can never become fully inaccessible without editing
// ADMIN_EMAILS in Render and redeploying to bootstrap a way back in).
export async function setUserAdminAction(
  targetUserId: string,
  makeAdmin: boolean
): Promise<SetAdminResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Forbidden." };

  const target = await findUserById(targetUserId);
  if (!target) return { error: "User not found." };

  if (!makeAdmin) {
    if (target.id === admin.id) {
      return { error: "You can't remove your own admin access." };
    }
    if (target.isAdmin && (await countAdmins()) <= 1) {
      return {
        error:
          "Can't remove the last remaining admin — add another admin first.",
      };
    }
  }

  await setUserAdmin(targetUserId, makeAdmin);
  await recordAuditLog({
    actorUserId: admin.id,
    action: makeAdmin
      ? AUDIT_ACTIONS.ADMIN_GRANTED
      : AUDIT_ACTIONS.ADMIN_REVOKED,
    targetType: "user",
    targetId: targetUserId,
    details: { email: target.email, name: target.name },
    ...getRequestContext(),
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return {};
}
