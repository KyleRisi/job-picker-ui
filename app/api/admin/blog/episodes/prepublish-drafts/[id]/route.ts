import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { isUuid } from '@/lib/blog/validation';
import {
  PREPUBLISH_DRAFT_STATUSES,
  getPrepublishDraftById,
  isPrepublishDraftPayload,
  updatePrepublishDraftFromEditorialPayload,
  updatePrepublishDraftWorkflow
} from '@/lib/episode-prepublish-drafts';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid draft id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const item = await getPrepublishDraftById(params.id);
    if (!item) return badRequest('Draft not found.', 404);
    return ok({ item });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load draft.'), 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid draft id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const payload = await req.json().catch(() => ({}));

    if (isPrepublishDraftPayload(payload)) {
      const item = await updatePrepublishDraftFromEditorialPayload({
        id: params.id,
        payload,
        actor: user.id || null
      });
      if (!item) return badRequest('Draft not found.', 404);
      return ok({ item });
    }

    const statusRaw = `${payload?.status || ''}`.trim();
    const status = PREPUBLISH_DRAFT_STATUSES.includes(statusRaw as any)
      ? (statusRaw as (typeof PREPUBLISH_DRAFT_STATUSES)[number])
      : undefined;

    if (statusRaw && !status) {
      return badRequest('Invalid draft status.');
    }

    const item = await updatePrepublishDraftWorkflow({
      id: params.id,
      actor: user.id || null,
      status,
      reviewReason: typeof payload?.reviewReason === 'string' || payload?.reviewReason === null ? payload.reviewReason : undefined,
      manualMatchNotes: typeof payload?.manualMatchNotes === 'string' ? payload.manualMatchNotes : undefined,
      sourceHint: typeof payload?.sourceHint === 'string' || payload?.sourceHint === null ? payload.sourceHint : undefined,
      expectedPublishDate: typeof payload?.expectedPublishDate === 'string' || payload?.expectedPublishDate === null
        ? payload.expectedPublishDate
        : undefined,
      episodeNumberHint: typeof payload?.episodeNumberHint === 'number' || payload?.episodeNumberHint === null
        ? payload.episodeNumberHint
        : undefined,
      seriesNameHint: typeof payload?.seriesNameHint === 'string' || payload?.seriesNameHint === null
        ? payload.seriesNameHint
        : undefined,
      partNumberHint: typeof payload?.partNumberHint === 'number' || payload?.partNumberHint === null
        ? payload.partNumberHint
        : undefined,
      allowTitleCollision: typeof payload?.allowTitleCollision === 'boolean' ? payload.allowTitleCollision : undefined,
      confirmAllowTitleCollision: payload?.confirmAllowTitleCollision === true,
      allowTitleCollisionNote: typeof payload?.allowTitleCollisionNote === 'string' ? payload.allowTitleCollisionNote : null,
      archive: payload?.archive === true,
      unarchive: payload?.unarchive === true
    });

    if (!item) return badRequest('Draft not found.', 404);
    return ok({ item });
  } catch (error) {
    const message = getErrorMessage(error, 'Failed to update draft.');
    const status = /requires explicit confirmation|collision|invalid draft status/i.test(message) ? 400 : 500;
    return badRequest(message, status);
  }
}
