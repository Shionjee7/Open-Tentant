import { notFound } from "next/navigation";
import { getProperty } from "@/lib/data";
import PropertyForm from "@/components/PropertyForm";
import { BackLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Edit property" };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  return (
    <>
      <BackLink href={`/properties/${id}`} label={property.name} />
      <PageHeader title="Edit property" subtitle="Changes are kept as you work." />
      <PropertyForm property={property} />
    </>
  );
}
