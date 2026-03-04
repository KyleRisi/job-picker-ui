import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { badRequest, ok } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getClientIp, normalizeEmail } from '@/lib/utils';
import { isEmailEnabled, sendApplicationConfirmationEmail } from '@/lib/email';

const schema = z.object({
  jobId: z.string().uuid(),
  assignmentRef: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v;
      const trimmed = v.trim();
      return trimmed.length ? trimmed : undefined;
    },
    z.string().min(1).optional()
  ),
  fullName: z.string().min(2),
  email: z.string().email(),
  q1: z.string().min(1),
  q2: z.string().min(1),
  q3: z.string().min(1),
  dayToDayResponsibilities: z.string().optional(),
  majorIncidentsNearMissesCoverUps: z.string().optional(),
  kpiSelfAssessment: z.string().optional(),
  profilePhotoDataUrl: z.string().max(2_500_000).optional(),
  intent: z.enum(['submit', 'save_later']).optional(),
  consentReadOnShow: z.union([z.literal('on'), z.literal('true')]).optional()
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      const intent = rawBody?.intent === 'save_later' ? 'save_later' : 'submit';
      return badRequest(
        `Before ${intent === 'save_later' ? 'saving' : 'submitting'}, please complete: Full name, Email address, Question 1, Question 2, and Question 3. You can complete Day-to-day responsibilities, Major incidents, and KPI self-assessment later in My Job.`
      );
    }

    const input = parsed.data;
    const email = normalizeEmail(input.email);
    const intent = input.intent === 'save_later' ? 'save_later' : 'submit';
    const dayToDayResponsibilities = `${input.dayToDayResponsibilities || ''}`.trim();
    const majorIncidentsNearMissesCoverUps = `${input.majorIncidentsNearMissesCoverUps || ''}`.trim();
    const kpiSelfAssessment = `${input.kpiSelfAssessment || ''}`.trim();
    const profilePhotoDataUrl = `${input.profilePhotoDataUrl || ''}`.trim();
    const hasPhoto = /^data:image\/(png|jpe?g|webp);base64,/i.test(profilePhotoDataUrl);
    if (profilePhotoDataUrl && !hasPhoto) {
      return badRequest('Profile photo must be PNG, JPG, or WEBP.');
    }

    if (
      intent === 'submit' &&
      (!dayToDayResponsibilities || !majorIncidentsNearMissesCoverUps || !kpiSelfAssessment)
    ) {
      return badRequest(
        'Please complete day-to-day responsibilities, major incidents, and KPI self-assessment before submitting.'
      );
    }

    const ip = getClientIp(req.headers);

    const rate = await enforceRateLimit({
      action: 'application_submission',
      ip,
      email,
      max: 10,
      windowDays: 1
    });
    if (!rate.ok) {
      return badRequest('Too many applications from this connection today. Try again tomorrow.', 429);
    }

    const supabase = createSupabaseAdminClient();
    const normalizedAssignmentRef = `${input.assignmentRef || ''}`.trim();
    const firstName = input.fullName.trim().split(/\s+/)[0] || input.fullName.trim();
    let assignmentRef = '';

    type ExistingAssignment = {
      id: string;
      assignment_ref: string;
      job_id: string;
      email: string;
    };
    let existingAssignment: ExistingAssignment | null = null;

    if (normalizedAssignmentRef) {
      const byRef = await supabase
        .from('assignments')
        .select('id, assignment_ref, job_id, email')
        .eq('assignment_ref', normalizedAssignmentRef)
        .eq('active', true)
        .maybeSingle();
      if (byRef.error) {
        return badRequest(byRef.error.message || 'Could not verify existing application.');
      }
      if (byRef.data && byRef.data.job_id === input.jobId) {
        existingAssignment = byRef.data;
      }
    }

    if (!existingAssignment) {
      const byJob = await supabase
        .from('assignments')
        .select('id, assignment_ref, job_id, email')
        .eq('job_id', input.jobId)
        .eq('active', true)
        .maybeSingle();
      if (byJob.error) {
        return badRequest(byJob.error.message || 'Could not verify existing application.');
      }
      if (byJob.data) {
        if ((byJob.data.email || '').toLowerCase() === email) {
          existingAssignment = byJob.data;
        } else {
          return badRequest('This role has already been claimed.');
        }
      }
    }

    if (existingAssignment) {
      const assignmentPatch: Record<string, unknown> = {
        full_name: input.fullName,
        first_name: firstName,
        email,
        q1: input.q1,
        q2: input.q2,
        q3: input.q3,
        day_to_day: dayToDayResponsibilities,
        incidents: majorIncidentsNearMissesCoverUps,
        kpi_assessment: kpiSelfAssessment,
        consent_read_on_show: Boolean(input.consentReadOnShow)
      };
      if (hasPhoto) {
        assignmentPatch.profile_photo_data_url = profilePhotoDataUrl;
      }
      const updatedAssignment = await supabase
        .from('assignments')
        .update(assignmentPatch)
        .eq('id', existingAssignment.id);
      if (updatedAssignment.error) {
        return badRequest(updatedAssignment.error.message || 'Could not update saved application.');
      }

      const archivePatch: Record<string, unknown> = {
        full_name: input.fullName,
        email,
        q1: input.q1,
        q2: input.q2,
        q3: input.q3,
        day_to_day: dayToDayResponsibilities,
        incidents: majorIncidentsNearMissesCoverUps,
        kpi_assessment: kpiSelfAssessment,
        consent_read_on_show: Boolean(input.consentReadOnShow),
        last_updated_at: new Date().toISOString()
      };
      if (hasPhoto) {
        archivePatch.profile_photo_data_url = profilePhotoDataUrl;
      }
      const updatedArchive = await supabase
        .from('applications_archive')
        .update(archivePatch)
        .eq('assignment_ref', existingAssignment.assignment_ref);
      if (updatedArchive.error) {
        return badRequest(updatedArchive.error.message || 'Could not update application history.');
      }

      assignmentRef = existingAssignment.assignment_ref;
    } else {
      const claim = await supabase.rpc('claim_job_atomic', {
        p_job_id: input.jobId,
        p_full_name: input.fullName,
        p_email: email,
        p_q1: input.q1,
        p_q2: input.q2,
        p_q3: input.q3,
        p_day_to_day: dayToDayResponsibilities,
        p_incidents: majorIncidentsNearMissesCoverUps,
        p_kpi_assessment: kpiSelfAssessment,
        p_consent: Boolean(input.consentReadOnShow)
      });

      if (claim.error || !claim.data?.[0]) {
        return badRequest(claim.error?.message || 'Could not claim this job. It may have just been filled.');
      }

      const claimed = claim.data[0];
      assignmentRef = claimed.assignment_ref;

      if (hasPhoto) {
        await supabase
          .from('assignments')
          .update({ profile_photo_data_url: profilePhotoDataUrl })
          .eq('assignment_ref', assignmentRef);
        await supabase
          .from('applications_archive')
          .update({
            profile_photo_data_url: profilePhotoDataUrl,
            last_updated_at: new Date().toISOString()
          })
          .eq('assignment_ref', assignmentRef);
      }
    }

    const jobLookup = await supabase
      .from('jobs')
      .select('id,title,job_ref,description,reports_to,salary_benefits')
      .eq('id', input.jobId)
      .maybeSingle();
    const jobTitle = jobLookup.data?.title || 'Your role';
    const jobReference = jobLookup.data?.job_ref || assignmentRef;
    const jobShortDescription = jobLookup.data?.description || '';
    const reportsTo = jobLookup.data?.reports_to || '';
    const salaryText = jobLookup.data?.salary_benefits || '';
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const manageLink = `${appBaseUrl}/my-job`;
    const directEditLink =
      `${appBaseUrl}/my-job/file?email=${encodeURIComponent(email)}&ref=${encodeURIComponent(assignmentRef)}`;

    const emailEnabled = isEmailEnabled();
    if (intent === 'submit' && emailEnabled) {
      try {
        await sendApplicationConfirmationEmail({
          to: email,
          emailAddress: email,
          fullName: input.fullName,
          jobTitle,
          jobReference,
          assignmentRef,
          jobShortDescription,
          reportsTo,
          salaryText,
          applicationDayToDay: dayToDayResponsibilities,
          applicationIncidents: majorIncidentsNearMissesCoverUps,
          applicationKpiAssessment: kpiSelfAssessment,
          consentReadOnShow: Boolean(input.consentReadOnShow),
          editApplicationUrl: directEditLink,
          myJobUrl: manageLink
        });
      } catch {
        return ok(
          {
            message:
              'Application submitted, but confirmation email could not be sent. Use /my-job/recover to retrieve your reference.'
          },
          201
        );
      }
    }

    return ok(
      {
        assignmentRef,
        message:
          intent === 'save_later'
            ? 'Application saved. Use My Job with your email and job number to continue later.'
            : emailEnabled
              ? 'Application submitted. Check your email for your reference and manage link.'
              : `Application submitted (email disabled). Reference: ${assignmentRef}`
      },
      201
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Application failed.';
    return badRequest(message, 500);
  }
}
