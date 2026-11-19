import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZoomControl } from 'react-leaflet';
import { AlertTriangle, ArrowUpDown, CheckCircle2, MapPin, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { InfoNote } from '@/components/ui/Alert';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import ViewableImage from '@/components/ViewableImage';
import AppMap, {
  FitPoints,
  MapLegend,
  MapPoints,
  MapView,
  SEVERITY_COLORS,
} from '@/components/Map';
import MapWorkspace, { FeedActions, FeedPills, FeedToggle } from '@/components/MapWorkspace';
import Modal from '@/components/ui/Modal';
import StatusChangeDialog from '@/components/StatusChangeDialog';
import { useReference } from '@/context/ReferenceContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLinemenList } from '@/hooks/useLinemanAssignments';
import { hazardsApi, HAZARD_STATUSES } from '@/api';
import {
  COMPANY_PAGE_SIZE,
  COMPANY_QUERY_KEYS,
  severityTone,
  statusTone,
} from '@/utils/constants';
import { readHazard } from '@/utils/records';
import { formatDateTime, formatRelativeTime, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';

const TABS = [
  { value: 'all', label: 'All hazards', icon: AlertTriangle },
  { value: 'reported', label: 'Reported', icon: MapPin },
  { value: 'verified', label: 'Verified', icon: ShieldCheck },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2 },
];

const STATUS_ACTIONS = {
  reported: { label: 'Mark verified', value: 'verified', icon: ShieldCheck, tone: 'primary' },
  verified: { label: 'Mark resolved', value: 'resolved', icon: CheckCircle2, tone: 'success' },
  resolved: { label: 'Reopen', value: 'reported', icon: XCircle, tone: 'outline' },
};

/**
 * Module HAZ - electrical hazard review (FR-HAZ-1, FR-HAZ-2).
 *
 * `electrical_hazard/get.php` has no role check, but `update_status.php` lets a staff
 * role change ANY hazard (not just the reporter's), so both actions are offered to
 * every dashboard user here.
 *
 * The status enum is a hard schema constraint (`reported | verified | resolved`), not
 * reference data, so the picker is built from `HAZARD_STATUSES`; severity and barangay
 * filters come from `reference/get.php` as usual (FR-REF-2).
 *
 * Reopening a resolved hazard is supported by the endpoint (it only stamps
 * `resolved_at` when moving TO resolved, and never clears it), so the server keeps a
 * stale resolution timestamp on a reopened record - surfaced in the confirm copy
 * rather than hidden.
 */
export default function Hazards() {
  const { barangays, severityLevels } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [severity, setSeverity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const { isManager } = useAuth();
  // Only managers may pick which lineman carries out a status change.
  const linemenQuery = useLinemenList({ enabled: isManager });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignHazard, setAssignHazard] = useState(null);
  const [assignStatus, setAssignStatus] = useState('');
  const [assignLinemanId, setAssignLinemanId] = useState('');
  const [statusTarget, setStatusTarget] = useState(null);

  const closeAssign = () => {
    setAssignOpen(false);
    setAssignHazard(null);
    setAssignStatus('');
    setAssignLinemanId('');
  };

  const linemanOptions = useMemo(
    () =>
      (linemenQuery.data || []).map((person) => ({
        value: String(person.id),
        label: person.email ? `${person.name} · ${person.email}` : person.name,
      })),
    [linemenQuery.data]
  );

  const resolveLinemanName = (linemanId) =>
    (linemenQuery.data || []).find((person) => person.id === linemanId)?.name;

  const listQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.hazards({ tab, severity, barangay }),
    queryFn: async ({ signal }) =>
      (await hazardsApi.list(
        {
          status: tab === 'all' ? undefined : tab,
          severity: severity || undefined,
          barangay: barangay || undefined,
        },
        { signal }
      )).items.map(readHazard),
    retry: 1,
  });

  const rows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return (listQuery.data || []).filter((hazard) => {
      if (tab === 'all' && String(hazard.status).toLowerCase() === 'resolved') return false;
      if (!term) return true;
      return [hazard.locationName, hazard.barangay, hazard.description, hazard.hazardType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [listQuery.data, tab, debouncedSearch]);

  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  const statusMutation = useMutation({
    mutationFn: ({ hazardId, status }) => hazardsApi.updateStatus({ hazard_id: hazardId, status }),
    onSuccess: (_result, variables) => {
      toast.success(`Hazard moved to ${humanize(variables.status)}.`, { title: 'Status updated' });
      setStatusTarget(null);
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.hazards({}) });
      // The map layer and the risk query read the same table.
      queryClient.invalidateQueries({ queryKey: ['company-outages'] });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The hazard status could not be changed.'), {
        title: 'Update failed',
      });
    },
  });

  const mapped = useMemo(
    () => rows.filter((hazard) => Number.isFinite(hazard.lat) && Number.isFinite(hazard.lng)),
    [rows]
  );


  const hazardMap =
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
          toneFor={(hazard) =>
            ['critical', 'high'].includes(String(hazard.severity).toLowerCase())
              ? 'danger'
              : String(hazard.severity).toLowerCase() === 'moderate'
                ? 'warning'
                : 'success'
          }
        >
          {(hazard) => (
            <div className="min-w-[13rem]">
              <p className="font-bold text-navy-900">
                {hazard.locationName || hazard.barangay || 'Electrical hazard'}
              </p>
              <p className="mt-0.5 text-xs text-navy-500">
                {[humanize(hazard.hazardType, 'Hazard'), hazard.barangay].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {hazard.severity ? (
                  <Badge tone={severityTone(hazard.severity)} size="sm">
                    {humanize(hazard.severity)}
                  </Badge>
                ) : null}
                {hazard.status ? (
                  <Badge tone={statusTone(hazard.status)} size="sm">
                    {humanize(hazard.status)}
                  </Badge>
                ) : null}
              </div>
            </div>
          )}
        </MapPoints>
        <MapLegend
          title="Severity"
          items={[
            { label: 'Critical / high', color: SEVERITY_COLORS.critical },
            { label: 'Moderate', color: SEVERITY_COLORS.moderate },
            { label: 'Low', color: SEVERITY_COLORS.low },
          ]}
        />
      </AppMap>
    );

  const resetPage = () => setPage(1);

  // Feed stat tiles, counted over the rows currently in view.
  const criticalCount = rows.filter((hazard) =>
    ['critical', 'high'].includes(String(hazard.severity).toLowerCase())
  ).length;
  const resolvedCount = rows.filter(
    (hazard) => String(hazard.status).toLowerCase() === 'resolved'
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
        searchId="company-hazard-search"
        searchLabel="Search hazards"
        searchPlaceholder="Search location, type, description…"
      />

      <MapWorkspace
        map={hazardMap}
        mapLabel="Hazard map"
        mapTitle="Hazard Review Feed"
        mapSubtitle={`${mapped.length} of ${rows.length} plotted${
          listQuery.dataUpdatedAt ? ` · updated ${formatTime(listQuery.dataUpdatedAt)}` : ''
        }`}
        toggle={
          <FeedToggle
            ariaLabel="Hazard status"
            value={tab}
            onChange={(value) => {
              setTab(value);
              resetPage();
            }}
            options={TABS}
          />
        }
        stats={[
          { label: 'In view', value: rows.length, icon: AlertTriangle, color: '#22D3EE' },
          { label: 'High / critical', value: criticalCount, icon: AlertTriangle, color: '#FF2E1F' },
          { label: 'Resolved', value: resolvedCount, icon: CheckCircle2, color: '#34FB34' },
        ]}
        pills={
          <FeedPills
            ariaLabel="Filter by severity"
            value={severity || 'all'}
            onChange={(value) => {
              setSeverity(value === 'all' ? '' : value);
              resetPage();
            }}
            options={[{ value: 'all', label: 'All' }, ...severityLevels]}
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
        mapEmptyLabel="No mapped hazards yet"
      >
        <div className="space-y-3">
          <DataView
            dense
            isLoading={listQuery.isLoading}
            error={listQuery.isError}
            onRetry={() => listQuery.refetch()}
            loadingLabel="Loading hazards…"
            items={pageRows}
            empty={{
              icon: ShieldCheck,
              title: 'No hazards here',
              description:
                'Nothing matching these filters. Electrical hazards reported by residents appear in this list.',
            }}
            renderCard={(hazard) => {
              const action = STATUS_ACTIONS[String(hazard.status ?? '').toLowerCase()];
              const assignedLineman = hazard.updatedBy
                ? resolveLinemanName(hazard.updatedBy) || 'Unknown lineman'
                : null;
              return (
                <RecordCard
                  variant="feed"
                  icon={AlertTriangle}
                  iconTone={severityTone(hazard.severity)}
                  title={hazard.locationName || hazard.barangay || 'Electrical hazard'}
                  subtitle={[
                    humanize(hazard.hazardType, 'Hazard'),
                    hazard.barangay,
                    `reported ${formatRelativeTime(hazard.createdAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  badges={[
                    hazard.severity
                      ? { label: humanize(hazard.severity), tone: severityTone(hazard.severity) }
                      : null,
                    hazard.status ? { label: humanize(hazard.status), tone: statusTone(hazard.status) } : null,
                    assignedLineman ? { label: `Assigned: ${assignedLineman}`, tone: 'info' } : null,
                  ]}
                  description={hazard.description}
                  meta={[{ label: 'Reported', value: formatDateTime(hazard.createdAt) }]}
                  actions={
                    <>
                      {isManager && action ? (
                        <Button
                          size="xs"
                          variant="outline"
                          icon={UserCheck}
                          onClick={() => {
                            setAssignHazard(hazard);
                            setAssignStatus(action.value);
                            setAssignLinemanId('');
                            setAssignOpen(true);
                          }}
                          aria-label={`Assign a lineman in ${hazard.barangay || 'this barangay'}`}
                        >
                          Assign
                        </Button>
                      ) : null}
                      <Button size="xs" variant="outline" icon={ArrowUpDown} onClick={() => setStatusTarget(hazard)}>
                        Change status
                      </Button>
                    </>
                  }
                >
                  {hazard.image ? <ViewableImage src={hazard.image} alt="Hazard evidence" /> : null}
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

      <Modal
        open={assignOpen}
        onClose={statusMutation.isPending ? undefined : closeAssign}
        title="Assign lineman & update status"
        size="sm"
        closeOnBackdrop={!statusMutation.isPending}
        description={
          assignHazard
            ? `Assign a lineman to ${humanize(assignStatus)} this hazard: ${assignHazard.locationName || assignHazard.barangay || 'Electrical hazard'}.`
            : ''
        }
      >
        <div className="space-y-3">
          <Select
            label="Lineman"
            required
            options={linemanOptions}
            placeholder={
              linemenQuery.isLoading ? 'Loading linemen…' : 'Select a lineman'
            }
            loading={linemenQuery.isLoading}
            disabled={statusMutation.isPending}
            value={assignLinemanId}
            onChange={(event) => setAssignLinemanId(event.target.value)}
            error={
              assignOpen && !assignLinemanId ? 'Choose a lineman' : undefined
            }
          />
          {linemenQuery.isError && (
            <InfoNote>
              The lineman list could not be loaded. Check your connection and try again.
            </InfoNote>
          )}
        </div>
        <footer className="mt-4">
          <Button
            variant="outline"
            onClick={closeAssign}
            disabled={statusMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!assignLinemanId || !assignHazard) return;
              closeAssign();
              statusMutation.mutate({
                hazardId: assignHazard.id,
                status: assignStatus,
                updated_by: Number(assignLinemanId),
              });
            }}
            loading={statusMutation.isPending}
            disabled={!assignLinemanId || !assignHazard || statusMutation.isPending}
          >
            Assign & update
          </Button>
        </footer>
      </Modal>

      <StatusChangeDialog
        open={Boolean(statusTarget)}
        reportLabel={statusTarget?.locationName || statusTarget?.barangay}
        currentStatus={statusTarget?.status}
        statuses={HAZARD_STATUSES}
        hint="Reopening a resolved hazard does not clear its stored resolution timestamp."
        onClose={() => setStatusTarget(null)}
        onSubmit={(nextStatus) =>
          statusMutation.mutateAsync({ hazardId: statusTarget.id, status: nextStatus })
        }
        loading={statusMutation.isPending}
      />

      <p className="text-xs text-navy-400">
        Statuses are the database enum: {HAZARD_STATUSES.map((value) => humanize(value)).join(', ')}.
        Reopening a resolved hazard does not clear its stored resolution timestamp.
      </p>
    </div>
  );
}
