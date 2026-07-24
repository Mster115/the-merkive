import { DailyPlayShell } from "@/components/daily/DailyPlayShell";

export default async function DailyGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return <DailyPlayShell gameId={gameId} />;
}
