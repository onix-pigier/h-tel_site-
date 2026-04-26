import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/auth" },
  callbacks: {
    authorized({ token, req }) {
      const path = req.nextUrl.pathname;

      // Admin pages and API admin routes require staff role
      if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
        const roles = (token?.roles as string[]) ?? [];
        return roles.includes("admin") || roles.includes("manager");
      }

      return !!token;
    },
  },
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
