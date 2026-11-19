import { useEffect, useMemo, useState } from 'react';
import { History, UserCog, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import DataView from '@/components/DataView';
import Pagination from '@/components/Pagination';
import { useAdminActivity, useAdminUsers } from '@/hooks/useAdmin';
import { ADMIN_PAGE_SIZE } from '@/utils/constants';
import { formatDateTime } from '@/utils/formatters';

const TABS = [
  { value: 'electric_company', label: 'Electric Company', icon: Users },
  { value: 'lineman', label: 'Lineman', icon: UserCog },
];

const MODULE_OPTIONS = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'outage', label: 'Outage' },
  { value: 'flood', label: 'Flood' },
  { value: 'hazard', label: 'Hazard' },
  { value: 'assignment', label: 'Assignment' },
];

const ACTION_OPTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'status_changed', label: 'Status changed' },
  { value: 'verified', label: 'Verified' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
];

const MODULE_META = {
  maintenance: { label: 'Maintenance', tone: 'warning' },
  outage: { label: 'Outage', tone: 'primary' },
  flood: { label: 'Flood', tone: 'info' },
  hazard: { label: 'Hazard', tone: 'danger' },
  assignment: { label: 'Assignment', tone: 'navy' },
};

const ACTION_META = {
  created: { label: 'Created', tone: 'success' },
  updated: { label: 'Updated', tone: 'info' },
  status_changed: { label: 'Status changed', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  assigned: { label: 'Assigned', tone: 'primary' },
  unassigned: { label: 'Unassigned', tone: 'neutral' },
};

/** Admin review of what staff roles created and changed, newest first. */
export default function Activity() {
  const [tab, setTab] = useState('electric_company');
  const [userId, setUserId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setUserId('');
    setTargetType('');
    setAction('');
    setPage(1);
  }, [tab]);

  useEffect(() => {
    setPage(1);
  }, [userId, targetType, action]);

  const usersQuery = useAdminUsers({ role: tab });
  const activityQuery = useAdminActivity({
    role: tab,
    userId: userId || undefined,
    targetType: targetType || undefined,
    action: action || undefined,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  });

  const userOptions = useMemo(
    () =>
      (usersQuery.data || []).map((row) => ({
        value: row.id,
        label: row.name || row.email,
      })),
    [usersQuery.data]
  );

  const activities = activityQuery.data?.activities || [];
  const total = activityQuery.data?.summary?.total_activities ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity History"
        description="Who created and changed maintenance, outages, floods and hazards by staff account."
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} ariaLabel="Staff activity by role" />

      <Card>
        <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Account"
            aria-label="Filter activity by account"
            placeholder={`All ${tab === 'lineman' ? 'linemen' : 'company accounts'}`}
            options={userOptions}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            loading={usersQuery.isLoading}
          />
          <Select
            label="Module"
            aria-label="Filter activity by module"
            placeholder="All modules"
            options={MODULE_OPTIONS}
            value={targetType}
            onChange={(event) => setTargetType(event.target.value)}
          />
          <Select
            label="Action"
            aria-label="Filter activity by action"
            placeholder="All actions"
            options={ACTION_OPTIONS}
            value={action}
            onChange={(event) => setAction(event.target.value)}
          />
          <div className="flex items-end">
            <p className="text-sm text-navy-500 dark:text-navy-400">{total} recorded actions</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Timeline" description="Newest activity first." />
        <CardBody>
          <DataView
            isLoading={activityQuery.isLoading}
            error={activityQuery.error}
            items={activities}
            onRetry={activityQuery.refetch}
            loadingLabel="Loading activity…"
            empty={{
              icon: History,
              title: 'No activity yet',
              description: 'Matching actions by this role will appear here once they are recorded.',
            }}
            renderCard={(item) => {
              const moduleMeta = MODULE_META[item.targetType] || { label: item.targetType, tone: 'neutral' };
              const actionMeta = ACTION_META[item.actionType] || { label: item.actionType, tone: 'neutral' };
              return (
                <div className="rounded-control border border-navy-100 bg-white p-4 shadow-card dark:border-navy-700 dark:bg-navy-800 dark:shadow-card-dark">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-navy-900 dark:text-white">{item.action}</p>
                        <Badge size="sm" tone={moduleMeta.tone}>
                          {moduleMeta.label}
                        </Badge>
                        <Badge size="sm" tone={actionMeta.tone}>
                          {actionMeta.label}
                        </Badge>
                        {item.status ? <Badge size="sm">{item.status}</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-navy-600 dark:text-navy-300">{item.actorName || 'Unknown account'}</p>
                    </div>
                    <time className="shrink-0 text-xs text-navy-400" dateTime={item.performedAt}>
                      {formatDateTime(item.performedAt)}
                    </time>
                  </div>
                  {item.target ? (
                    <p className="mt-2 text-sm font-medium text-navy-800 dark:text-navy-100">{item.target}</p>
                  ) : null}
                  {item.detail ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-navy-500 dark:text-navy-400">{item.detail}</p>
                  ) : null}
                </div>
              );
            }}
          />
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={ADMIN_PAGE_SIZE}
            onChange={setPage}
          />
        </CardBody>
      </Card>
    </div>
  );
}
