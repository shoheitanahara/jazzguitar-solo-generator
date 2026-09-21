import { notFound } from "next/navigation";
import { getSongBySlug } from "@/lib/songs/catalog";
import { SongPracticePage } from "@/components/SongPracticePage";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function SongPage(props: Props) {
  const { slug } = await props.params;
  const entry = getSongBySlug(slug);
  if (!entry) notFound();
  return <SongPracticePage entry={entry} />;
}
