import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/capability-access";

export default async function ShiftExchangeIndexPage() {
  await requireCapability("access_shift_exchange");
  redirect("/shift-exchange/station/1");
}
