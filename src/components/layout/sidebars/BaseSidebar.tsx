"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";
import { useSidebarStore } from "@/store/useSidebarStore";

export interface SidebarLink {
  title: string;
  href?: string;
  icon?: React.ElementType;
  subLinks?: { title: string; href: string; icon?: React.ElementType }[];
  isSeparator?: boolean;
}

interface BaseSidebarProps {
  links: SidebarLink[];
}

export function BaseSidebar({ links }: BaseSidebarProps) {
  const pathname = usePathname();
  const { role, signOut } = useUser();
  const { isMobileOpen, setMobileOpen } = useSidebarStore();
  const [openMenus, setOpenMenus] = React.useState<Record<string, boolean>>({});

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const currentTheme = {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/10",
    logoBg: "bg-blue-600"
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen flex flex-col w-[240px]",
          "bg-white dark:bg-[#080b14] border-r border-slate-200 dark:border-white/10",
          "transition-transform duration-300 ease-in-out lg:relative",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ── Logo / Brand ── */}
        <div className="flex h-16 items-center border-b border-slate-200 dark:border-white/10 flex-shrink-0 px-5 gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-black text-sm", currentTheme.logoBg)}>
            <span>M</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight tracking-tight">
              Malee House
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest leading-tight">Survey Workflow</p>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3 space-y-0.5">
          {links.map((link, idx) => {
            if (link.isSeparator) {
              return (
                <div key={`sep-${idx}`} className="my-2.5 border-t border-slate-200 dark:border-white/10" />
              );
            }
            if (link.subLinks && link.subLinks.length > 0) {
              const isOpen = openMenus[link.title];
              const isAnyChildActive = link.subLinks.some((sub: any) => pathname === sub.href || pathname.startsWith(sub.href + "/"));
              const Icon = link.icon || (() => null);
              return (
                <div key={link.title} className="space-y-0.5">
                  <button
                    onClick={() => toggleMenu(link.title)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                      isAnyChildActive
                        ? cn(currentTheme.bg, currentTheme.text, "border", currentTheme.border)
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "w-[18px] h-[18px] flex-shrink-0",
                          isAnyChildActive ? currentTheme.text.split(' ')[0] : "text-gray-400"
                        )}
                        strokeWidth={isAnyChildActive ? 2.2 : 1.8}
                      />
                      <span className="truncate">{link.title}</span>
                    </div>
                    <ChevronDown
                      className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isOpen ? "rotate-180" : "")}
                    />
                  </button>
                  {isOpen && (
                    <div className="pl-9 pr-2 py-1 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
                      {link.subLinks.map((sub: any) => {
                        const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/");
                        const SubIcon = sub.icon;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            prefetch={true}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200",
                              isSubActive
                                ? cn(currentTheme.bg, currentTheme.text)
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                            )}
                          >
                            {SubIcon ? <SubIcon className="w-3.5 h-3.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />}
                            <span className="truncate">{sub.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Normal links
            const exactMatchRoutes = ["/admin", "/accounts", "/sales", "/engineering", "/field", "/hr"];
            const isActive = link.href && exactMatchRoutes.includes(link.href)
              ? pathname === link.href
              : link.href && (pathname === link.href || pathname.startsWith(link.href + "/"));

            const Icon = link.icon || (() => null);

            return (
              <Link
                key={link.title}
                href={link.href || "#"}
                prefetch={true}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                  isActive
                    ? cn(currentTheme.bg, currentTheme.text, "border", currentTheme.border)
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "w-[18px] h-[18px] flex-shrink-0",
                    isActive ? currentTheme.text.split(' ')[0] : "text-gray-400 group-hover:text-gray-600"
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className="truncate">{link.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Profile & Sign Out ── */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 space-y-1">
          <Link
            href="/profile"
            prefetch={true}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 text-sm font-bold rounded-xl transition-all duration-200",
              pathname === "/profile"
                ? cn(currentTheme.bg, currentTheme.text, "border", currentTheme.border)
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <User
              className={cn(
                "w-[18px] h-[18px] flex-shrink-0",
                pathname === "/profile" ? currentTheme.text.split(' ')[0] : "text-gray-400"
              )}
              strokeWidth={pathname === "/profile" ? 2.2 : 1.8}
            />
            <span>My Profile</span>
          </Link>

          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
