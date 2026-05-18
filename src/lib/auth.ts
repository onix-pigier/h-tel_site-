import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email = credentials?.email?.trim().toLowerCase();
          const password = credentials?.password;
          if (!email || !password) return null;

          const user = await prisma.user.findUnique({
            where: { email },
            include: { roles: true },
          });

          if (!user) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
            roles: user.roles.map((role) => role.role),
          };
        } catch (error) {
          console.error("[AUTH] authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roles = user.roles ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const roles = token.roles ?? [];
        session.user.id = token.userId;
        session.user.roles = roles;
        session.user.isAdmin = roles.includes("admin");
        session.user.isStaff = roles.includes("admin") || roles.includes("gerant");
      }
      return session;
    },
  },
};
