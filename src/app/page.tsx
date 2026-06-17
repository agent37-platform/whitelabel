import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const { user } = await getSession();
  redirect(user ? "/dashboard" : "/login");
}
