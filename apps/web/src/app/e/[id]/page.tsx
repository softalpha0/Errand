import type { Metadata } from "next";
import { LiveErrand } from "./live";

export const metadata: Metadata = { title: "Errand in progress" };

export default async function ErrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveErrand id={id} />;
}
