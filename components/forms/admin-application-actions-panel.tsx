'use client';

import { useState } from 'react';
import { AdminApplicationActions } from '@/components/forms/admin-application-actions';
import { AdminApplicationRoleEditor } from '@/components/forms/admin-application-role-editor';

type Props = {
  applicationId: string;
  broadcastedOnShow: boolean;
  job: {
    id: string;
    title: string;
    description: string;
    reports_to: string;
    status: 'AVAILABLE' | 'FILLED' | 'REHIRING';
    salary_benefits: string | null;
    job_ref: string;
  } | null;
  reportsToOptions: string[];
  salaryBenefitOptions: string[];
};

export function AdminApplicationActionsPanel({
  applicationId,
  broadcastedOnShow,
  job,
  reportsToOptions,
  salaryBenefitOptions
}: Props) {
  const [showRoleEditor, setShowRoleEditor] = useState(false);

  return (
    <div className="space-y-3">
      <AdminApplicationActions
        id={applicationId}
        broadcastedOnShow={broadcastedOnShow}
        onEditRole={job ? () => setShowRoleEditor((v) => !v) : undefined}
        editRoleLabel={showRoleEditor ? 'Close role editor' : 'Edit role'}
      />
      {showRoleEditor && job ? (
        <AdminApplicationRoleEditor
          job={job}
          reportsToOptions={reportsToOptions}
          salaryBenefitOptions={salaryBenefitOptions}
          onSaved={() => setShowRoleEditor(false)}
        />
      ) : null}
    </div>
  );
}
