import { RequestLinkForm } from '@/components/forms/request-link-form';

export default async function MyJobPage() {
  return (
    <section className="space-y-5">
      <h1 className="text-4xl font-black">Manage Existing Job</h1>
      <p>Enter your email and reference number to access your HR file.</p>
      <RequestLinkForm />
    </section>
  );
}
