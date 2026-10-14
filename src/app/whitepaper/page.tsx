import type { Metadata } from "next";
import WhitepaperDocument from "@/components/WhitepaperDocument";
import document from "@/content/whitepaper-en.json";

export const metadata: Metadata = {
  title: "Product and Community Governance Whitepaper",
  description: "RepHear public whitepaper: identity, participation, community governance, and 5% direct invitation rewards for 180 days.",
  alternates: { canonical: "/whitepaper", languages: { en: "/whitepaper", "zh-CN": "/whitepaper/zh", "x-default": "/whitepaper" } },
};

export default function WhitepaperPage() {
  return <WhitepaperDocument document={document} language="en" />;
}
