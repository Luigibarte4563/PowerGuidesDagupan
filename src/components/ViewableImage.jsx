import { useState } from 'react';
import { X } from 'lucide-react';
import Modal from './ui/Modal';
import { resolveImageUrl } from '@/utils/records';

/** Thumbnail that opens the full image in its own modal. */
export default function ViewableImage({
  src,
  alt = 'Report photo',
  className = 'h-32 w-full bg-navy-50 object-cover',
  frameClassName = 'mt-3 block w-full',
}) {
  const [open, setOpen] = useState(false);
  const url = resolveImageUrl(src);

  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${alt}`}
        className={`${frameClassName} overflow-hidden rounded-control border border-navy-100 transition hover:border-primary-300`}
      >
        <img src={url} alt={alt} loading="lazy" className={className} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} bare>
        <div className="flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close image"
            className="absolute right-4 top-4 z-10 rounded-full bg-navy-900/80 p-2 text-white transition hover:bg-navy-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <img src={url} alt={alt} className="max-h-[85vh] max-w-full rounded-lg object-contain" />
        </div>
      </Modal>
    </>
  );
}
