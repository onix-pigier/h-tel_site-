"use client";

import { BedDouble, ClipboardList, Home, LogOut, Moon, ReceiptText, Sun, UserSquare2, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const items = [
  { title: "Réservations web", url: "/admin", icon: Users },
  { title: "Attributions", url: "/admin/attribuer", icon: ClipboardList },
  { title: "Registre", url: "/admin/registre", icon: ReceiptText },
  { title: "Clients", url: "/admin/clients", icon: UserSquare2 },
  { title: "Chambres", url: "/admin/chambres", icon: BedDouble },
];

export const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    await signOut();
    router.replace("/auth");
  };

  const isActive = (url: string) => {
    if (url === "/admin") return pathname === "/admin";
    return pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={cn("flex items-center gap-2 px-4 py-5", collapsed && "justify-center px-2")}>
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/80 flex items-center justify-center shadow-soft shrink-0">
            <Image src="/assets/logo.png" alt="Chanaude" width={32} height={32} className="object-contain" />
          </div>
          {!collapsed && <span className="font-display font-bold text-primary">Chanaude Admin</span>}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Exploitation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      className={cn(
                        "flex items-center gap-3 hover:bg-muted/60",
                        isActive(item.url) && "bg-accent/15 text-accent font-medium"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/" className="flex items-center gap-3 hover:bg-muted/60">
                    <Home className="w-4 h-4" />
                    {!collapsed && <span>Site public</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="hover:bg-muted/60">
                  {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {!collapsed && <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && user && <div className="px-3 pb-2 text-xs text-muted-foreground truncate">{user.email}</div>}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>Déconnexion</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
