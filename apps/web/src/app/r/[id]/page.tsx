import type { Metadata } from "next";
import { ReceiptPage } from "./receipt-page";

export const metadata: Metadata = {
  title: "Receipt",
  description: "Every payment an Errand agent made, why it was approved, and what was blocked.",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptPage id={id} />;
}
