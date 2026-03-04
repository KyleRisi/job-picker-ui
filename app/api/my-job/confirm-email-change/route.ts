import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/my-job/file?error=Missing token', req.url));

  const admin = createSupabaseAdminClient();
  const { data: request } = await admin
    .from('email_change_requests')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .single();

  if (!request) {
    return NextResponse.redirect(new URL('/my-job/file?error=Invalid or expired email-change link', req.url));
  }

  const { data: assignment } = await admin
    .from('assignments')
    .select('assignment_ref')
    .eq('id', request.assignment_id)
    .single();

  const assignUpdate = await admin
    .from('assignments')
    .update({ email: request.new_email, user_id: request.user_id })
    .eq('id', request.assignment_id)
    .eq('active', true);

  if (assignUpdate.error) {
    return NextResponse.redirect(new URL('/my-job/file?error=Could not update assignment email', req.url));
  }

  if (assignment?.assignment_ref) {
    await admin
      .from('applications_archive')
      .update({ email: request.new_email, last_updated_at: new Date().toISOString() })
      .eq('assignment_ref', assignment.assignment_ref);
  }

  await admin.auth.admin.updateUserById(request.user_id, { email: request.new_email });
  await admin.from('email_change_requests').update({ used: true }).eq('id', request.id);

  return NextResponse.redirect(new URL('/my-job/file?success=Email updated successfully', req.url));
}
