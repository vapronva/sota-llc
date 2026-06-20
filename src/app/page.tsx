import type { Metadata } from "next";

import HomeClient from "./home-client";

export const metadata: Metadata = {
  title: "SOTA",
  description: "Мы SOTA… потому что мы SOTA.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return <HomeClient currentYear={new Date().getFullYear()} />;
}
