"use client";

// ---------------------------------------------------------------------------
// /admin/users -- admin management page
// ---------------------------------------------------------------------------
//
// Lists every admin (active + disabled) with their enrolment and last-login
// state, and lets the signed-in admin:
//   - Create a new admin (username + password). The new admin enrols TOTP
//     on their first login; we never set/see their TOTP secret here.
//   - Disable / re-enable another admin.
//   - Reset another admin's TOTP (forces them to re-enrol on next login).
//
// Self-protection: the row for the current admin shows a disabled
// action menu so a slip can't lock you out. The same protection is
// enforced server-side.
//
// Audit log section at the bottom shows the most recent lifecycle events
// so you can confirm an action took effect or trace an unexpected one.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminRow {
  id: number;
  username: string;
  createdAt: string;
  createdBy: number | null;
  lastLoginAt: string | null;
  enrolledAt: string | null;
  disabledAt: string | null;
}

interface AuditEntry {
  id: number;
  actorId: number | null;
  targetAdminId: number | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

const CSRF_HEADERS = {
  "Content-Type": "application/json",
  "x-elv8-admin": "1",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [meId, setMeId] = useState<number | null>(null);

  async function refresh() {
    setError("");
    try {
      const [adminsRes, auditRes, meRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/users/audit?limit=50"),
        fetch("/api/admin/me").catch(() => null),
      ]);
      if (adminsRes.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      if (!adminsRes.ok) {
        setError("Could not load admins.");
        return;
      }
      const adminsBody = await adminsRes.json();
      setAdmins(adminsBody.admins || []);
      if (auditRes.ok) {
        const auditBody = await auditRes.json();
        setAudit(auditBody.entries || []);
      }
      if (meRes && meRes.ok) {
        const meBody = await meRes.json();
        if (typeof meBody.id === "number") setMeId(meBody.id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: CSRF_HEADERS,
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not create admin.");
        return;
      }
      setInfo(
        `Created '${body.admin.username}'. They'll set up their authenticator on first login.`,
      );
      setNewUsername("");
      setNewPassword("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: number, path: string, body?: unknown) {
    setError("");
    setInfo("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/${path}`, {
        method: "PATCH",
        headers: CSRF_HEADERS,
        body: body ? JSON.stringify(body) : undefined,
      });
      const respBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(respBody.error || "Action failed.");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F1626]">
        <p className="text-sm text-[#8A96AC]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1626] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="text-xs text-[#8A96AC] hover:text-[#2563EB]"
            >
              ← Back to dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-[#F5F7FB]">Admins</h1>
            <p className="text-sm text-[#8A96AC]">
              Manage who can sign in to the admin area.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            {info}
          </div>
        )}

        {/* Create form */}
        <section className="mb-8 rounded-xl border border-[#1E2A3F] bg-[#121A2B] p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#F5F7FB]">
            Add a new admin
          </h2>
          <p className="mt-1 text-xs text-[#8A96AC]">
            They&rsquo;ll sign in with this username + password, then set up
            their authenticator app on first login.
          </p>
          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div>
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) =>
                  setNewUsername(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9._-]/g, "")
                      .slice(0, 100),
                  )
                }
                required
                placeholder="e.g. sarah"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-password">Temporary password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.slice(0, 200))}
                required
                minLength={12}
                placeholder="≥ 12 characters"
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={creating || newUsername.length < 1 || newPassword.length < 12}
              className="bg-[#2563EB] text-white hover:bg-[#15608c]"
            >
              {creating ? "Creating…" : "Create admin"}
            </Button>
          </form>
        </section>

        {/* Admin list */}
        <section className="rounded-xl border border-[#1E2A3F] bg-[#121A2B] shadow-sm">
          <div className="border-b border-[#1E2A3F] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#F5F7FB]">
              All admins ({admins.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0F1626] text-left text-xs uppercase tracking-wide text-[#8A96AC]">
                <tr>
                  <th className="px-5 py-2">Username</th>
                  <th className="px-5 py-2">Created</th>
                  <th className="px-5 py-2">Last login</th>
                  <th className="px-5 py-2">2FA</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => {
                  const isMe = meId === a.id;
                  const isDisabled = a.disabledAt !== null;
                  return (
                    <tr
                      key={a.id}
                      className="border-t border-[#1E2A3F] text-[#D4DBEC]"
                    >
                      <td className="px-5 py-3 font-medium text-[#F5F7FB]">
                        {a.username}
                        {isMe && (
                          <span className="ml-2 rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[11px] text-[#2563EB]">
                            you
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#8A96AC]">
                        {formatDate(a.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-xs text-[#8A96AC]">
                        {formatDate(a.lastLoginAt)}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {a.enrolledAt ? (
                          <span className="text-emerald-700">Enrolled</span>
                        ) : (
                          <span className="text-amber-600">Pending setup</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {isDisabled ? (
                          <span className="text-red-600">Disabled</span>
                        ) : (
                          <span className="text-[#D4DBEC]">Active</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-xs">
                        {isMe ? (
                          <span className="text-[#8A96AC]">—</span>
                        ) : (
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            {!isDisabled && (
                              <button
                                type="button"
                                onClick={() =>
                                  patch(a.id, "reset-totp")
                                }
                                disabled={busyId === a.id}
                                className="rounded-md border border-[#1E2A3F] px-2 py-1 text-[#D4DBEC] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50"
                              >
                                Reset 2FA
                              </button>
                            )}
                            {isDisabled ? (
                              <button
                                type="button"
                                onClick={() =>
                                  patch(a.id, "disable", { enabled: true })
                                }
                                disabled={busyId === a.id}
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 hover:border-emerald-400 disabled:opacity-50"
                              >
                                Re-enable
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  patch(a.id, "disable", { enabled: false })
                                }
                                disabled={busyId === a.id}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700 hover:border-red-400 disabled:opacity-50"
                              >
                                Disable
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Audit log */}
        <section className="mt-8 rounded-xl border border-[#1E2A3F] bg-[#121A2B] shadow-sm">
          <div className="border-b border-[#1E2A3F] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#F5F7FB]">
              Recent admin events
            </h2>
            <p className="text-xs text-[#8A96AC]">
              Each admin lifecycle action is logged here. Login activity is
              recorded as &ldquo;Last login&rdquo; on the row above instead.
            </p>
          </div>
          {audit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#8A96AC]">
              No events yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#1E2A3F]">
              {audit.map((e) => {
                const actor =
                  e.actorId === null
                    ? "system (bootstrap script)"
                    : admins.find((a) => a.id === e.actorId)?.username ||
                      `admin #${e.actorId}`;
                const target =
                  e.targetAdminId === null
                    ? "—"
                    : admins.find((a) => a.id === e.targetAdminId)?.username ||
                      `admin #${e.targetAdminId}`;
                return (
                  <li
                    key={e.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 text-xs"
                  >
                    <span className="font-mono text-[#8A96AC]">
                      {formatDate(e.createdAt)}
                    </span>
                    <span className="text-[#D4DBEC]">
                      <span className="font-medium text-[#F5F7FB]">
                        {actor}
                      </span>{" "}
                      &nbsp;{prettyAction(e.action)}&nbsp;{" "}
                      <span className="font-medium text-[#F5F7FB]">
                        {target}
                      </span>
                    </span>
                    <span className="text-[#8A96AC]">#{e.id}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function prettyAction(action: string): string {
  switch (action) {
    case "created":
      return "created";
    case "disabled":
      return "disabled";
    case "enabled":
      return "re-enabled";
    case "reset_totp":
      return "reset 2FA for";
    case "enrollment_completed":
      return "completed 2FA enrolment for";
    default:
      return action;
  }
}
