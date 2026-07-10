import type { Metadata } from "next";

import HomeClient from "./home-client";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export const revalidate = 86400;

export default function Page() {
  return <HomeClient currentYear={new Date().getFullYear()} />;
}
