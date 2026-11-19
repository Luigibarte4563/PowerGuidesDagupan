import { apiRequest, pickList, uploadWithProgress } from './client';

/**
 * Electrical hazards.
 *
 * Confirmed contract (`api/electrical_hazard/*`):
 *   create.php          POST { location_name*, severity?, hazard_type?, latitude?, longitude?,
 *                              description?, barangay_name?, image_url? }
 *                         -> { success, message, hazard_id }
 *                         `severity` enum: low | moderate | high | critical
 *                         `hazard_type` is resolved by hazard_types.hazard_name
 *                         (defaults to "none"; unknown values return 400).
 *   update.php          POST { id*, location_name?, severity?, hazard_type?, description?,
 *                              barangay_name?, latitude?, longitude? } (owner-only)
 *                         -> { success, message }
 *   get.php             ?status=&severity=&barangay= -> data rows:
 *                         { id, reported_by, location_name, latitude, longitude, description,
 *                           severity, status, image_proof, reported_at, resolved_at,
 *                           barangay_name, hazard_type }
 *   upload_image.php    multipart: field `image` + `hazard_id`, max 5 MB
  *                         -> { success, image_url }; attaches it as `image_proof`
  *   update_status.php   POST { status*, hazard_id* } (owner-only)
 *                         `status` enum: reported | verified | resolved
 */
export const HAZARD_SEVERITIES = ['low', 'moderate', 'high', 'critical'];
export const HAZARD_STATUSES = ['reported', 'verified', 'resolved'];

export const hazardsApi = {
  async create(data, { signal } = {}) {
    return apiRequest('/api/electrical_hazard/create.php', { method: 'POST', body: data, signal });
  },

  /** Owner-only full update of hazard details. */
  async update({ id, ...data }, { signal } = {}) {
    return apiRequest('/api/electrical_hazard/update.php', {
      method: 'POST',
      body: { id, ...data },
      signal,
    });
  },

  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/electrical_hazard/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /** Owner-only. Stores the photo and attaches it to the report. */
  uploadImage(file, { onProgress, signal, hazardId } = {}) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('hazard_id', String(hazardId));
    return uploadWithProgress('/api/electrical_hazard/upload_image.php', formData, { onProgress, signal });
  },

  /** Owner-only. */
  async updateStatus({ hazard_id: hazardId, status }, { signal } = {}) {
    return apiRequest('/api/electrical_hazard/update_status.php', {
      method: 'POST',
      body: { hazard_id: hazardId, status },
      signal,
    });
  },
};
