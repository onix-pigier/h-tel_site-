"use client";

import { BedDouble, History, Home, LogOut, Moon, ReceiptText, Sun, UserSquare2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const baseItems = [
  { title: "Tableau de bord", url: "/admin/dashboard", icon: Home },
  { title: "Registre", url: "/admin/registre", icon: ReceiptText },
  { title: "Clients", url: "/admin/clients", icon: UserSquare2 },
  { title: "Chambres", url: "/admin/chambres", icon: BedDouble },
];

const adminOnlyItems = [
  { title: "Journal d'audit", url: "/admin/audit", icon: History },
];

export const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    await signOut();
    router.replace("/auth");
  };

  const isActive = (url: string) => {
    return pathname.startsWith(url);
  };

  const visibleItems = isAdmin ? [...baseItems, ...adminOnlyItems] : baseItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={cn("flex items-center gap-2 px-4 py-5", collapsed && "justify-center px-2")}>
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/80 flex items-center justify-center shadow-soft shrink-0">
            <Image src="/assets/logo1.png" alt="Résidences Les Chanaude" width={48} height={48} className="object-contain" priority />
          </div>
          {!collapsed && <span className="font-bold text-primary text-sm leading-tight">Résidences<br/>Les Chanaude</span>}
        </div>

        <SidebarGroup>
         { /*<SidebarGroupLabel>Exploitation</SidebarGroupLabel> */}
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
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
