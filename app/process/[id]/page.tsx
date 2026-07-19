import { redirect } from "next/navigation";

export default function ProcessRootPage({ params }: { params: { id: string } }) {
  redirect(`/process/${params.id}/phase1`);
}
