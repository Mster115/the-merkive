import { DailyPlayShell } from "@/components/daily/DailyPlayShell";

export default async function DailyArchivePage({
  params,
}: {
  params: Promise<{ gameId: string; date: string }>;
}) {
  const { gameId, date } = await params;
  return <DailyPlayShell gameId={gameId} explicitDate={date} />;
}
