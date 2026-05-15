import { currentUser } from "@clerk/nextjs/server";

export interface PortalUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  orgId?: string;
}

export async function getCurrentUser(): Promise<PortalUser> {
  try {
    const user = await currentUser();
    if (!user) {
      return { id: "system", name: "Russel Feldman", initials: "RF", email: "rfeldman@gateguard.co" };
    }
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown";
    const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
    const email = user.emailAddresses[0]?.emailAddress ?? "";
    const orgId = (user.publicMetadata?.orgId as string) ?? undefined;
    return { id: user.id, name, initials, email, orgId };
  } catch {
    return { id: "system", name: "Russel Feldman", initials: "RF", email: "rfeldman@gateguard.co" };
  }
}
