alter table freaky_suggestions
  drop constraint if exists freaky_suggestions_status_check;

alter table freaky_suggestions
  add constraint freaky_suggestions_status_check
  check (
    status in (
      'pending_verification',
      'published',
      'covered',
      'hidden',
      'spam',
      'removed',
      'duplicate',
      'expired_unverified'
    )
  );
