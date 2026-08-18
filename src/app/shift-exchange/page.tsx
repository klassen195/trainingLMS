import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth";

export default async function ShiftExchangeIndexPage() {
  await requireUserProfile();
  redirect("/shift-exchange/station/1");
}
