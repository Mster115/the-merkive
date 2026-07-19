import { StageApp } from "@/components/StageApp";

export default async function StagePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <StageApp code={code} />;
}
