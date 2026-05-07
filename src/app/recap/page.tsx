import { redirect } from "next/navigation";
import { getWeekStart, getISOWeekString } from "@/lib/data/recap";

export default function RecapIndexPage() {
  // The current week is in progress; redirect to the last completed week.
  const now = new Date();
  const lastMonday = getWeekStart(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  redirect(`/recap/${getISOWeekString(lastMonday)}`);
}
