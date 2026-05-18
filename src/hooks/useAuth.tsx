"use client";

import { useSession, signOut } from "next-auth/react";

interface AuthValue {
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
    isStaff: boolean;
    isAdmin: boolean;
  } | null;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const useAuth = (): AuthValue => {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const user = session?.user
    ? {
        id: session.user.id ?? "",
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        roles: session.user.roles ?? [],
        isStaff: session.user.isStaff ?? false,
        isAdmin: session.user.isAdmin ?? false,
      }
    : null;

  return {
    user,
    roles: user?.roles ?? [],
    isStaff: user?.isStaff ?? false,
    isAdmin: user?.isAdmin ?? false,
    loading,
    signOut: async () => { await signOut({ redirect: false }); },
  };
};
