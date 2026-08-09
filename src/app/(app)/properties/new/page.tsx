import { createProperty } from "@/lib/actions";
import PropertyForm from "@/components/PropertyForm";
import { BackLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Add property" };

export default function NewPropertyPage() {
  return (
    <>
      <BackLink href="/properties" label="Properties" />
      <PageHeader title="Add property" subtitle="Rentals, listings, and applications all hang off a property." />
      <PropertyForm action={createProperty} submitLabel="Create property" />
    </>
  );
}
