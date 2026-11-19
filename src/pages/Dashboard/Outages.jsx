import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ZoomControl } from 'react-leaflet';
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Clock3,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import AppMap, { MapLegend, MapPoints, SEVERITY_COLORS } from '@/components/Map';
import { outagesApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { formatRelativeTime, formatTime, hasCoordinates } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import { isOwnedBy, readOutage, resolveImageUrl } from '@/utils/records';
import {
  filterByStatus,
  formatCategory,
  formatLabel,
  mergeReports,
  pageCount,
  pageSlice,
  searchReports,
  severityKey,
  severityStyle,
  sortByAlertLevel,
} from '@/utils/outageFeed';
import OutageFormModal from './components/OutageFormModal';
import ReportFeedbackDialog from './components/ReportFeedbackDialog';

const PAGE_SIZE = 3;
const MAP_CENTER = { lat: 16.04, lng: 120.33 };
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const SURFACE_INPUT =
  'h-11 rounded-xl border border-white/10 bg-[#153243]/60 text-sm text-white placeholder:text-white/30 focus:border-[#f18f01] focus:outline-none focus:ring-2 focus:ring-[#f18f01]/25';

function statusClasses(status) {
  const key = String(status ?? '').toLowerCase();
  if (/resolv|clos|complet|clear/.test(key)) {
    return 'border-[#34FB34]/20 bg-[#34FB34]/10 text-[#34FB34]';
  }
  if (/reject|cancel|dismiss/.test(key)) {
    return 'border-[#FF2E1F]/20 bg-[#FF2E1F]/10 text-[#FF2E1F]';
  }
  if (/progress|review|verif|investigat|pending/.test(key)) {
    return 'border-[#f18f01]/20 bg-[#f18f01]/10 text-[#f18f01]';
  }
  if (/active|open|reported/.test(key)) {
    return 'border-[#22D3EE]/20 bg-[#22D3EE]/10 text-[#22D3EE]';
  }
  return 'border-[#9CA3AF]/20 bg-[#9CA3AF]/10 text-[#9CA3AF]';
}

/**
 * Interactive outage map and live feed.
 *
 * `get.php` only exposes active public reports, while `get_my_report.php` exposes
 * the resident's own reports (including resolved ones). Both are fetched every
 * ten seconds and deduplicated by id, with the owned copy winning so the Edit and
 * Delete actions stay attached to the row the resident can change.
 */
export default function Outages() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [scope, setScope] = useState(initialTab === 'mine' ? 'mine' : 'all');
  const [status, setStatus] = useState(
    initialTab === 'resolved' ? 'resolved' : initialTab === 'mine' ? 'all' : 'active'
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const feedQuery = useQuery({
    queryKey: QUERY_KEYS.outages({ scope: 'interactive-map' }),
    queryFn: async ({ signal }) => {
      const [publicResult, mineResult] = await Promise.all([
        outagesApi.list({}, { signal }),
        outagesApi.getMyReports({}, { signal }),
      ]);
      const publicReports = publicResult.items.map(readOutage);
      const mineReports = mineResult.items.map(readOutage);
      return {
        reports: mergeReports(publicReports, mineReports),
        mineIds: mineReports.map((report) => report.id).filter((id) => id !== null && id !== undefined),
      };
    },
    refetchInterval: 10000,
    staleTime: 5000,
    retry: 1,
  });

  const reports = useMemo(() => feedQuery.data?.reports || [], [feedQuery.data]);
  const myIds = useMemo(() => feedQuery.data?.mineIds || [], [feedQuery.data]);

  const scopedReports = useMemo(
    () => (scope === 'mine' ? reports.filter((report) => isOwnedBy(report, null, { myIds })) : reports),
    [reports, scope, myIds]
  );

  const activeScopeReports = useMemo(() => filterByStatus(scopedReports, 'active'), [scopedReports]);
  const filteredReports = useMemo(
    () => sortByAlertLevel(searchReports(filterByStatus(scopedReports, status), search)),
    [scopedReports, status, search]
  );
  const mappableReports = useMemo(
    () => filteredReports.filter((report) => hasCoordinates(report.lat, report.lng)),
    [filteredReports]
  );

  const totalPages = pageCount(filteredReports.length, PAGE_SIZE);
  const currentPage = Math.min(page, totalPages);
  const pagedReports = pageSlice(filteredReports, currentPage, PAGE_SIZE);

  const stats = useMemo(() => {
    const affectedHomes = activeScopeReports.reduce((total, report) => {
      const affected = Number(report.affectedHouses);
      return total + (Number.isFinite(affected) ? affected : 0);
    }, 0);
    return {
      active: activeScopeReports.length,
      critical: activeScopeReports.filter((report) => severityKey(report.severity) === 'critical').length,
      affectedHomes,
    };
  }, [activeScopeReports]);

  // "Report once" prevention: check if user has any active (unresolved) outage reports
  const hasUnresolvedOutage = useMemo(
    () => reports.some((report) => isOwnedBy(report, null, { myIds }) && report.status && report.status !== 'resolved'),
    [reports, myIds]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Quick action from the overview: /dashboard/outages?new=1 opens the form.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setEditor({ outage: null });
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const deleteMutation = useMutation({
    mutationFn: (id) => outagesApi.remove(id),
  });

  const switchScope = (nextScope) => {
    if (nextScope === scope) return;
    setScope(nextScope);
    setStatus(nextScope === 'mine' ? 'all' : 'active');
    setSearch('');
    setPage(1);
  };

  const changeStatus = (nextStatus) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const openCreate = () => setEditor({ outage: null });
  const openEdit = (outage) => setEditor({ outage });

  const handleDelete = async () => {
    if (!confirming) return;
    try {
      await deleteMutation.mutateAsync(confirming.id);
      queryClient.invalidateQueries({ queryKey: ['outages'] });
      setConfirming(null);
      setFeedback({
        type: 'success',
        title: 'Report deleted',
        message: 'The outage report was removed from the community feed.',
      });
    } catch (error) {
      setConfirming(null);
      setFeedback({
        type: 'error',
        title: 'Could not delete the report',
        message: toUserMessage(error, 'Please try again in a moment.'),
      });
    }
  };

  const emptyTitle = search.trim()
    ? `No reports match “${search.trim()}”`
    : scope === 'mine'
      ? status === 'active'
        ? 'You have no active reports'
        : status === 'resolved'
          ? 'You have no resolved reports'
          : 'You have not reported an outage yet'
      : status === 'resolved'
        ? 'No resolved reports available'
        : status === 'all'
          ? 'No outage reports yet'
          : 'No active outages right now';

  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#153243] dashboard-grid px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="primary"
          icon={Plus}
          onClick={openCreate}
          disabled={hasUnresolvedOutage}
          className="rounded-xl px-5 shadow-[0_8px_24px_rgba(255,187,2,0.18)]"
        >
          {hasUnresolvedOutage ? 'Resolve existing outage first' : 'Report Outage'}
        </Button>
        <div className="relative w-full sm:w-[260px] xl:w-[280px]">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
            aria-hidden="true"
          />
          <label htmlFor="outage-search" className="sr-only">
            Search outage reports
          </label>
          <input
            id="outage-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search location, description, category…"
            className={`${SURFACE_INPUT} w-full pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none`}
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/40 transition:hover:bg-white/10:hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <section
          className="relative h-[440px] min-w-0 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.04] shadow-[0_20px_50px_rgba(16,27,45,0.35)] lg:h-[550px] xl:flex-1"
          aria-label="Outage map"
        >
          <AppMap
            center={MAP_CENTER}
            zoom={12}
            zoomControl={false}
            className="h-full w-full"
          >
            <ZoomControl position="bottomright" />
            <MapPoints items={mappableReports} toneFor={(outage) => severityStyle(outage.severity).color}>
              {(outage) => {
                const style = severityStyle(outage.severity);
                return (
                  <div className="font-montserrat">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full border px-2 py-0.5 text-[8px] font-extrabold tracking-[0.14em]"
                        style={{
                          color: style.color,
                          borderColor: `${style.color}45`,
                          backgroundColor: `${style.color}18`,
                        }}
                      >
                        {style.label}
                      </span>
                      {outage.status ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8px] font-extrabold tracking-[0.08em] ${statusClasses(outage.status)}`}
                        >
                          {formatLabel(outage.status)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-bold text-white">
                      {outage.locationName || outage.barangay || 'Outage report'}
                    </p>
                    {outage.description ? (
                      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-white/55">
                        {outage.description}
                      </p>
                    ) : null}
                    <div className="mt-2.5 flex items-center justify-between gap-3 text-[9px] font-semibold uppercase tracking-wide text-white/35">
                      <span className="truncate">{formatCategory(outage.category)}</span>
                      <span className="shrink-0">{formatRelativeTime(outage.createdAt)}</span>
                    </div>
                    {isOwnedBy(outage, null, { myIds }) ? (
                      <Link
                        to={`/dashboard/outages/${outage.id}`}
                        className="mt-3 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide !text-[#f18f01] hover:!text-[#f6c200]"
                      >
                        View report details
                        <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                );
              }}
            </MapPoints>
            </AppMap>

            <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full border border-white/10 bg-[#153243]/80 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/60 shadow-xl backdrop-blur-md">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#34FB34]" />
              {mappableReports.length} plotted
            </div>

            <MapLegend
              title="Severity level"
              items={[
                { label: 'Minor', color: SEVERITY_COLORS.low },
                { label: 'Moderate', color: SEVERITY_COLORS.moderate },
                { label: 'Critical', color: SEVERITY_COLORS.critical },
              ]}
            />

            {!feedQuery.isLoading && !feedQuery.isError && !mappableReports.length ? (
              <div className="pointer-events-none absolute inset-x-3 top-14 z-[450] flex justify-center">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-[#153243]/80 px-3.5 py-2 text-[10px] font-semibold text-white/65 shadow-lg backdrop-blur-md">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#f18f01]" aria-hidden="true" />
                  <span className="truncate">No mapped reports yet</span>
                  <span className="hidden truncate text-white/35 sm:inline">
                    · Reports with a saved pin appear here
                  </span>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="flex h-[440px] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_20px_50px_rgba(16,27,45,0.35)] lg:h-[550px] xl:w-[420px] xl:shrink-0">
            <div className="border-b border-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold tracking-tight text-white">Live Outage Feed</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[9px] text-white/40">
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    Updated {feedQuery.dataUpdatedAt ? formatTime(feedQuery.dataUpdatedAt) : '—'} ·
                    refreshes every 10s
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#34FB34]/20 bg-[#34FB34]/10 px-2 py-1 text-[8px] font-extrabold tracking-[0.16em] text-[#34FB34]">
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34FB34] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#34FB34]" />
                  </span>
                  LIVE
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#153243]/60 p-1">
                {[
                  { value: 'all', label: 'All Reports', count: reports.length },
                  { value: 'mine', label: 'My Reports', count: myIds.length },
                ].map((option) => {
                  const active = scope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => switchScope(option.value)}
                      aria-pressed={active}
                      className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition ${
                        active
                          ? 'bg-[#f18f01] text-[#153243] shadow-[0_4px_16px_rgba(255,187,2,0.16)]'
                          : 'text-white/45 hover:bg-white/5 hover:text-white/75'}
                      }`}
                    >
                      {option.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[8px] font-extrabold ${
                          active ? 'bg-[#153243]/15 text-[#153243]' : 'bg-white/10 text-white/40'}
                        }`}
                      >
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Active', value: stats.active, icon: Activity, color: '#22D3EE' },
                  { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: '#FF2E1F' },
                  { label: 'Homes', value: stats.affectedHomes, icon: Home, color: '#f18f01' },
                ].map((tile) => {
                  const Icon = tile.icon;
                  return (
                    <div
                      key={tile.label}
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/40">
                        <Icon className="h-2.5 w-2.5" style={{ color: tile.color }} aria-hidden="true" />
                        {tile.label}
                      </div>
                      <p className="mt-0.5 text-base font-black leading-none text-white">
                        {tile.value.toLocaleString('en-PH')}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center gap-1">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeStatus(option.value)}
                    aria-pressed={status === option.value}
                    className={`h-7 rounded-full border px-2.5 text-[9px] font-bold transition ${
                      status === option.value
                        ? 'border-[#f18f01]/40 bg-[#f18f01]/15 text-[#f18f01]'
                        : 'border-white/10 bg-transparent text-white/45 hover:border-white/20 hover:text-white/70'}
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {feedQuery.isFetching ? (
                  <Loader2 className="ml-auto h-3 w-3 animate-spin text-white/25" aria-label="Refreshing feed" />
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {feedQuery.isLoading ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#f18f01]" aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold text-white/45">Loading outage reports…</p>
                </div>
              ) : feedQuery.isError && !feedQuery.data ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-[#FF2E1F]" aria-hidden="true" />
                  <p className="mt-2 text-sm font-bold text-white">Feed temporarily offline</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                    {toUserMessage(feedQuery.error, 'We could not load the outage feed.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => feedQuery.refetch()}
                    className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white/70 transition:hover:bg-white/10"
                  >
                    Try again
                  </button>
                </div>
              ) : !filteredReports.length ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <Zap className="h-5 w-5 text-[#f18f01]" aria-hidden="true" />
                  </div>
                  <p className="mt-3 text-sm font-bold text-white">{emptyTitle}</p>
                  <p className="mt-1 max-w-[240px] text-[11px] leading-relaxed text-white/40">
                    {search.trim()
                      ? 'Try a different location, description or category.'
                      : 'New community reports will appear here automatically.'}
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={openCreate}
                    disabled={hasUnresolvedOutage}
                    className="mt-3 rounded-lg"
                  >
                    {hasUnresolvedOutage ? 'Resolve existing outage first' : 'Report an outage'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {feedQuery.isError ? (
                    <p className="rounded-lg border border-[#f18f01]/20 bg-[#f18f01]/10 px-2.5 py-2 text-[9px] leading-relaxed text-[#f6c200]">
                      Showing the last known reports. Reconnecting…
                    </p>
                  ) : null}

                  {pagedReports.map((outage) => {
                    const style = severityStyle(outage.severity);
                    const owned = isOwnedBy(outage, null, { myIds });
                    return (
                      <article
                        key={outage.id}
                        className={`group rounded-xl border p-2.5 transition duration-200 hover:-translate-y-0.5 ${
                          owned
                            ? 'border-[#f18f01]/25 bg-white/[0.06] hover:border-[#f18f01]/40'
                            : 'border-white/10 bg-white/[0.05] hover:border-white/15'}
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.swatch}`} />
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.12em] ${style.badge}`}
                            >
                              {style.label}
                            </span>
                            {owned ? (
                              <span className="rounded-full border border-[#f18f01]/25 bg-[#f18f01]/10 px-1.5 py-0.5 text-[8px] font-extrabold tracking-[0.1em] text-[#f18f01]">
                                YOURS
                              </span>
                            ) : null}
                            {outage.status ? (
                              <span
                                className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold tracking-[0.06em] ${statusClasses(outage.status)}`}
                              >
                                {formatLabel(outage.status)}
                              </span>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-[8.5px] font-medium text-white/35">
                            {formatRelativeTime(outage.createdAt)}
                          </span>
                        </div>

                        <h3 className="mt-1 truncate text-[13px] font-bold leading-tight text-white">
                          {owned ? (
                            <Link
                              to={`/dashboard/outages/${outage.id}`}
                              className="transition hover:text-[#f18f01]"
                            >
                              {outage.locationName || outage.barangay || 'Outage report'}
                            </Link>
                          ) : (
                            outage.locationName || outage.barangay || 'Outage report'
                          )}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-white/50">
                          {outage.description || 'No description provided.'}
                        </p>

                        {outage.images[0] ? (
                          <a
                            href={resolveImageUrl(outage.images[0])}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block"
                          >
                            <img
                              src={resolveImageUrl(outage.images[0])}
                              alt="Outage evidence"
                              loading="lazy"
                              className="h-24 w-full rounded-lg border border-white/10 bg-white/5 object-cover"
                            />
                          </a>
                        ) : null}

                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/40">
                            <Zap className="h-2.5 w-2.5 shrink-0 text-[#f18f01]/60" aria-hidden="true" />
                            <span className="truncate">{formatCategory(outage.category)}</span>
                            {outage.barangay ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{outage.barangay}</span>
                              </>
                            ) : null}
                          </div>

                          {owned ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(outage)}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] font-bold text-white/55 transition:hover:border-[#f18f01]/30:hover:bg-[#f18f01]/10:hover:text-[#f18f01]"
                                aria-label={`Edit report ${outage.reportKey || outage.id}`}
                              >
                                <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirming(outage)}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] font-bold text-white/55 transition:hover:border-[#FF2E1F]/30:hover:bg-[#FF2E1F]/10:hover:text-[#FF2E1F]"
                                aria-label={`Delete report ${outage.reportKey || outage.id}`}
                              >
                                <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      {editor ? (
        <OutageFormModal
          key={editor.outage?.id ?? 'new'}
          open
          outage={editor.outage}
          onClose={() => setEditor(null)}
          onResult={(result) => setFeedback(result)}
        />
      ) : null}

      {confirming ? (
        <ReportFeedbackDialog
          open
          type="warning"
          danger
          title="Delete this report?"
          message={`"${confirming.locationName || confirming.barangay || 'This report'}" will be removed from the community feed. This cannot be undone.`}
          confirmLabel="Delete report"
          showCancel
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onClose={() => setConfirming(null)}
        />
      ) : null}

      {feedback ? (
        <ReportFeedbackDialog
          open
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      ) : null}
      </div>
  );
}