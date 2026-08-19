import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { normalizeClientCode } from "@/lib/clients";
import { safeAppPath } from "@/lib/auth-redirect";

function loginRedirect(origin: string, error: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeAppPath(searchParams.get("next"));
  const clientCode = normalizeClientCode(searchParams.get("client") ?? "");

  if (!code) {
    return loginRedirect(origin, "auth_callback_failed");
  }

  if (!clientCode) {
    return loginRedirect(origin, "client_required");
  }

  const redirectUrl = `${origin}${next}`;
  const response = NextResponse.redirect(redirectUrl);

  let url: string;
  let anonKey: string;
  try {
    ({ url, anonKey } = getSupabaseEnv());
  } catch {
    return loginRedirect(origin, "auth_config_missing");
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return loginRedirect(origin, "auth_callback_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return loginRedirect(origin, "auth_callback_failed");
  }

  const { data: clientId, error: resolveError } = await supabase.rpc("resolve_client_id_by_code", {
    p_code: clientCode,
  });
  if (resolveError || !clientId) {
    await supabase.auth.signOut();
    return loginRedirect(origin, "invalid_client");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.client_id || profile.client_id !== clientId) {
    await supabase.auth.signOut();
    return loginRedirect(origin, "client_mismatch");
  }

  return response;
}
