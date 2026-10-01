import { AppShell } from '../../../components/app-shell';
import { Consultation } from '../../../components/consultation';

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <Consultation id={id} />
    </AppShell>
  );
}
