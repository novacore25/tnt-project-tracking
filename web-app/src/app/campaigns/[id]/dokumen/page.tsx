import DokumenClient from "@/app/dokumen/DokumenClient";

export const metadata = {
  title: "Dokumen & Kontrak Campaign | TNT Project Tracking",
  description: "Pusat cetak dan generator dokumen kontrak kreator khusus campaign.",
};

export default async function CampaignDokumenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);

  return <DokumenClient initialCampaignId={campaignId} isCampaignScoped={true} />;
}
