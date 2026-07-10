import { redirect } from "next/navigation";

// History became the meditations page; keep the old address working.
export default function HistoryPage() {
  redirect("/meditations");
}
