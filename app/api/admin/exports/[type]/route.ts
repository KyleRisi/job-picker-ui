import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { toCsv } from '@/lib/utils';
import { requireAdminInApi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { type: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = createSupabaseAdminClient();

  if (params.type === 'active-roles') {
    const [{ data: jobs }, { data: assignments }] = await Promise.all([
      supabase
        .from('jobs')
        .select('id,job_ref,title,description,status,reports_to,salary_benefits')
        .order('job_ref', { ascending: false }),
      supabase.from('assignments').select('job_id,full_name').eq('active', true)
    ]);
    const byJob = new Map((assignments || []).map((a) => [a.job_id, a.full_name]));
    const rows = (jobs || []).map((job) => ({
      job_ref: job.job_ref,
      title: job.title,
      description: job.description,
      status: job.status,
      reports_to: job.reports_to,
      salary_benefits: job.salary_benefits || '',
      filled_full_name: job.status === 'FILLED' ? byJob.get(job.id) || '' : ''
    }));
    return csvResponse(rows, `active-roles-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
  }

  if (params.type === 'applications') {
    const { data } = await supabase
      .from('applications_archive')
      .select('*')
      .order('applied_at', { ascending: false });
    return csvResponse(data || [], `applications-archive-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
  }

  if (params.type === 'exit-interviews') {
    const { data } = await supabase
      .from('exit_interviews')
      .select('*')
      .order('created_at', { ascending: false });
    return csvResponse(data || [], `exit-interviews-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
  }

  return NextResponse.json({ error: 'Unknown export type' }, { status: 404 });
}

function csvResponse(rows: Array<Record<string, unknown>>, filename: string) {
  return new NextResponse(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      pragma: 'no-cache',
      expires: '0'
    }
  });
}
