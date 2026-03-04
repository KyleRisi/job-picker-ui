import { notFound } from 'next/navigation';
import { ApplyForm } from '@/components/forms/apply-form';
import { getJobById } from '@/lib/data';
import { getDefaultSalaryBenefits } from '@/lib/job-salary';
import { StatusPill } from '@/components/status-pill';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ApplyPage({ params }: { params: { id: string } }) {
  const job = await getJobById(params.id);
  if (!job) notFound();
  const isFilled = job.status === 'FILLED';
  const salary = job.salary_benefits?.trim() || getDefaultSalaryBenefits(job.job_ref || '');
  const todayLabel = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <section className="space-y-6">
      {isFilled ? (
        <>
          <div className="card overflow-hidden p-0">
            <div className="bg-carnival-ink/5 p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <p className="text-sm font-bold text-carnival-ink/70">{job.job_ref}</p>
                <div className="text-right">
                  <StatusPill status={job.status} sorryFilled />
                  <p className="text-xs font-semibold text-carnival-ink/70">{todayLabel}</p>
                </div>
              </div>
              <h1 className="text-3xl font-black leading-[1.05] text-carnival-ink sm:text-4xl md:text-5xl">{job.title}</h1>
              <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-carnival-ink/80">{job.description}</p>
            </div>
            <div className="space-y-2 border-t border-carnival-ink/10 bg-white px-6 py-5">
              <p className="text-lg"><strong>Salary:</strong> {salary}</p>
              <p className="text-lg"><strong>Reports to:</strong> {job.reports_to}</p>
            </div>
          </div>
          <div className="card">
            <p className="font-semibold">
              This role has already been filled and cannot accept applications right now.
            </p>
          </div>
        </>
      ) : (
        <ApplyForm
          jobId={job.id}
          jobRef={job.job_ref}
          jobTitle={job.title}
          jobDescription={job.description}
          jobStatus={job.status}
          salary={salary}
          reportsTo={job.reports_to}
        />
      )}
    </section>
  );
}
