import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ApiClientsAdmin } from "./api-clients-admin";

export default async function ApiClientsPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <ApiClientsAdmin />;
}
