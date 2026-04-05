import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MasterConfigAdmin } from "./master-config-admin";

export default async function MasterConfigPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <MasterConfigAdmin />;
}
