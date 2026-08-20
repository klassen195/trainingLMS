import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CHANGE_PASSWORD_PATH, claimsMustChangePassword, userMustChangePassword } from "@/lib/auth-password";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { hasSupabaseSessionCookie } from "@/lib/supabase/session-cookie";

const PUBLIC_FILE = /\.(.*)$/;

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    PUBLIC_FILE.test(pathname)
  );
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const hasSessionCookie = hasSupabaseSessionCookie(request.cookies.getAll());

  if (!hasSessionCookie) {
    return isPublicPath(pathname) ? response : redirectToLogin(request);
  }

  let url: string;
  let anonKey: string;
  try {
    ({ url, anonKey } = getSupabaseEnv());
  } catch {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claimsData?.claims?.sub);

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return redirectToLogin(request);
  }

  if (isAuthenticated && pathname !== CHANGE_PASSWORD_PATH && !pathname.startsWith("/auth")) {
    let mustChange = claimsMustChangePassword(claimsData?.claims as Record<string, unknown> | undefined);
    if (mustChange) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      mustChange = userMustChangePassword(user);
    }
    if (mustChange) {
      const changeUrl = request.nextUrl.clone();
      changeUrl.pathname = CHANGE_PASSWORD_PATH;
      changeUrl.search = "";
      if (!isPublicPath(pathname)) {
        changeUrl.searchParams.set("next", pathname);
      }
      const redirect = NextResponse.redirect(changeUrl);
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie);
      });
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

