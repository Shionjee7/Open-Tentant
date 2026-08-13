import { notFound } from "next/navigation";
import { getPerson, listAllUnits, listProperties } from "@/lib/data";
import PersonForm from "@/components/PersonForm";
import { BackLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Edit tenant" };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, properties, units] = await Promise.all([
    getPerson(id),
    listProperties(),
    listAllUnits(),
  ]);
  if (!person || person.archived) notFound();

  const name = `${person.first_name} ${person.last_name}`.trim();
  return (
    <>
      <BackLink href={`/contacts?stage=${person.stage}`} label="Tenants" />
      <PageHeader title={name} subtitle="Changes are kept as you work." />
      <PersonForm person={person} properties={properties} units={units} />
    </>
  );
}
