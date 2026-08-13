import PropertyForm from "@/components/PropertyForm";
import { BackLink, PageHeader } from "@/components/ui";

export const metadata = { title: "Add property" };

export default function NewPropertyPage() {
  return (
    <>
      <BackLink href="/properties" label="Properties" />
      <PageHeader title="Add property" subtitle="Start with the address and rent. Optional details can wait." />
      <PropertyForm />
    </>
  );
}
