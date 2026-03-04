'use client';

export function AdminExportLinks() {
  const download = (type: 'active-roles' | 'applications' | 'exit-interviews') => {
    window.location.href = `/api/admin/exports/${type}?t=${Date.now()}`;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary" onClick={() => download('active-roles')}>
        Export active roles CSV
      </button>
      <button type="button" className="btn-secondary" onClick={() => download('applications')}>
        Export archived applications CSV
      </button>
      <button type="button" className="btn-secondary" onClick={() => download('exit-interviews')}>
        Export exit interviews CSV
      </button>
    </div>
  );
}

