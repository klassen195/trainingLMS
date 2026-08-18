export const DEFAULT_CLIENT_CODE = "CLIENT1";
export const DEFAULT_CLIENT_ID = "a0000000-0000-4000-8000-000000000001";

export type Client = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function normalizeClientCode(code: string): string {
  return code.trim().toUpperCase();
}
