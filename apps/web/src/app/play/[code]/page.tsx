import { ControllerApp } from "@/components/ControllerApp";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  // /play/CODE?new=1 forces the join gate with a fresh identity, so one
  // browser can seat several local players (pass-and-play, multi-tab).
  return <ControllerApp code={code} forceNewSeat={sp.new === "1"} />;
}
