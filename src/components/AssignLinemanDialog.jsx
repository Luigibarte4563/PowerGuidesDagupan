import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { InfoNote } from '@/components/ui/Alert';
import { useLinemenList } from '@/hooks/useLinemanAssignments';
import { humanize } from '@/utils/formatters';

/**
 * Report-level "assign a lineman & update status" dialog.
 *
 * Unlike `Company/components/AssignmentFormModal`, this does not create a
 * lineman/barangay coverage row. It hands the selected lineman to the caller,
 * which stamps the report's `updated_by` and moves its status in one request.
 */
export default function AssignLinemanDialog({
  open,
  onClose,
  reportLabel,
  nextStatus,
  noun = 'report',
  onSubmit,
  loading = false,
}) {
  const [linemanId, setLinemanId] = useState('');
  const linemenQuery = useLinemenList({ enabled: open });

  useEffect(() => {
    if (open) setLinemanId('');
  }, [open, reportLabel, nextStatus]);

  const linemanOptions = useMemo(
    () =>
      (linemenQuery.data || []).map((person) => ({
        value: String(person.id),
        label: person.email ? `${person.name} · ${person.email}` : person.name,
      })),
    [linemenQuery.data]
  );

  const close = () => {
    if (!loading) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Assign lineman & update status"
      size="sm"
      closeOnBackdrop={!loading}
      description={
        open
          ? `Assign a lineman to ${humanize(nextStatus)} this ${noun}: ${reportLabel}.`
          : ''
      }
    >
      <div className="space-y-3">
        <Select
          label="Lineman"
          required
          options={linemanOptions}
          placeholder={linemenQuery.isLoading ? 'Loading linemen…' : 'Select a lineman'}
          loading={linemenQuery.isLoading}
          disabled={loading}
          value={linemanId}
          onChange={(event) => setLinemanId(event.target.value)}
          error={open && !linemanId ? 'Choose a lineman' : undefined}
        />
        {linemenQuery.isError ? (
          <InfoNote>
            The lineman list could not be loaded. Check your connection and try again.
          </InfoNote>
        ) : null}
      </div>
      <footer className="mt-4">
        <Button variant="outline" onClick={close} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (!linemanId) return;
            onSubmit(Number(linemanId));
          }}
          loading={loading}
          disabled={!linemanId || loading}
        >
          Assign &amp; update
        </Button>
      </footer>
    </Modal>
  );
}
