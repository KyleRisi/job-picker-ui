import { RecoverForm } from '@/components/forms/recover-form';

export default function RecoverPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-black">Recover reference number</h1>
      <p>If we find an active assignment, we&apos;ll email your reference and manage link.</p>
      <RecoverForm />
    </section>
  );
}
