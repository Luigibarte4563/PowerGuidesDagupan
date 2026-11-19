import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ZoomControl } from 'react-leaflet';
import { Activity, AlertTriangle, CalendarClock, CheckCircle2, Plus, Pencil, Trash2 } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, { FitPoints, MapLegend, MapPoints, SEVERITY_COLORS } from '@/components/Map';
import MapWorkspace, { FeedActions, FeedPills } from '@/components/MapWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useReference } from '@/context/ReferenceContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { hazardsApi } from '@/api';
import { QUERY_KEYS } from '@/utils/constants';
import { isOwnedBy, readHazard } from '@/utils/records';
import ViewableImage from '@/components/ViewableImage';
import { severityTone, statusTone } from '@/utils/constants';
import { formatDateTime, formatTime, humanize } from '@/utils/formatters';
import { toUserMessage } from '@/utils/errorMessage';
import HazardFormModal, { HAZARD_SEVERITY_OPTIONS } from './components/HazardFormModal';
import ReportFeedbackDialog from './components/ReportFeedbackDialog';
import { HAZARD_STATUSES } from '@/api';

const HAZARD_STATUS_OPTIONS = HAZARD_STATUSES.map((status) => ({ id: status, name: humanize(status) }));

const SEVERITY_LEGEND = [
  { label: 'Low', color: SEVERITY_COLORS.low },
  { label: 'Moderate', color: SEVERITY_COLORS.moderate },
  { label: 'High', color: SEVERITY_COLORS.high },
  { label: 'Critical', color: SEVERITY_COLORS.critical },
];

/**
 * Module J - electrical hazards across Dagupan: list, map, create and an
 * owner-only status update.
 *
 * Deliberately NOT radius-scoped. A radius lookup needs a saved location, and a
 * location that geocoded to the wrong country returns an empty list that reads as
 * "no hazards in your area". This page instead always loads the whole city feed
 * from `get.php` (no default filter, no LIMIT) and frames the map on the hazards
 * themselves, so the answer to "are there hazards in Dagupan?" never depends on
 * where the user happens to be.
 */
export default function Hazards() {
  const { user } = useAuth();
  const { hazardTypes } = useReference();
  const { coords } = useSavedLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Filters are applied client-side below, so they are kept out of this key -
  // otherwise every keystroke would refetch the same unfiltered city-wide set.
  const listQuery = useQuery({
    queryKey: QUERY_KEYS.hazards({ scope: 'all' }),
    queryFn: async ({ signal }) => (await hazardsApi.list({}, { signal })).items,
    retry: 1,
  });

  // Check if user has any unresolved hazards (reported or verified) to enforce "report once" rule
  const userHazards = useMemo(
    () => (listQuery.data || []).map((record) => readHazard(record)).filter((h) => isOwnedBy(h.raw, user)),
    [listQuery.data, user]
  );
  const hasUnresolvedHazard = userHazards.some((h) => h.status && h.status !== 'resolved');

  const items = (listQuery.data || [])
    .map((record) => readHazard(record))
    .filter((hazard) => {
      if (typeFilter && humanize(hazard.hazardType) !== humanize(typeFilter)) return false;
      if (severityFilter && humanize(hazard.severity) !== humanize(severityFilter)) return false;
      if (statusFilter && hazard.status !== statusFilter) return false;
      const term = debouncedSearch.trim().toLowerCase();
      if (!term) return true;
      return [hazard.hazardType, hazard.description, hazard.locationName, hazard.barangay]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    })
    .sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0));

  const deleteMutation = useMutation({
    mutationFn: (id) => hazardsApi.remove(id),
  });

  const handleDelete = async () => {
    if (!confirming) return;
    try {
      await deleteMutation.mutateAsync(confirming.id);
      queryClient.invalidateQueries({ queryKey: ['hazards'] });
      setConfirming(null);
      setFeedback({
        type: 'success',
        title: 'Report deleted',
        message: 'The hazard report was removed from the community feed.',
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

  // Hazards the map can plot.
  const plotted = useMemo(
    () => items.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    [items]
  );

  const mapSummary =
    plotted.length === 0
      ? 'No hazards with coordinates match your filters yet.'
      : `${plotted.length} hazard${plotted.length === 1 ? '' : 's'} plotted across Dagupan.`;

  // Feed stat tiles, counted the same way the list filters do.
  const openCount = items.filter((item) => item.status !== 'resolved').length;
  const criticalCount = items.filter((item) =>
    ['critical', 'high'].includes(String(item.severity).toLowerCase())
  ).length;
  const resolvedCount = items.filter((item) => item.status === 'resolved').length;

  const hazardMap = (
    <AppMap zoom={13} zoomControl={false} className="h-full w-full">
      {/* No explicit centre: FitPoints frames the hazards themselves. */}
      <ZoomControl position="bottomright" />
      <FitPoints items={plotted} />
      <MapPoints items={plotted} toneFor={(item) => (item.severity ? SEVERITY_COLORS[item.severity.toLowerCase()] : 'neutral')}>
        {(item) => (
          <div className="min-w-[13rem]">
            <p className="font-bold text-navy-900">{item.hazardType || 'Electrical hazard'}</p>
            {item.barangay || item.locationName ? (
              <p className="mt-0.5 text-xs text-navy-500">
                {[item.locationName, item.barangay].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-navy-600">{item.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.severity ? (
                <Badge tone={severityTone(item.severity)} size="sm">
                  {humanize(item.severity)}
                </Badge>
              ) : null}
              {item.status ? (
                <Badge tone={statusTone(item.status)} size="sm">
                  {humanize(item.status)}
                </Badge>
              ) : null}
            </div>
          </div>
        )}
      </MapPoints>
      <MapLegend title="Severity" items={SEVERITY_LEGEND} />
    </AppMap>
  );

  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#153243] dashboard-grid px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <FeedActions
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setFormOpen(true)}
            disabled={hasUnresolvedHazard}
            className="rounded-xl px-5 shadow-[0_8px_24px_rgba(255,187,2,0.18)]"
          >
            {hasUnresolvedHazard ? 'Resolve existing hazard first' : 'Report Hazard'}
          </Button>
        }
        search={search}
        onSearchChange={setSearch}
        onClearSearch={() => setSearch('')}
        searchId="hazard-search"
        searchLabel="Search hazards"
        searchPlaceholder="Search type, location, description…"
      />

      <MapWorkspace
        map={hazardMap}
        mapLabel="Hazard map"
        mapTitle="Live Hazard Feed"
        mapSubtitle={`${mapSummary}${listQuery.dataUpdatedAt ? ` · updated ${formatTime(listQuery.dataUpdatedAt)}` : ''}`}
        stats={[
          { label: 'Open', value: openCount, icon: Activity, color: '#22D3EE' },
          { label: 'High risk', value: criticalCount, icon: AlertTriangle, color: '#FF2E1F' },
          { label: 'Resolved', value: resolvedCount, icon: CheckCircle2, color: '#34FB34' },
        ]}
        pills={
          <FeedPills
            ariaLabel="Filter by status"
            value={statusFilter || 'all'}
            onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: 'All' },
              ...HAZARD_STATUSES.map((status) => ({ value: status, label: humanize(status) })),
            ]}
          />
        }
        filters={
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Select
              aria-label="Filter by hazard type"
              placeholder="All types"
              options={hazardTypes}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 py-0 text-xs"
            />
            <Select
              aria-label="Filter by severity"
              placeholder="All severities"
              options={HAZARD_SEVERITY_OPTIONS}
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="h-9 py-0 text-xs"
            />
          </div>
        }
        plottedCount={plotted.length}
        mapEmpty={!listQuery.isLoading && !listQuery.isError && plotted.length === 0}
        mapEmptyLabel="No mapped hazards yet"
      >
      <DataView
        dense
        isLoading={listQuery.isLoading}
        error={listQuery.isError}
        errorMessage={toUserMessage(listQuery.error)}
        onRetry={() => listQuery.refetch()}
        loadingLabel="Loading electrical hazards…"
        items={items}
        isEmpty={items.length === 0}
        empty={{
          icon: AlertTriangle,
          title: 'No hazards reported for this filter',
          description:
            'That is good news. If you spot a downed wire or exposed cable, please report it so your neighbours know.',
          action: (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setFormOpen(true)}
              disabled={hasUnresolvedHazard}
            >
              {hasUnresolvedHazard ? 'Resolve existing hazard first' : 'Report Hazard'}
            </Button>
          ),
        }}
        renderCard={(hazard) => {
          const owned = isOwnedBy(hazard.raw, user);
          return (
            <RecordCard
              variant="feed"
              icon={AlertTriangle}
              iconTone={hazard.severity ? severityTone(hazard.severity) : 'danger'}
              title={hazard.hazardType || 'Electrical hazard'}
              subtitle={hazard.locationName || hazard.barangay || 'No landmark given'}
              badges={[
                hazard.severity ? { label: humanize(hazard.severity), tone: severityTone(hazard.severity) } : null,
                hazard.status ? { label: humanize(hazard.status), tone: statusTone(hazard.status) } : null,
                owned ? { label: 'My report', tone: 'primary' } : null,
              ].filter(Boolean)}
              description={hazard.description}
              meta={[
                hazard.createdAt
                  ? { label: 'Reported', value: formatDateTime(hazard.createdAt), icon: CalendarClock }
                  : null,
              ].filter(Boolean)}
              actions={
                owned ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditTarget(hazard)}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] font-bold text-white/55 transition:hover:border-[#f18f01]/30:hover:bg-[#f18f01]/10:hover:text-[#f18f01]"
                      aria-label={`Edit report ${hazard.id}`}
                    >
                      <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(hazard)}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[9px] font-bold text-white/55 transition:hover:border-[#FF2E1F]/30:hover:bg-[#FF2E1F]/10:hover:text-[#FF2E1F]"
                      aria-label={`Delete report ${hazard.id}`}
                    >
                      <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                ) : null
              }
            >
              {hazard.image ? <ViewableImage src={hazard.image} alt="Hazard evidence" /> : null}
            </RecordCard>
          );
        }}
      />
      </MapWorkspace>

      {confirming ? (
        <ReportFeedbackDialog
          open
          type="warning"
          danger
          title="Delete this report?"
          message={`"${confirming.locationName || confirming.hazardType || 'This report'}" will be removed from the community feed. This cannot be undone.`}
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

      <HazardFormModal
        open={formOpen || Boolean(editTarget)}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        hazard={editTarget || null}
        defaultLocation={coords}
      />
    </div>
  );
}
