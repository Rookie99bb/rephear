import type { Metadata } from "next";
import WhitepaperDocument from "@/components/WhitepaperDocument";
import document from "@/content/whitepaper-zh.json";

export const metadata: Metadata = {
  title: "产品与社区治理白皮书",
  description: "RepHear 公众版白皮书：社区身份、成长、治理，以及注册起 180 天内 5% 的直接邀请奖励。",
  alternates: { canonical: "/whitepaper/zh", languages: { en: "/whitepaper", "zh-CN": "/whitepaper/zh", "x-default": "/whitepaper" } },
};

export default function WhitepaperPage() {
  return <WhitepaperDocument document={document} language="zh" />;
}
