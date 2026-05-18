"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

const pageTitles = [
  { prefix: "/admin/dashboard", title: "Tableau de bord" },
  { prefix: "/admin/registre", title: "Registre" },
  { prefix: "/admin/clients", title: "Clients" },
  { prefix: "/admin/chambres", title: "Chambres" },
  { prefix: "/admin/audit", title: "Journal d'audit" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentTitle = pageTitles.find((item) => pathname.startsWith(item.prefix))?.title ?? "Administration";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center gap-3 border-b bg-background/80 backdrop-blur px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="font-semibold text-primary">{currentTitle}</div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
