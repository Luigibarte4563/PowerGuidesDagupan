import { apiRequest, pickList, uploadWithProgress } from './client';

/**
 * Flood reports.
 *
 * Confirmed contract (`api/flood_report/*`):
 *   create.php     POST { location_name*, flood_level?, latitude?, longitude?, description?,
 *                         barangay_name?, flood_depth_cm?, image_url? }
 *                    -> { success, message, flood_report_id }
 *                    `flood_level` enum: low | moderate | high | severe.
 *                    When latitude+longitude are both numeric they are used as-is, otherwise
 *                    `location_name` is geocoded.
 *   get.php        ?status=&flood_level=&barangay= -> data rows:
 *                    { id, reported_by, location_name, latitude, longitude, flood_depth_cm,
 *                      flood_level, description, image_proof, status, reported_at, updated_at,
 *                      barangay_name }
 *   upload_image.php multipart: field `image` + `flood_report_id`, max 5 MB
  *                    -> { success, image_url }; attaches it as `image_proof`
  *   get_nearby.php ?lat=&lng=&radius= (radius in metres, server default 3000)
 *                    -> data rows as above plus `distance` (metres)
 */
export const FLOOD_LEVELS = ['low', 'moderate', 'high', 'severe'];

/** flood_reports.status enum. */
export const FLOOD_STATUSES = ['reported', 'verified', 'cleared'];

export const floodsApi = {
  async create(data, { signal } = {}) {
    return apiRequest('/api/flood_report/create.php', { method: 'POST', body: data, signal });
  },

  async list(params, { signal } = {}) {
    const payload = await apiRequest('/api/flood_report/get.php', { params, signal });
    return { items: pickList(payload), count: payload?.count ?? null, raw: payload };
  },

  /** Owner-only. Stores the photo and attaches it to the report. */
  uploadImage(file, { onProgress, signal, floodReportId } = {}) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('flood_report_id', String(floodReportId));
    return uploadWithProgress('/api/flood_report/upload_image.php', formData, { onProgress, signal });
  },

  async getNearby({ lat, lng, radius, ...params } = {}, { signal } = {}) {
    const payload = await apiRequest('/api/flood_report/get_nearby.php', {
      params: { lat, lng, radius, ...params },
      signal,
    });
    return { items: pickList(payload), count: payload?.count ?? null, radius: payload?.radius ?? radius, raw: payload };
  },

  /** Staff-only: change any flood report's status. */
  async updateStatus(data, { signal } = {}) {
    return apiRequest('/api/flood_report/update_status.php', { method: 'POST', body: data, signal });
  },

  /** Owner-only. */
  async update(data, { signal } = {}) {
    return apiRequest('/api/flood_report/update.php', { method: 'POST', body: data, signal });
  },

  /** Owner-only. */
  async remove(id, { signal } = {}) {
    return apiRequest('/api/flood_report/delete.php', { method: 'POST', body: { id }, signal });
  },
};
