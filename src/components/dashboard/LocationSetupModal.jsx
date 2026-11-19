import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { AuthAlert, AuthSuccess, InfoNote } from '@/components/ui/Alert';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useReference } from '@/context/ReferenceContext';
import { useSaveLocation } from '@/hooks/useSavedLocation';
import { toUserMessage } from '@/utils/errorMessage';
import { validateRequired } from '@/utils/validators';

/**
 * Modal for setting up the user's initial location.
 * Styled to match the landing page's Contact section design language.
 */
export default function LocationSetupModal({ open, onClose, onSkip }) {
  if (!open) return null;

  const saveLocation = useSaveLocation();
  const { barangays } = useReference();
  const geo = useGeolocation();

  const [address, setAddress] = useState('');
  const [barangayName, setBarangayName] = useState('');
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);

  // Offer the device coordinates as the address so the server can resolve them.
  const useMyLocation = () => {
    geo.locate();
  };

  useEffect(() => {
    if (geo.lat === null || geo.lng === null) return;
    setAddress(`${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)}`);
  }, [geo.lat, geo.lng]);

  const handleSave = async () => {
    setFormError('');

    const required = validateRequired(address, 'Address');
    if (required) {
      setFormError(required);
      return;
    }

    try {
      await saveLocation.mutateAsync({
        address: address.trim(),
        barangay_name: barangayName || undefined,
      });
      onClose();
    } catch (saveError) {
      setFormError(
        toUserMessage(saveError, 'We could not resolve that address. Try adding more detail, like the barangay.')
      );
    }
  };

  // Landing page exact colors (RGB for opacity calculations)
  // --navy: #153243 = rgb(21, 50, 67)
  // --or: #f18f01 = rgb(241, 143, 1)
  // --ink (text): #153243 = rgb(21, 50, 67)
  // --bg: #fefeff = rgb(254, 254, 255)
  // --blue: #284b63 = rgb(40, 75, 99)
  const lp = {
    navy: '#153243',
    navyRgb: '21, 50, 67',
    or: '#f18f01',
    orRgb: '241, 143, 1',
    ink: '#153243',
    bg: '#fefeff',
    blue: '#284b63',
  };

  // Helper for rgba with landing page colors
  const rgba = (rgb, alpha) => `rgba(${rgb}, ${alpha})`;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop - landing page navy grid (same as Hero/dashboard) 80% */}
      <div
        className="fixed inset-0 animate-fade-in backdrop-blur-sm"
        style={{
          backgroundColor: rgba(lp.navyRgb, 0.8),
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: '115px 115px',
        }}
        onClick={onSkip}
        aria-hidden="true"
      />

      {/* Modal panel - landing page surface */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set up your location"
        className="relative z-10 w-full max-w-lg animate-slide-up rounded-2xl shadow-pop dark:shadow-pop-dark"
        style={{
          backgroundColor: lp.bg,
          border: `1px solid ${rgba(lp.navyRgb, 0.2)}`,
          color: lp.navy,
        }}
      >
        {/* Header - matches landing page .hd pattern */}
        <div className="p-6" style={{ borderBottom: `1px solid ${rgba(lp.navyRgb, 0.2)}` }}>
          <div className="max-w-xl mx-auto text-center">
            {/* Eyebrow - matches landing page .eyebrow */}
            <p className="eyebrow mb-4">
              Get started
            </p>
            {/* Title with highlighted word - matches landing page h2 with .tag */}
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: lp.navy }}>
              Set Up Your <span className="tag tag--o"><i>Location</i></span>
            </h2>
            {/* Subtitle - matches landing page .sub */}
            <p className="mt-4 text-base font-normal leading-relaxed max-w-xl mx-auto" style={{ color: rgba(lp.navyRgb, 0.6), opacity: 0.8 }}>
              PowerGuide needs your location to show nearby outages, hazards, power stations, and risk areas.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Welcome callout - landing page accent */}
          <div
            className="flex items-start gap-3 p-4 rounded-xl"
            style={{
              backgroundColor: rgba(lp.orRgb, 0.1),
              border: `1px solid ${rgba(lp.orRgb, 0.3)}`,
            }}
          >
            <div
              className="flex-shrink-0 mt-0.5 p-2 rounded-lg"
              style={{ backgroundColor: rgba(lp.orRgb, 0.15) }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: lp.or }} aria-hidden="true" />
            </div>
            <div className="text-sm" style={{ color: rgba(lp.navyRgb, 0.8) }}>
              <p className="font-semibold" style={{ color: lp.navy }}>Welcome to PowerGuide!</p>
              <p className="mt-1">To get started, please enter your address so we can personalize your dashboard with nearby reports and power stations.</p>
            </div>
          </div>

          {/* Form error - landing page accent */}
          {formError ? (
            <AuthAlert
              className="rounded-control border p-3.5 text-sm font-medium"
              style={{
                backgroundColor: rgba(lp.orRgb, 0.1),
                borderColor: rgba(lp.orRgb, 0.3),
                color: lp.or,
              }}
            >
              {formError}
            </AuthAlert>
          ) : null}

          {/* Success - subtle navy success */}
          {saved ? (
            <AuthSuccess
              className="rounded-control border p-3.5 text-sm font-medium"
              style={{
                backgroundColor: rgba(lp.navyRgb, 0.06),
                borderColor: rgba(lp.navyRgb, 0.2),
                color: lp.navy,
              }}
            >
              Your location is saved!
            </AuthSuccess>
          ) : null}

          {/* Form fields - matching landing page Contact section */}
          <div className="space-y-6">
            {/* Address field - label wrapping input like landing page */}
            <label className="block space-y-2">
              <span className="block font-semibold text-sm" style={{ color: lp.navy }}>Address</span>
              <input
                type="text"
                required
                placeholder="e.g. San Carlos Cathedral, Dagupan City"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setSaved(false);
                }}
                className="w-full h-11 px-4 rounded-lg transition-shadow"
                style={{
                  border: `1px solid ${rgba(lp.navyRgb, 0.3)}`,
                  backgroundColor: lp.bg,
                  color: lp.ink,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.boxShadow = `0 0 0 3px ${lp.or}`;
                  e.target.style.borderColor = 'transparent';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                  e.target.style.borderColor = rgba(lp.navyRgb, 0.3);
                }}
                aria-describedby="address-hint"
              />
              <p id="address-hint" className="text-xs" style={{ color: rgba(lp.navyRgb, 0.5) }}>
                The server resolves this into map coordinates and matches your barangay.
              </p>
            </label>

            {/* Barangay Select */}
            <label className="block space-y-2">
              <span className="block font-semibold text-sm" style={{ color: lp.navy }}>Barangay (optional)</span>
              <Select
                placeholder="Detected automatically"
                options={barangays}
                value={barangayName}
                onChange={(event) => {
                  setBarangayName(event.target.value);
                  setSaved(false);
                }}
                className="w-full h-11 px-4 pr-10 rounded-lg appearance-none transition-shadow"
                style={{
                  border: `1px solid ${rgba(lp.navyRgb, 0.3)}`,
                  backgroundColor: lp.bg,
                  color: lp.ink,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.boxShadow = `0 0 0 3px ${lp.or}`;
                  e.target.style.borderColor = 'transparent';
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = 'none';
                  e.target.style.borderColor = rgba(lp.navyRgb, 0.3);
                }}
                wrapperClassName=""
                labelClassName="hidden"
              />
            </label>

            {/* Buttons - matching landing page .btn and .btn--w */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="primary"
                icon={saveLocation.isPending ? Loader2 : Save}
                loading={saveLocation.isPending}
                onClick={handleSave}
                className="h-11 px-6 text-base font-semibold rounded-lg"
                style={{
                  backgroundColor: lp.or,
                  color: lp.ink,
                  boxShadow: '0 4px 4px rgba(16, 27, 45, 0.12)',
                  border: 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
              >
                Save Location
              </Button>
              <Button
                variant="outline"
                icon={geo.isLocating ? Loader2 : Crosshair}
                loading={geo.isLocating}
                onClick={useMyLocation}
                className="h-11 px-6 text-base font-semibold rounded-lg"
                style={{
                  backgroundColor: lp.bg,
                  color: lp.navy,
                  border: `1px solid ${rgba(lp.navyRgb, 0.8)}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = rgba(lp.navyRgb, 0.05);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = lp.bg;
                }}
              >
                Use Current Location
              </Button>
            </div>

            {/* Geolocation error - landing page accent */}
            {geo.error ? (
              <p className="text-xs font-medium" role="status" style={{ color: lp.or }}>
                {geo.error}
              </p>
            ) : null}

            {/* Info note - landing page muted */}
            <InfoNote
              className="rounded-control p-3 text-xs border"
              style={{
                backgroundColor: rgba(lp.navyRgb, 0.03),
                borderColor: rgba(lp.navyRgb, 0.1),
                color: rgba(lp.navyRgb, 0.6),
              }}
            >
              PowerGuide stores one primary location. Nearby searches use it as the centre point.
              Your exact address is never shared with other users.
            </InfoNote>
          </div>
        </div>

        {/* Footer - landing page border/divider */}
        <div className="flex justify-end p-4 rounded-b-2xl" style={{ borderTop: `1px solid ${rgba(lp.navyRgb, 0.2)}`, backgroundColor: rgba(lp.navyRgb, 0.03) }}>
          <Button
            variant="ghost"
            onClick={onSkip}
            className="font-medium"
            style={{
              color: lp.or,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = rgba(lp.orRgb, 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Skip (Log out)
          </Button>
        </div>
      </div>
    </div>
  );
}