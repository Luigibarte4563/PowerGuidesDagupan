import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ZoomControl } from 'react-leaflet';
import { Activity, Flame, Layers, RefreshCw } from 'lucide-react';
import Pagination from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import DataView from '@/components/DataView';
import RecordCard from '@/components/RecordCard';
import AppMap, {
  FitPoints,
  HEAT_LEGEND,
  HeatLayer,
  MapHitAreas,
  MapLegend,
} from '@/components/Map';
import MapWorkspace, { FeedActions, FeedToggle } from '@/components/MapWorkspace';
import { heatmapApi } from '@/api';
import { COMPANY_PAGE_SIZE, COMPANY_QUERY_KEYS, severityTone } from '@/utils/constants';
import { formatNumber, formatTime, humanize, isInDagupanBounds } from '@/utils/formatters';

const LOOKBACK_OPTIONS = [
  { value: 1, label: 'Last 24 hours' },
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
];

/** Feed tabs split the same live points by forecast severity. */
const RISK_TABS = [
  { value: 'all', label: 'All areas' },
  { value: 'high', label: 'High risk' },
  { value: 'low', label: 'Low risk' },
];

const isHighRisk = (point) => ['high', 'critical'].includes(String(point.forecastLevel).toLowerCase());

/**
 * Company outage heatmap. Read-only, city-wide: the live `heatmap/get.php` by-barangay
 * points drive both the heat canvas and the feed, and anything outside Dagupan is
 * dropped so a bad geocode cannot pull the fitted view off the city.
 */
export default function Heatmap() {
  const [lookbackDays, setLookbackDays] = useState(7);
  const [risk, setRisk] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const heatmapQuery = useQuery({
    queryKey: COMPANY_QUERY_KEYS.heatmap({ lookbackDays }),
    queryFn: async ({ signal }) => (await heatmapApi.getHeatmap({ days: lookbackDays }, { signal })).points,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const points = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (heatmapQuery.data || []).filter((point) => {
      if (!isInDagupanBounds(point.lat, point.lng)) return false;
      if (risk === 'high' && !isHighRisk(point)) return false;
      if (risk === 'low' && isHighRisk(point)) return false;
      if (!term) return true;
      return [point.label, point.forecastLevel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [heatmapQuery.data, risk, search]);

  const pageCount = Math.max(1, Math.ceil(points.length / COMPANY_PAGE_SIZE));
  const pageRows = points.slice((page - 1) * COMPANY_PAGE_SIZE, page * COMPANY_PAGE_SIZE);

  const totalReports = points.reduce((sum, point) => sum + point.reportCount, 0);
  const highCount = points.filter(isHighRisk).length;

  const resetPage = () => setPage(1);

  const heatMap = (
    <AppMap zoom={12} zoomControl={false} className="h-full w-full">
      <ZoomControl position="bottomright" />
      <FitPoints items={points} />
      {points.length ? (
        <>
          <HeatLayer points={points} radius={30} blur={18} minOpacity={0.6} />
          <MapHitAreas items={points} radiusFor={(point) => 30 + point.intensity * 46}>
            {(point) => (
              <div className="min-w-[13rem]">
                <p className="font-bold text-navy-900">{point.label}</p>
                <p className="mt-1 text-sm font-bold text-navy-800">
                  {formatNumber(point.reportCount)} report{point.reportCount === 1 ? '' : 's'} in this area
                </p>
                {point.forecastLevel ? (
                  <Badge tone={severityTone(point.forecastLevel)} size="sm" className="mt-2">
                    {humanize(point.forecastLevel)} forecast
                  </Badge>
                ) : null}
              </div>
            )}
          </MapHitAreas>
        </>
      ) : null}
      <MapLegend title="Intensity" items={HEAT_LEGEND} />
    </AppMap>
  );

  return (
    <div
      data-theme="dark"
      className="min-h-full bg-[#153243] px-4 pb-8 pt-5 font-montserrat text-white lg:px-8 lg:pt-6"
    >
      <FeedActions
        actions={
          <Button
            variant="outline"
            icon={RefreshCw}
            loading={heatmapQuery.isFetching}
            onClick={() => heatmapQuery.refetch()}
          >
            Refresh heatmap
          </Button>
        }
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        onClearSearch={() => {
          setSearch('');
          resetPage();
        }}
        searchId="company-heatmap-search"
        searchLabel="Search heatmap areas"
        searchPlaceholder="Search barangay or forecast…"
      />

      <MapWorkspace
        map={heatMap}
        mapLabel="Outage heatmap"
        mapTitle="Heatmap Feed"
        mapSubtitle={`${points.length} area${points.length === 1 ? '' : 's'} plotted${
          heatmapQuery.dataUpdatedAt ? ` · updated ${formatTime(heatmapQuery.dataUpdatedAt)}` : ''
        }`}
        toggle={
          <FeedToggle
            ariaLabel="Filter by forecast risk"
            value={risk}
            onChange={(value) => {
              setRisk(value);
              resetPage();
            }}
            options={RISK_TABS}
          />
        }
        stats={[
          { label: 'Areas', value: points.length, icon: Layers, color: '#22D3EE' },
          { label: 'Reports', value: totalReports, icon: Flame, color: '#FF2E1F' },
          { label: 'High risk', value: highCount, icon: Activity, color: '#f18f01' },
        ]}
        filters={
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Select
              aria-label="Heatmap lookback"
              options={LOOKBACK_OPTIONS}
              value={String(lookbackDays)}
              onChange={(event) => {
                setLookbackDays(Number(event.target.value));
                resetPage();
              }}
              className="h-9 py-0 text-xs"
            />
          </div>
        }
        plottedCount={points.length}
        mapEmpty={!heatmapQuery.isLoading && points.length === 0}
        mapEmptyLabel="No mapped outage activity yet"
      >
        <div className="space-y-3">
          <DataView
            dense
            isLoading={heatmapQuery.isLoading}
            error={heatmapQuery.isError}
            onRetry={() => heatmapQuery.refetch()}
            loadingLabel="Loading heatmap…"
            items={pageRows}
            empty={{
              icon: Flame,
              title: 'No outage activity here',
              description: 'No recent active outage reports match these filters within Dagupan.',
            }}
            renderCard={(point) => (
              <RecordCard
                variant="feed"
                icon={Flame}
                iconTone={point.forecastLevel ? severityTone(point.forecastLevel) : 'neutral'}
                title={point.label}
                subtitle={`${formatNumber(point.reportCount)} report${point.reportCount === 1 ? '' : 's'} in the last ${lookbackDays} day${lookbackDays === 1 ? '' : 's'}`}
                badges={[
                  point.forecastLevel
                    ? { label: `${humanize(point.forecastLevel)} forecast`, tone: severityTone(point.forecastLevel) }
                    : null,
                ].filter(Boolean)}
                meta={[
                  Number.isFinite(Number(point.severityScore))
                    ? { label: 'Severity score', value: formatNumber(point.severityScore) }
                    : null,
                  Number.isFinite(Number(point.confidenceScore))
                    ? { label: 'Confirmed', value: `${formatNumber(point.confidenceScore)}%` }
                    : null,
                  Number(point.raw?.affected_houses) > 0
                    ? { label: 'Households', value: formatNumber(point.raw.affected_houses) }
                    : null,
                ].filter(Boolean)}
              />
            )}
          />

          <Pagination
            page={page}
            pageCount={pageCount}
            total={points.length}
            pageSize={COMPANY_PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      </MapWorkspace>
    </div>
  );
}
