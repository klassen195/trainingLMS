"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Shield,
  LogOut,
  Menu,
  BookOpen,
  ClipboardList,
  UserRound,
} from "lucide-react";
import { signOut } from "@/app/actions";
import { cn } from "@/lib/cn";
import type { Profile, UserRole } from "@/lib/training-lms-types";
import { Button } from "@/components/ui/Button";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuInlineContent,
} from "@/components/ui/DropdownMenu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";

function hasRole(profile: Profile, roles: UserRole[]) {
  return roles.includes(profile.role);
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/programs", label: "Programs", icon: GraduationCap },
];

export function MainNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const showInstructor = profile ? hasRole(profile, ["instructor", "admin"]) : false;
  const showAdmin = profile ? hasRole(profile, ["admin"]) : false;
  const displayName = profile?.display_name ?? profile?.email ?? "Member";
  const initials = displayName.charAt(0).toUpperCase();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.push("/login");
    });
  }

  const allNavItems = [
    ...navItems,
    ...(showInstructor
      ? [
          { href: "/instructor", label: "Instructor", icon: BookOpen },
          { href: "/ems-qi", label: "EMS QI", icon: ClipboardList },
        ]
      : []),
  ];

  return (
    <nav className="relative z-[100] w-full overflow-visible border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={profile ? "/dashboard" : "/login"} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            FD
          </div>
          <span className="hidden sm:inline text-xl font-bold">TrainingLMS</span>
        </Link>

        <div className="relative hidden md:flex items-center gap-2">
          {profile
            ? allNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive(item.href) && "bg-accent text-accent-foreground"
                  )}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              ))
            : null}

          {profile ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuInlineContent className="w-56" align="end" sideOffset={8}>
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    {profile.email ? (
                      <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                    ) : null}
                    <p className="text-xs leading-none text-muted-foreground capitalize">{profile.role}</p>
                  </div>
                </DropdownMenuLabel>
                {showAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield className="mr-2 h-4 w-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <UserRound className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={pending} onSelect={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {pending ? "Signing out..." : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuInlineContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {profile ? (
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          ) : null}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>TrainingLMS menu</SheetDescription>
              </SheetHeader>
              <div className="mt-8 flex flex-col gap-2">
                {profile
                  ? allNavItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-accent",
                          isActive(item.href) && "bg-accent"
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    ))
                  : null}
                {showAdmin ? (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-accent"
                  >
                    <Shield className="h-5 w-5" />
                    Admin
                  </Link>
                ) : null}
                {profile ? (
                  <Link
                    href="/account"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-accent"
                  >
                    <UserRound className="h-5 w-5" />
                    Account
                  </Link>
                ) : null}
                {profile ? (
                  <>
                    <div className="my-2 border-t" />
                    <div className="flex items-center gap-3 px-4 py-2">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{displayName}</span>
                        <span className="text-xs text-muted-foreground capitalize">{profile.role}</span>
                      </div>
                    </div>
                    <Button variant="outline" className="mx-4" disabled={pending} onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </Button>
                  </>
                ) : (
                  <Button asChild className="mx-4">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
