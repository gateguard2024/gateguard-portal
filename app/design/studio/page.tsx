import { redirect } from "next/navigation";

// The design tool consolidated onto /design/floor-plans (evolved in place).
// This route redirects so there is a single design tool, not two.
export default function DesignStudioRedirect() {
  redirect("/design/floor-plans");
}
