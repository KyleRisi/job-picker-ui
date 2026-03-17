import { Resend } from 'resend';
import { env } from './env';

function client() {
  return new Resend(env.resendApiKey);
}

export function isEmailEnabled(): boolean {
  return Boolean(env.resendApiKey && env.fromEmail);
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!isEmailEnabled()) {
    console.warn('[email disabled] Skipping send:', { to, subject });
    return { id: 'email-disabled' };
  }
  const result = await client().emails.send({
    from: `Compendium Podcast HR <${env.fromEmail}>`,
    to,
    subject,
    html
  });
  const providerError = (result as { error?: { message?: string } } | null)?.error;
  if (providerError) {
    throw new Error(providerError.message || 'Email provider rejected the message.');
  }
  return result;
}

export async function sendApplicationConfirmationEmail(input: {
  fullName: string;
  to: string;
  emailAddress: string;
  jobTitle: string;
  jobReference: string;
  assignmentRef: string;
  jobShortDescription: string;
  reportsTo?: string;
  salaryText?: string;
  applicationDayToDay?: string;
  applicationIncidents?: string;
  applicationKpiAssessment?: string;
  consentReadOnShow: boolean;
  editApplicationUrl: string;
  myJobUrl?: string;
}) {
  const hasReportsTo = Boolean(`${input.reportsTo || ''}`.trim());
  const hasSalary = Boolean(`${input.salaryText || ''}`.trim());
  const hasDayToDay = Boolean(`${input.applicationDayToDay || ''}`.trim());
  const hasIncidents = Boolean(`${input.applicationIncidents || ''}`.trim());
  const hasKpi = Boolean(`${input.applicationKpiAssessment || ''}`.trim());

  const consentCopy = input.consentReadOnShow
    ? 'You consented to this being read on the show. If your filing survives Spotlight Committee review, we may read it out publicly.'
    : 'You did not consent to this being read on the show. This is respected. (A shame, but respected.)';
  const myJobLabel = input.myJobUrl
    ? `<a href="${escapeHtml(input.myJobUrl)}" style="color:#c91f16;text-decoration:underline;font-weight:700;">My Job</a>`
    : '<strong>My Job</strong>';
  const baseUrl = env.appBaseUrl.replace(/\/$/, '');
  const fallbackLogoUrl = `${baseUrl}/compendium-logo.png`;
  const configuredLogoUrl = `${process.env.EMAIL_LOGO_URL || ''}`.trim();
  const logoUrl = configuredLogoUrl || fallbackLogoUrl;
  const isLocalBaseUrl = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(baseUrl);
  const canRenderLogo = /^https?:\/\//i.test(logoUrl) && !isLocalBaseUrl;
  const logoMarkup = canRenderLogo
    ? `<img src="${escapeHtml(logoUrl)}" alt="The Compendium Podcast" width="120" style="display:block;width:120px;max-width:100%;height:auto;border:0;" />`
    : `<div style="display:inline-block;padding:8px 10px;border:1px solid #d7d7dd;border-radius:8px;background:#ffffff;font-size:11px;font-weight:800;letter-spacing:.06em;color:#1b1a3b;text-transform:uppercase;">Compendium Podcast</div>`;

  const html = `
    <div style="margin:0;padding:12px;background:#efefef;font-family:Poppins,Arial,sans-serif;color:#1b1a3b;">
      <style>
        @media only screen and (max-width: 600px) {
          .email-shell { padding: 8px !important; }
          .email-card { border-radius: 10px !important; }
          .email-header { padding: 16px 14px !important; }
          .email-body { padding-left: 14px !important; padding-right: 14px !important; }
          .email-eyebrow { font-size: 11px !important; }
          .email-title { font-size: 22px !important; line-height: 1.14 !important; }
          .email-h1 { font-size: 24px !important; line-height: 1.15 !important; }
          .email-role-title { font-size: 20px !important; line-height: 1.2 !important; }
          .email-section-title { font-size: 18px !important; line-height: 1.25 !important; }
          .email-copy { font-size: 15px !important; line-height: 1.5 !important; }
          .email-btn { font-size: 15px !important; padding: 11px 12px !important; }
        }
      </style>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-card" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d7d7dd;border-radius:14px;overflow:hidden;">
        <tr>
          <td class="email-header" style="padding:20px 24px;background:#f7f7fa;border-bottom:1px solid #e6e6ee;">
            <div style="margin:0 0 10px 0;">${logoMarkup}</div>
            <p class="email-eyebrow" style="margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c91f16;">Official Appointment Notice</p>
            <p class="email-title" style="margin:6px 0 4px 0;font-size:24px;line-height:1.15;font-weight:900;color:#1b1a3b;word-break:break-word;overflow-wrap:anywhere;">The Compendium Circus</p>
            <p class="email-copy" style="margin:0;font-size:14px;line-height:1.5;color:#50506a;font-weight:600;">Human Resources, Compliance &amp; Incident Liaison Division</p>
          </td>
        </tr>

        <tr>
          <td class="email-body" style="padding:22px 24px 4px 24px;">
            <p class="email-copy" style="margin:0 0 8px 0;font-size:18px;line-height:1.4;color:#1b1a3b;"><strong>${escapeHtml(input.fullName)}</strong>, 👋</p>
            <h1 class="email-h1" style="margin:0 0 10px 0;font-size:28px;line-height:1.12;font-weight:900;color:#1b1a3b;word-break:break-word;overflow-wrap:anywhere;">Congratulations, you&apos;ve been recruited.</h1>
            <p class="email-copy" style="margin:0;font-size:16px;line-height:1.6;color:#4d4d63;">
              Your application has been received, processed, stamped, and filed in accordance with Protocol 12-B and several unrelated policies.
            </p>
          </td>
        </tr>

        <tr>
          <td class="email-body" style="padding:16px 24px 6px 24px;">
            <div style="border:1px solid #e1e1ea;border-radius:12px;padding:16px;background:#fcfcff;">
              <p class="email-eyebrow" style="margin:0 0 8px 0;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7a7a92;">Appointment</p>
              <p class="email-copy" style="margin:0 0 8px 0;font-size:16px;line-height:1.5;color:#4d4d63;">You are our new</p>
              <p class="email-role-title" style="margin:0 0 12px 0;font-size:22px;line-height:1.25;font-weight:900;color:#1b1a3b;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(input.jobTitle)}</p>
              <p class="email-eyebrow" style="margin:0 0 4px 0;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7a7a92;">Role Summary</p>
              <p class="email-copy" style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#4d4d63;">${escapeHtml(input.jobShortDescription)}</p>
              <div style="border-top:1px solid #ececf2;padding-top:10px;">
                ${hasReportsTo ? `<p class="email-copy" style="margin:0 0 6px 0;font-size:15px;line-height:1.5;color:#4d4d63;"><strong style="color:#1b1a3b;">Reporting to:</strong> ${escapeHtml(input.reportsTo || '')}</p>` : ''}
                ${hasSalary ? `<p class="email-copy" style="margin:0 0 6px 0;font-size:15px;line-height:1.5;color:#4d4d63;"><strong style="color:#1b1a3b;">Salary:</strong> ${escapeHtml(input.salaryText || '')}</p>` : ''}
                <p class="email-copy" style="margin:0;font-size:15px;line-height:1.5;color:#4d4d63;"><strong style="color:#1b1a3b;">Status:</strong> ACTIVE</p>
              </div>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:10px 24px 6px 24px;">
            <div style="border:1px solid #f1d08d;border-radius:12px;padding:12px 14px;background:#fff8e8;">
              <p style="margin:0 0 6px 0;font-size:16px;line-height:1.4;font-weight:800;color:#1b1a3b;">Show note</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4d4d63;">${escapeHtml(consentCopy)}</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 24px 6px 24px;">
            <div style="border:1px solid #e1e1ea;border-radius:12px;padding:14px 16px;background:#ffffff;">
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7a7a92;">Filed Statements</p>
              <p style="margin:0 0 8px 0;font-size:20px;line-height:1.3;font-weight:900;color:#1b1a3b;">
                Your Submitted Job Description
              </p>
              <p style="margin:0 0 10px 0;font-size:15px;line-height:1.5;color:#4d4d63;">
                <strong style="color:#1b1a3b;">You said:</strong>
              </p>
              ${hasDayToDay ? `
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;font-weight:800;color:#1b1a3b;">Day-to-day responsibilities</p>
                <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#4d4d63;">${nl2br(input.applicationDayToDay || '')}</p>
              ` : ''}
              ${hasIncidents ? `
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;font-weight:800;color:#1b1a3b;">Major incidents / near misses / cover-ups</p>
                <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#4d4d63;">${nl2br(input.applicationIncidents || '')}</p>
              ` : ''}
              ${hasKpi ? `
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;font-weight:800;color:#1b1a3b;">KPI self-assessment</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#4d4d63;">${nl2br(input.applicationKpiAssessment || '')}</p>
              ` : ''}
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:8px 24px 6px 24px;">
            <div style="border:1px solid #e1e1ea;border-radius:12px;padding:14px 16px;background:#f7f7fa;">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7a7a92;">Edit my job description</p>
              <p style="margin:0 0 8px 0;font-size:16px;line-height:1.6;color:#4d4d63;">
                Use ${myJobLabel} and provide:
              </p>
              <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:#4d4d63;"><strong style="color:#1b1a3b;">Job reference:</strong> ${escapeHtml(input.jobReference)}</p>
              <p style="margin:0;font-size:15px;line-height:1.5;color:#4d4d63;"><strong style="color:#1b1a3b;">Email address:</strong> ${escapeHtml(input.emailAddress)}</p>
            </div>
          </td>
        </tr>

        <tr>
          <td class="email-body" style="padding:10px 24px 8px 24px;">
            <a href="${escapeHtml(input.editApplicationUrl)}" class="email-btn" style="display:block;width:100%;box-sizing:border-box;text-align:center;background:#c91f16;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;line-height:1.3;padding:12px 14px;border-radius:10px;">
              Edit your application
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:10px 24px 6px 24px;">
            <div style="border:1px solid #e1e1ea;border-radius:12px;padding:14px 16px;background:#f7f7fa;">
              <p style="margin:0 0 8px 0;font-size:18px;line-height:1.3;font-weight:800;color:#1b1a3b;">A quick note from Sue, HR</p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#4d4d63;">
                You are joining a fast-paced, paperwork-heavy institution where risk is not hypothetical but recurring.
                We maintain policies, procedures, and laminated signage in morally reassuring quantities.
              </p>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#4d4d63;">
                Operational reality may include:
              </p>
              <ul style="margin:0 0 8px 18px;padding:0;color:#4d4d63;font-size:15px;line-height:1.6;">
                <li>unexpected heights</li>
                <li>unexpected animals</li>
                <li>expected animals behaving unexpectedly</li>
                <li>momentum</li>
                <li>physics</li>
                <li>applause-related overconfidence</li>
                <li>Form 12-B (&quot;Statement of How This Happened&quot;)</li>
              </ul>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4d4d63;">
                We cannot guarantee safety, uninterrupted limb ownership, or emotional composure.
                We can guarantee a memorable workplace culture.
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 24px 24px 24px;">
            <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#4d4d63;">
              Welcome to the family,<br/>
              <strong style="color:#1b1a3b;">Sue</strong><br/>
              <span style="font-weight:700;color:#1b1a3b;">HR Compliance &amp; Incident Liaison Coordinator</span><br/>
              The Circus (the Organisation / the Big Top / &quot;that place where the incident happened&quot;)
            </p>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#77778e;">
              This email is considered binding in at least three administrative dimensions.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  return sendEmail(
    input.to,
    `Welcome to the Compendium. You've been recruited (${input.jobReference})`,
    html
  );
}

export async function sendReferenceRecoveryEmail(input: {
  to: string;
  jobTitle: string;
  assignmentRef: string;
  manageLink: string;
}) {
  const html = `
    <h1>Your reference number</h1>
    <p>Role: <strong>${escapeHtml(input.jobTitle)}</strong></p>
    <p>Reference: <strong>${escapeHtml(input.assignmentRef)}</strong></p>
    <p><a href="${input.manageLink}">Manage your role</a></p>
  `;

  return sendEmail(input.to, 'The Compendium Podcast reference recovery', html);
}

export async function sendEmailChangeConfirmation(input: {
  to: string;
  fullName: string;
  confirmLink: string;
}) {
  const html = `
    <h1>Confirm your email change</h1>
    <p>Hi ${escapeHtml(input.fullName)}, confirm your new email below.</p>
    <p><a href="${input.confirmLink}">Confirm email change</a></p>
  `;

  return sendEmail(input.to, 'Confirm your email change for The Compendium Podcast', html);
}

export async function sendNewReviewNotificationEmail(input: {
  reviewerName: string;
  reviewerEmail: string;
  title: string;
  body: string;
  rating: number;
  country: string;
  source: 'website' | 'apple' | 'manual' | 'scraped';
}) {
  if (!env.adminEmail) {
    console.warn('[review email] ADMIN_EMAIL is not configured. Skipping new review notification.');
    return { id: 'admin-email-missing' };
  }

  const html = `
    <h1>New Review Submitted</h1>
    <p>A new review was submitted on the website and is pending admin approval.</p>
    <hr />
    <p><strong>Name:</strong> ${escapeHtml(input.reviewerName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.reviewerEmail)}</p>
    <p><strong>Rating:</strong> ${input.rating}★</p>
    <p><strong>Country:</strong> ${escapeHtml(input.country || 'N/A')}</p>
    <p><strong>Source:</strong> ${escapeHtml(input.source)}</p>
    <p><strong>Title:</strong> ${escapeHtml(input.title)}</p>
    <p><strong>Body:</strong><br/>${nl2br(input.body)}</p>
  `;

  return sendEmail(env.adminEmail, 'New website review submitted', html);
}

export async function sendContactSubmissionNotificationEmail(input: {
  id: string;
  name: string;
  email: string;
  reason: 'general' | 'guest' | 'press' | 'sponsorship' | 'other';
  subject: string;
  message: string;
  ip: string;
  userAgent: string;
}) {
  if (!env.adminEmail) {
    throw new Error('ADMIN_EMAIL is not configured for contact form notifications.');
  }

  const html = `
    <h1>New Contact Submission</h1>
    <p>A new contact message was sent from the Connect page.</p>
    <hr />
    <p><strong>Submission ID:</strong> ${escapeHtml(input.id)}</p>
    <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>
    <p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
    <p><strong>Message:</strong><br/>${nl2br(input.message)}</p>
    <hr />
    <p><strong>IP:</strong> ${escapeHtml(input.ip)}</p>
    <p><strong>User Agent:</strong> ${escapeHtml(input.userAgent || 'N/A')}</p>
  `;

  return sendEmail(env.adminEmail, `New contact form message: ${input.subject}`, html);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}
