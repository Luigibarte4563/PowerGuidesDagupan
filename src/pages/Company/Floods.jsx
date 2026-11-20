import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZoomControl } from 'react-leaflet';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  UserCheck,
  Waves,
} from 'lucide-react';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import ViewableImage from '@/components/ViewableImage';
import AppMap, {
  FitPoints,
  MapLegend,
  MapPoints,
  SEVERITY_COLORS,
} from '@/components/Map';
import MapWorkspace, { FeedActions, FeedPills, FeedToggle } from '@/components/MapWorkspace';
import StatusChangeDialog from '@/components/StatusChangeDialog';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { floodsApi, FLOOD_STATUSES } from '@/api';
import { COMPANY_PAGE_SIZE, COMPANY_QUERY_KEYS, severityTone, statusTone } from '@/utils/constants';
import { readFlood } from '@/utils/records';
import { formatDateTime, formatRelativeTime, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import AssignLinemanDialog from '@/components/AssignLinemanDialog';

/** The flood_reports enums, from backend/database/powerguide.sql. */
const FLOOD_SEVERITIES = ['low', 'moderate', 'high', 'critical'];

/** Next status when a manager assigns a lineman to a flood report. */
const ASSIGN_STATUS_ACTIONS = {
  reported: 'verified',
  verified: 'cleared',
  cleared: 'reported',
};

const TABS = [
  { value: 'all', label: 'All floods', icon: Waves },
  { value: 'reported', label: 'Reported', icon: MapPin },
  { value: 'verified', label: 'Verified', icon: ShieldCheck },
  { value: 'cleared', label: 'Cleared', icon: CheckCircle2 },
];

/**
 * Module FLD - company flood review.
 * Staff may change any flood report's status via role-gated `update_status.php`;
 * the same list endpoint already filters on status, severity and barangay.
 */
export default function Floods() {
  const { isManager } = useAuth();
  const { barangays } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [severity, setSeverity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusTarget, setStatusTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null); // { report, status }
  const debouncedSearch = useDebouncedValue(search);

  const listQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.floods({ tab, severity, barangay }),
    queryFn: async ({ signal }) =>
      (
        await floodsApi.list(
          {
            status: tab === 'all' ? undefined : tab,
            severity: severity || undefined,
            barangay: barangay || undefined,
          },
          { signal }
        )
      ).items.map(readFlood),
    retry: 1,
  });

  const rows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return (listQuery.data || []).filter((flood) => {
      if (tab === 'all' && String(flood.status).toLowerCase() === 'cleared') return false;
      if (!term) return true;
      return [flood.locationName, flood.barangay, flood.description, flood.severity]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [listQuery.data, tab, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  const statusMutation = useMutation({
    mutationFn: ({ floodId, status, updatedBy }) =>
      floodsApi.updateStatus({ flood_id: floodId, status, updated_by: updatedBy }),
    onSuccess: (_result, variables) => {
      toast.success(`Flood moved to ${humanize(variables.status)}.`, { title: 'Status updated' });
      setStatusTarget(null);
      setAssignTarget(null);
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.floods({}) });
      // The map layer and the risk query read the same table.
      queryClient.invalidateQueries({ queryKey: ['company-outages'] });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The flood status could not be changed.'), {
        title: 'Update failed',
      });
    },
  });

  const resetPage = () => setPage(1);

  const mapped = useMemo(
    () => rows.filter((flood) => Number.isFinite(flood.lat) && Number.isFinite(flood.lng)),
    [rows]
  );

  const floodMap =
    mapped.length === 0 ? (
      <AppMap zoom={12} zoomControl={false} className="h-full w-full">
        <ZoomControl position="bottomright" />
        <FitPoints items={[]} />
      </AppMap>
    ) : (
      <AppMap zoom={12} zoomControl={false} className="h-full w-full">
        <ZoomControl position="bottomright" />
        <FitPoints items={mapped} />
        <MapPoints
          items={mapped}
          toneFor={(flood) =>
            ['critical', 'high'].includes(String(flood.severity).toLowerCase())
              ? 'danger'
              : String(flood.severity).toLowerCase() === 'moderate'
                ? 'warning'
                : 'success'
          }
        >
          {(flood) => (
            <div className="min-w-[13rem]">
              <p className="font-bold text-navy-900">
                {flood.locationName || flood.barangay || 'Flood report'}
              </p>
              <p className="mt-0.5 text-xs text-navy-500">
                {[humanize(flood.severity, 'Flood'), flood.barangay].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {flood.severity ? (
                  <Badge tone={severityTone(flood.severity)} size="sm">
                    {humanize(flood.severity)}
                  </Badge>
                ) : null}
                {flood.status ? (
                  <Badge tone={statusTone(flood.status)} size="sm">
                    {humanize(flood.status)}
                  </Badge>
                ) : null}
              </div>
            </div>
          )}
        </MapPoints>
        <MapLegend
          title="Severity"
          items={[
            { label: 'Low', color: SEVERITY_COLORS.low },
            { label: 'Moderate', color: SEVERITY_COLORS.moderate },
            { label: 'High / critical', color: SEVERITY_COLORS.critical },
          ]}
        />
      </AppMap>
    );

  // Feed stat tiles, counted over the rows currently in view.
  const highCount = rows.filter((flood) =>
    ['critical', 'high'].includes(String(flood.severity).toLowerCase())
  ).length;
  const clearedCount = rows.filter(
    (flood) => String(flood.status).toLowerCase() === 'cleared'
  ).length;

  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#153243] px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <FeedActions
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        onClearSearch={() => {
          setSearch('');
          resetPage();
        }}
        searchId="company-flood-search"
        searchLabel="Search floods"
        searchPlaceholder="Search location, barangay, description…"
      />

      <MapWorkspace
        map={floodMap}
        mapLabel="Flood map"
        mapTitle="Flood Review Feed"
        mapSubtitle={`${mapped.length} of ${rows.length} plotted${
          listQuery.dataUpdatedAt ? ` · updated ${formatTime(listQuery.dataUpdatedAt)}` : ''
        }`}
        toggle={
          <FeedToggle
            ariaLabel="Filter by status"
            value={tab}
            onChange={(value) => {
              setTab(value);
              resetPage();
            }}
            options={TABS}
          />
        }
        stats={[
          { label: 'In view', value: rows.length, icon: Waves, color: '#22D3EE' },
          { label: 'High / critical', value: highCount, icon: AlertTriangle, color: '#FF2E1F' },
          { label: 'Cleared', value: clearedCount, icon: CheckCircle2, color: '#34FB34' },
        ]}
        pills={
          <FeedPills
            ariaLabel="Filter by severity"
            value={severity || 'all'}
            onChange={(value) => {
              setSeverity(value === 'all' ? '' : value);
              resetPage();
            }}
            options={[{ value: 'all', label: 'All' }, ...FLOOD_SEVERITIES.map((value) => ({ value, label: humanize(value) }))]}
          />
        }
        filters={
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Select
              aria-label="Filter by barangay"
              placeholder="All barangays"
              options={barangays}
              value={barangay}
              onChange={(event) => {
                setBarangay(event.target.value);
                resetPage();
              }}
              className="h-9 py-0 text-xs"
            />
          </div>
        }
        plottedCount={mapped.length}
        mapEmpty={!listQuery.isLoading && !listQuery.isError && mapped.length === 0}
        mapEmptyLabel="No mapped flood reports yet"
      >
        <div className="space-y-3">
          <DataView
            dense
            isLoading={listQuery.isLoading}
            error={listQuery.isError}
            onRetry={() => listQuery.refetch()}
            loadingLabel="Loading flood reports…"
            items={pageRows}
            empty={{
              icon: Waves,
              title: 'No floods here',
              description:
                'Nothing matching these filters. Flood reports from residents appear in this list.',
            }}
            renderCard={(flood) => {
              const nextStatus = ASSIGN_STATUS_ACTIONS[String(flood.status ?? '').toLowerCase()];
              return (
                <RecordCard
                  variant="feed"
                  icon={Waves}
                  iconTone={severityTone(flood.severity)}
                  title={flood.locationName || flood.barangay || 'Flood report'}
                  subtitle={[
                    humanize(flood.severity, 'Flood'),
                    flood.barangay,
                    `reported ${formatRelativeTime(flood.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  badges={[
                    flood.severity
                      ? { label: humanize(flood.severity), tone: severityTone(flood.severity) }
                      : null,
                    flood.status ? { label: humanize(flood.status), tone: statusTone(flood.status) } : null,
                  ].filter(Boolean)}
                  description={flood.description}
                  meta={[
                    Number.isFinite(flood.depthCm)
                      ? { label: 'Depth', value: `${flood.depthCm} cm` }
                      : null,
                    { label: 'Reported', value: formatDateTime(flood.createdAt), icon: MapPin },
                  ].filter(Boolean)}
                  actions={
                    <>
                      {isManager && nextStatus ? (
                        <Button
                          size="xs"
                          variant="outline"
                          icon={UserCheck}
                          onClick={() => setAssignTarget({ report: flood, status: nextStatus })}
                          aria-label={`Assign a lineman in ${flood.barangay || 'this barangay'}`}
                        >
                          Assign
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        variant="outline"
                        icon={ArrowUpDown}
                        onClick={() => setStatusTarget(flood)}
                      >
                        Change status
                      </Button>
                    </>
                  }
                >
                  {flood.image ? <ViewableImage src={flood.image} alt="Flood evidence" /> : null}
                </RecordCard>
              );
            }}
          />

          <Pagination
            page={page}
            pageCount={pageCount}
            total={rows.length}
            pageSize={COMPANY_PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      </MapWorkspace>

      <StatusChangeDialog
        open={Boolean(statusTarget)}
        reportLabel={statusTarget?.locationName || statusTarget?.barangay}
        currentStatus={statusTarget?.status}
        statuses={FLOOD_STATUSES}
        hint="Flood statuses are the database enum: reported, verified, cleared."
        onClose={() => setStatusTarget(null)}
        onSubmit={(nextStatus) =>
          statusMutation.mutateAsync({ floodId: statusTarget.id, status: nextStatus })
        }
        loading={statusMutation.isPending}
      />

      <AssignLinemanDialog
        open={Boolean(assignTarget)}
        reportLabel={assignTarget?.report.locationName || assignTarget?.report.barangay || 'this flood'}
        nextStatus={assignTarget?.status}
        noun="flood"
        loading={statusMutation.isPending}
        onClose={() => setAssignTarget(null)}
        onSubmit={(linemanId) =>
          statusMutation.mutateAsync({
            floodId: assignTarget.report.id,
            status: assignTarget.status,
            updatedBy: linemanId,
          })
        }
      />

      <p className="text-xs text-navy-400">
        Statuses are the database enum: {FLOOD_STATUSES.map((value) => humanize(value)).join(', ')}.
      </p>
    </div>
  );
}
