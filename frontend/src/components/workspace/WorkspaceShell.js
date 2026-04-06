"use client";

import AppShell from "@/components/app/AppShell";

export default function WorkspaceShell({
  session,
  title,
  description,
  actions = null,
  children
}) {
  return (
    <AppShell actions={actions} session={session} subtitle={description} title={title}>
      {children}
    </AppShell>
  );
}
