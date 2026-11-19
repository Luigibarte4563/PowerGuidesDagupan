import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ZoomControl } from 'react-leaflet';
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  Search,
  UserCheck,
  Zap,
} from 'lucide-react';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, {
  FitPoints,
  MapLegend,
  MapPoints,
  SEVERITY_COLORS,
} from '@/components/Map';
import MapWorkspace, { FeedActions, FeedPills, FeedToggle } from '@/components/MapWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useToast } from '@/context/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCompanyOutageList } from '@/hooks/useCompanyOutages';
import { useInvalidateAssignments } from '@/hooks/useLinemanAssignments';
import { companyOutagesApi } from '@/api';
import {
  COMPANY_PAGE_SIZE,
  COMPANY_QUERY_KEYS,
  severityTone,
  statusTone,
} from '@/utils/constants';
import { readCompanyOutage, resolveImageUrl } from '@/utils/records';
import {
  formatDateTime,
  formatRelativeTime,
  formatTime,
  humanize,
  hasCoordinates,
  isInDagupanBounds,
} from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import AssignmentFormModal from './components/AssignmentFormModal';
import StatusChangeDialog from '@/components/StatusChangeDialog';

const TABS = [
  { value: 'all', label: 'All', icon: AlertTriangle },
  { value: 'active', label: 'Active', icon: Zap },
  { value: 'verified', label: 'Verified', icon: UserCheck },
  { value: 'resolved', label: 'Resolved', icon: CalendarClock },
];

/**
 * Module OUT - outage report management (FR-OUT-1, FR-OUT-2, FR-OUT-11).
 * The company endpoint takes status/severity but no barangay or keyword, so those
 * two narrow the already-scoped rows in the browser.
 */
export default function Outages() {
  const { isManager } = useAuth();
  const { severityLevels, barangays } = useReference();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('status') || 'all');
  const [severity, setSeverity] = useState('');
  const [barangay, setBarangay] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusTarget, setStatusTarget] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const invalidateAssignments = useInvalidateAssignments();
  const debouncedSearch = useDebouncedValue(search);

  // Keep the status filter in the URL so an Overview summary card can deep-link here.
  useEffect(() => {
    const current = searchParams.get('status') || '';
    if ((tab === 'all' ? '' : tab) === current) return;
    const next = new URLSearchParams(searchParams);
    if (tab === 'all') next.delete('status');
    else next.set('status', tab);
    setSearchParams(next, { replace: true });
  }, [tab, searchParams, setSearchParams]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [tab, severity, barangay, debouncedSearch]);

  const listQuery = useCompanyOutageList({
    status: tab === 'all' ? undefined : tab,
    severity: severity || undefined,
  });

  const rows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return (listQuery.data || [])
      .map(readCompanyOutage)
      .filter((outage) => {
        if (barangay && outage.barangay !== barangay) return false;
        if (!term) return true;
        return [outage.locationName, outage.barangay, outage.description, outage.category, outage.reporter]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [listQuery.data, debouncedSearch, barangay]);

  const pageCount = Math.max(1, Math.ceil(rows.length / COMPANY_PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  const resetPage = () => setPage(1);

  const mapped = useMemo(
    () => rows.filter((outage) => hasCoordinates(outage.lat, outage.lng) && isInDagupanBounds(outage.lat, outage.lng)),
    [rows]
  );

  const outageMap =
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
          toneFor={(outage) =>
            ['critical', 'high'].includes(String(outage.severity).toLowerCase())
              ? 'danger'
              : String(outage.severity).toLowerCase() === 'moderate'
                ? 'warning'
                : 'success'
          }
          glyphFor={() => 'O'}
        >
          {(outage) => (
            <div className="min-w-[13rem]">
              <p className="font-bold text-navy-900">
                {outage.locationName || outage.barangay || 'Outage report'}
              </p>
              <p className="mt-0.5 text-xs text-navy-500">
                {[humanize(outage.category, 'Outage'), outage.barangay]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {outage.severity ? (
                  <Badge tone={severityTone(outage.severity)} size="sm">
                    {humanize(outage.severity)}
                  </Badge>
                ) : null}
                {outage.status ? (
                  <Badge tone={statusTone(outage.status)} size="sm">
                    {humanize(outage.status)}
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

  // Feed stat tiles, counted over the rows currently in view.
  const criticalCount = rows.filter((outage) =>
    ['critical', 'high'].includes(String(outage.severity).toLowerCase())
  ).length;
  const resolvedCount = rows.filter(
    (outage) => String(outage.status).toLowerCase() === 'resolved'
  ).length;

  const singleMutation = useMutation({
    mutationFn: ({ id, nextStatus }) => companyOutagesApi.updateSingle({ id, status: nextStatus }),
    onSuccess: (_result, variables) => {
      toast.success(`Report moved to ${humanize(variables.nextStatus)}.`, { title: 'Status updated' });
      setStatusTarget(null);
      // FR-OUT-11: the whole outage cache is invalidated so the list, the counts and
      // the Overview cards all agree.
      queryClient.invalidateQueries({ queryKey: ['company-outages'] });
      queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.summary });
    },
    onError: (error) => {
      toast.error(toUserMessage(error, 'The status could not be changed.'), { title: 'Update failed' });
    },
  });

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
        searchId="company-outage-search"
        searchLabel="Search outages"
        searchPlaceholder="Search location, description, reference…"
      />

      <MapWorkspace
        map={outageMap}
        mapLabel="Outage map"
        mapTitle="Outage Review Feed"
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
        mapEmptyLabel="No mapped outages yet"
      >
        <div className="space-y-3">
          <DataView
            dense
            isLoading={listQuery.isLoading}
            error={listQuery.isError}
            onRetry={() => listQuery.refetch()}
            loadingLabel="Loading outage reports…"
            items={pageRows}
            empty={{
              icon: Zap,
              title: 'No outages here',
              description:
                'Nothing matching these filters. Outages reported by residents appear in this list.',
            }}
            renderCard={(outage) => (
              <RecordCard
                variant="feed"
                icon={Zap}
                iconTone={outage.severity ? severityTone(outage.severity) : 'primary'}
                title={outage.locationName || outage.barangay || 'Unspecified location'}
                subtitle={[outage.barangay, outage.reporter, `reported ${formatRelativeTime(outage.createdAt)}`]
                  .filter(Boolean)
                  .join(' · ')}
                badges={[
                  outage.severity
                    ? { label: humanize(outage.severity), tone: severityTone(outage.severity) }
                    : null,
                  outage.status ? { label: humanize(outage.status), tone: statusTone(outage.status) } : null,
                  outage.isVerified ? { label: 'Verified', tone: 'info' } : null,
                ]}
                description={outage.description}
                meta={[
                  { label: 'Category', value: humanize(outage.category, 'Uncategorised') },
                  outage.affectedHouses
                    ? { label: 'Houses affected', value: String(outage.affectedHouses) }
                    : null,
                  { label: 'Reported', value: formatDateTime(outage.createdAt), icon: CalendarClock },
                ].filter(Boolean)}
                actions={
                  <>
                    {isManager ? (
                      <Button
                        size="xs"
                        variant="outline"
                        icon={UserCheck}
                        onClick={() => setAssigning(outage)}
                        aria-label={`Assign a lineman in ${outage.barangay || 'this barangay'}`}
                      >
                        Assign
                      </Button>
                    ) : null}
                    <Button size="xs" variant="outline" icon={ArrowUpDown} onClick={() => setStatusTarget(outage)}>
                      Change status
                    </Button>
                  </>
                }
              >
                {outage.images[0] ? (
                  <a
                    href={resolveImageUrl(outage.images[0])}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block"
                  >
                    <img
                      src={resolveImageUrl(outage.images[0])}
                      alt="Outage evidence"
                      loading="lazy"
                      className="h-32 w-full rounded-control border border-navy-100 object-cover"
                    />
                  </a>
                ) : null}
              </RecordCard>
            )}
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

      <p className="text-xs text-navy-400">
        Company view: reports visible to the utility. Search, the barangay filter and sorting happen in your browser.
      </p>

      <StatusChangeDialog
        open={Boolean(statusTarget)}
        reportLabel={statusTarget?.locationName || statusTarget?.barangay}
        currentStatus={statusTarget?.status}
        onClose={() => setStatusTarget(null)}
        onSubmit={(nextStatus) => singleMutation.mutateAsync({ id: statusTarget.id, nextStatus })}
        loading={singleMutation.isPending}
      />

      <AssignmentFormModal
        open={Boolean(assigning)}
        assignment={null}
        initialBarangayId={assigning?.barangayId}
        onClose={() => setAssigning(null)}
        onSaved={invalidateAssignments}
      />
    </div>
  );
}
