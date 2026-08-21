import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CHANGE_PASSWORD_PATH, userMustChangePassword } from "@/lib/auth-password";
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

function redirectToLogin(request: NextRequest, cookieSource?: NextResponse) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
  const redirect = NextResponse.redirect(loginUrl);
  cookieSource?.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const hasSessionCookie = hasSupabaseSessionCookie(request.cookies.getAll());

  if (!hasSessionCookie) {
    return isPublicPath(pathname) ? response : redirectToLogin(request, response);
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
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return redirectToLogin(request, response);
  }

  if (isAuthenticated && pathname !== CHANGE_PASSWORD_PATH && !pathname.startsWith("/auth")) {
    if (userMustChangePassword(user)) {
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

