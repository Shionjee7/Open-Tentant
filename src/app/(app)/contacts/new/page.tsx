import { listAllUnits, listProperties } from "@/lib/data";
import PersonForm from "@/components/PersonForm";
import { BackLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Add tenant" };

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const [properties, units] = await Promise.all([listProperties(), listAllUnits()]);

  return (
    <>
      <BackLink href="/contacts" label="Tenants" />
      <PageHeader title="Add tenant" subtitle="Start with their name and where they live." />
      <PersonForm
        properties={properties}
        units={units}
        defaultStage={["lead", "applicant", "tenant", "past"].includes(stage ?? "") ? stage : "tenant"}
      />
    </>
  );
}
