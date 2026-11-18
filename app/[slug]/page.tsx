import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Simulator from "@/components/public/Simulator";
import { getPublicProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return { title: "Simulador não encontrado" };

  const title = `Simule sua economia com energia solar | ${profile.company_name}`;
  const description = `Descubra em 1 minuto quanto você pode economizar na conta de luz com a ${profile.company_name}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.logo_url ? [{ url: profile.logo_url }] : undefined,
    },
  };
}

export default async function PublicSimulatorPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  return <Simulator profile={profile} />;
}
