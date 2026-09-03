// ============================================================
// API SERVICE — port native dari src/services/api.ts (webview). Backend
// Node/Express SAMA PERSIS, tidak ada perubahan endpoint sama sekali -
// cuma cara nyimpen sesi & cara broadcast "session expired" yang beda
// (AsyncStorage + DeviceEventEmitter, bukan localStorage + window event).
// ============================================================
import { DeviceEventEmitter } from "react-native";
import Constants from "expo-constants";
import {
  saveSession, addLinkedAccount, getActiveToken, logout,
  type RoleName, type SavedAccount,
} from "./authService";

export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://alikhlas86.duckdns.org/mobile-api";

export const SESSION_EXPIRED_EVENT = "session-expired";

export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Ambil dari "/uploads/" dan seterusnya, lepas dari apapun di depannya -
  // SEBELUMNYA cuma buang protokol+host, tidak cukup krn API_URL di sini
  // SENDIRI sudah punya subpath ("/mobile-api") - URL yang sudah tersimpan
  // absolut (AsyncStorage) otomatis bawa subpath itu juga, strip host doang
  // menyisakan "/mobile-api/uploads/..." lalu ditempel API_URL LAGI di
  // depannya = "/mobile-api/mobile-api/uploads/..." (double prefix, 404).
  const match = url.match(/\/uploads\/.*$/);
  const path = match ? match[0] : url;
  return `${API_URL}${path}`;
}

export const ROLE_MAP: Record<string, RoleName> = {
  admin_it: "Admin IT",
  supervisor: "Supervisor",
  admin_tu_sd: "Admin TU (SD)",
  admin_media_sd: "Admin Media (SD)",
  admin_tu_tk: "Admin TU (TK & Playground)",
  admin_media_tk: "Admin Media (TK & Playground)",
  kepala_sekolah_sd: "Kepala Sekolah (SD)",
  kepala_sekolah_tk: "Kepala Sekolah (TK & Playground)",
  keuangan: "Keuangan",
  orang_tua: "Orang Tua",
  guru: "Guru",
  guru_kelas: "Guru Kelas",
  pegawai: "Pegawai",
};

function initials(fullName: string): string {
  return fullName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

interface ServerUser {
  id: number;
  username: string;
  role: string;
  full_name: string;
  avatar_filename?: string | null;
}

function toSavedAccount(user: ServerUser, token: string): SavedAccount {
  const role = ROLE_MAP[user.role] ?? (user.role as RoleName);
  return {
    id: `USR${user.id}`,
    username: user.username,
    role,
    fullName: user.full_name,
    avatarInitials: initials(user.full_name),
    avatarUrl: user.avatar_filename ? `${API_URL}/uploads/avatars/${user.avatar_filename}` : null,
    token,
  };
}

interface LoginResultBody {
  token: string;
  user: ServerUser;
  linkedAccounts?: { token: string; user: ServerUser }[];
}

async function applyLoginResult(body: LoginResultBody): Promise<SavedAccount> {
  const account = toSavedAccount(body.user, body.token);
  await saveSession(account);
  for (const linked of body.linkedAccounts ?? []) {
    await addLinkedAccount(toSavedAccount(linked.user, linked.token));
  }
  return account;
}

export async function apiLogin(
  username: string,
  password: string
): Promise<{ success: boolean; account?: SavedAccount; error?: string; needsPasswordSetup?: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.message ?? "Login gagal.", needsPasswordSetup: body.needsPasswordSetup };
    }
    const account = await applyLoginResult(body);
    return { success: true, account };
  } catch {
    return { success: false, error: "Tidak dapat menghubungi server. Cek koneksi internet Anda." };
  }
}

export async function requestOtp(
  phone: string
): Promise<{ success: boolean; error?: string; purpose?: "set_password" | "reset_password"; waitSeconds?: number }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      return { success: false, error: body.message ?? "Gagal mengirim kode OTP.", waitSeconds: body.wait_seconds };
    }
    return { success: true, purpose: body.purpose };
  } catch {
    return { success: false, error: "Tidak dapat menghubungi server. Cek koneksi internet Anda." };
  }
}

export async function verifyOtp(
  phone: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; account?: SavedAccount; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, new_password: newPassword }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) return { success: false, error: body.message ?? "Verifikasi OTP gagal." };
    const account = await applyLoginResult(body);
    return { success: true, account };
  } catch {
    return { success: false, error: "Tidak dapat menghubungi server. Cek koneksi internet Anda." };
  }
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = getActiveToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: token ? `Bearer ${token}` : "", "Content-Type": "application/json" },
  });
  if (res.status === 401 && token && getActiveToken() === token) {
    await logout();
    DeviceEventEmitter.emit(SESSION_EXPIRED_EVENT);
  }
  return res.json();
}

async function authedUpload(path: string, formData: FormData, method: string = "POST") {
  const token = getActiveToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: token ? `Bearer ${token}` : "" },
    body: formData,
  });
  if (res.status === 401 && token && getActiveToken() === token) {
    await logout();
    DeviceEventEmitter.emit(SESSION_EXPIRED_EVENT);
  }
  return res.json();
}

// Utk upload dari expo-image-picker (uri lokal), bukan File Web API.
export function fileFromUri(uri: string, name: string, mimeType: string) {
  return { uri, name, type: mimeType } as unknown as Blob;
}

export const api = {
  me: () => authedFetch("/api/auth/me"),
  uploadAvatar: (uri: string, mimeType: string) => {
    const form = new FormData();
    form.append("file", fileFromUri(uri, "avatar.jpg", mimeType));
    return authedUpload("/api/auth/avatar", form);
  },
  deleteAvatar: () => authedFetch("/api/auth/avatar", { method: "DELETE" }),
  myChildren: () => authedFetch("/api/students/my-children"),
  students: () => authedFetch("/api/students"),
  employees: () => authedFetch("/api/employees"),
  psbList: (status?: "menunggu" | "diterima" | "ditolak" | "semua") => authedFetch(`/api/psb${status ? `?status=${status}` : ""}`),
  psbKelas: () => authedFetch("/api/psb/kelas"),
  psbKeputusan: (hubId: number, body: { keputusan: "terima" | "tolak"; nis?: string; kelasSourceId?: number; catatan?: string }) =>
    authedFetch(`/api/psb/${hubId}/keputusan`, { method: "POST", body: JSON.stringify(body) }),
  notifications: () => authedFetch("/api/notifications"),
  notificationsUnreadCount: () => authedFetch("/api/notifications/unread-count"),
  registerFcmToken: (token: string) => authedFetch("/api/auth/fcm-token", { method: "POST", body: JSON.stringify({ token }) }),
  markNotificationRead: (id: number) => authedFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
  deleteNotification: (id: number) => authedFetch(`/api/notifications/${id}`, { method: "DELETE" }),
  notificationPreferences: () => authedFetch("/api/notifications/preferences"),
  updateNotificationPreferences: (prefs: Partial<Record<"notif_komentar" | "notif_like" | "notif_presensi" | "notif_bayaran" | "notif_tagihan", boolean>>) =>
    authedFetch("/api/notifications/preferences", { method: "PUT", body: JSON.stringify(prefs) }),
  attendanceMyChildren: () => authedFetch("/api/attendance/my-children"),
  attendanceMe: () => authedFetch("/api/attendance/me"),
  attendanceAll: (entityType: "siswa" | "guru" | "karyawan", date: string) =>
    authedFetch(`/api/attendance/all?entity_type=${entityType}&date=${date}`),
  attendanceStatistikMe: () => authedFetch("/api/attendance/statistik/me"),
  attendanceStatistikAnak: (studentCacheId: number) => authedFetch(`/api/attendance/statistik/anak/${studentCacheId}`),
  scheduleMe: (semester?: "ganjil" | "genap") => authedFetch(`/api/schedule/me${semester ? `?semester=${semester}` : ""}`),
  scheduleAnak: (studentCacheId: number, semester?: "ganjil" | "genap") =>
    authedFetch(`/api/schedule/anak/${studentCacheId}${semester ? `?semester=${semester}` : ""}`),
  scheduleKalender: (from?: string, to?: string) =>
    authedFetch(`/api/schedule/kalender${from && to ? `?from=${from}&to=${to}` : ""}`),
  attendanceCheckin: (type: "masuk" | "pulang", lat: number, lng: number, accuracy?: number, isMocked?: boolean, locationTimestamp?: number) =>
    authedFetch("/api/attendance/checkin", {
      method: "POST",
      body: JSON.stringify({ type, lat, lng, accuracy, is_mocked: isMocked ?? false, location_timestamp: locationTimestamp }),
    }),
  attendanceClasses: () => authedFetch("/api/attendance/classes"),
  attendanceAllFiltered: (entityType: "siswa" | "guru" | "karyawan", date: string, tingkat?: string, kelas?: string) => {
    const params = new URLSearchParams({ entity_type: entityType, date });
    if (tingkat && kelas) { params.set("tingkat", tingkat); params.set("kelas", kelas); }
    return authedFetch(`/api/attendance/all?${params.toString()}`);
  },
  attendanceMonthlyMatrix: (scope: "kelas" | "pegawai", opts: { tingkat?: string; kelas?: string; bulan: number; tahun: number }) => {
    const params = new URLSearchParams({ scope, bulan: String(opts.bulan), tahun: String(opts.tahun) });
    if (opts.tingkat) params.set("tingkat", opts.tingkat);
    if (opts.kelas) params.set("kelas", opts.kelas);
    return authedFetch(`/api/attendance/monthly-matrix?${params.toString()}`);
  },
  attendanceMonthlyMatrixDownloadLink: (scope: "kelas" | "pegawai", opts: { tingkat?: string; kelas?: string; bulan: number; tahun: number }) => {
    const params = new URLSearchParams({ scope, bulan: String(opts.bulan), tahun: String(opts.tahun) });
    if (opts.tingkat) params.set("tingkat", opts.tingkat);
    if (opts.kelas) params.set("kelas", opts.kelas);
    return authedFetch(`/api/attendance/monthly-matrix/download-link?${params.toString()}`);
  },
  // Izin/Sakit - lihat routes/leave.js (Node) & LeaveRequestController (Absen)
  leaveSubmit: (data: { tanggal: string; jenis: "sakit" | "izin"; keterangan?: string; studentCacheId?: number; buktiFotoUri?: string; buktiFotoMime?: string }) => {
    const form = new FormData();
    form.append("tanggal", data.tanggal);
    form.append("jenis", data.jenis);
    if (data.keterangan) form.append("keterangan", data.keterangan);
    if (data.studentCacheId != null) form.append("studentCacheId", String(data.studentCacheId));
    if (data.buktiFotoUri) {
      form.append("bukti_foto", fileFromUri(data.buktiFotoUri, `bukti.${(data.buktiFotoMime ?? "image/jpeg").split("/")[1] ?? "jpg"}`, data.buktiFotoMime ?? "image/jpeg"));
    }
    return authedUpload("/api/leave/submit", form);
  },
  leavePending: () => authedFetch("/api/leave/pending"),
  leaveApprove: (id: number) => authedFetch(`/api/leave/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  leaveReject: (id: number, reason?: string) => authedFetch(`/api/leave/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  // Persetujuan izin GURU oleh Kepala Sekolah (2026-08-31) - lihat webview.
  leavePendingGuru: () => authedFetch("/api/leave/pending-guru"),
  leaveApproveGuru: (id: number) => authedFetch(`/api/leave/${id}/approve-guru`, { method: "POST", body: JSON.stringify({}) }),
  leaveRejectGuru: (id: number, reason?: string) => authedFetch(`/api/leave/${id}/reject-guru`, { method: "POST", body: JSON.stringify({ reason }) }),

  // Pengaturan lokasi+radius geofence presensi (Admin IT).
  attendanceLocations: () => authedFetch("/api/attendance-locations"),
  attendanceLocationCreate: (data: { nama: string; lat: number; lng: number; radius_meter: number }) =>
    authedFetch("/api/attendance-locations", { method: "POST", body: JSON.stringify(data) }),
  attendanceLocationUpdate: (id: number, data: Partial<{ nama: string; lat: number; lng: number; radius_meter: number; is_active: boolean }>) =>
    authedFetch(`/api/attendance-locations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  attendanceLocationDelete: (id: number) => authedFetch(`/api/attendance-locations/${id}`, { method: "DELETE" }),

  // Pengaturan jam keterlambatan (Admin IT) - menggantikan SettingsController
  // Absen, lihat routes/attendanceSettings.js & services/attendanceStatus.js (Node).
  lateCutoffGet: () => authedFetch("/api/attendance-settings/late-cutoff"),
  lateCutoffUpdate: (data: Partial<{ late_cutoff_siswa: string; late_cutoff_staff: string; late_cutoff_tk_playground: string }>) =>
    authedFetch("/api/attendance-settings/late-cutoff", { method: "PUT", body: JSON.stringify(data) }),

  // Statistik Ringkasan (fitur baru, lihat routes/ringkasan.js Node)
  ringkasanUnits: () => authedFetch("/api/ringkasan/units"),
  ringkasan: (params: { unitId?: number; year: number; month: number }) => {
    const qs = new URLSearchParams();
    if (params.unitId) qs.set("unitId", String(params.unitId));
    qs.set("year", String(params.year));
    qs.set("month", String(params.month));
    return authedFetch(`/api/ringkasan?${qs.toString()}`);
  },

  // Performa Individu - cari orang lain (fitur baru, lihat routes/performa.js)
  performaCari: (params: { identifier: string; year: number; month: number }) => {
    const qs = new URLSearchParams({ identifier: params.identifier, year: String(params.year), month: String(params.month) });
    return authedFetch(`/api/performa/cari?${qs.toString()}`);
  },

  // Tugas & Materi Pembelajaran - lihat routes/tugas.js (Node)
  tugasKelasOptions: () => authedFetch("/api/tugas/kelas-options"),
  tugasCreate: (data: { kelasId: number; jenis: "tugas" | "materi"; judul: string; deskripsi?: string; tanggal: string; deadline?: string; deadlineJam?: string; kunciOtomatis?: boolean }) =>
    authedFetch("/api/tugas/create", { method: "POST", body: JSON.stringify(data) }),
  // Buka/tutup pengumpulan (2026-09-03). `dibukaManual` MENGALAHKAN kunci
  // otomatis - dipakai guru utk membuka kembali tugas yg sudah lewat tenggat.
  tugasSetKunci: (id: number, body: { kunciOtomatis?: boolean; dibukaManual?: boolean }) =>
    authedFetch(`/api/tugas/${id}/kunci`, { method: "PATCH", body: JSON.stringify(body) }),
  tugasBeriNilai: (id: number, body: { studentCacheId: number; nilai?: string; catatan?: string }) =>
    authedFetch(`/api/tugas/${id}/nilai`, { method: "POST", body: JSON.stringify(body) }),
  tugasMine: () => authedFetch("/api/tugas/mine"),
  tugasRekap: (id: number) => authedFetch(`/api/tugas/${id}/rekap`),
  tugasDelete: (id: number) => authedFetch(`/api/tugas/${id}`, { method: "DELETE" }),
  tugasAnak: (studentCacheId: number) => authedFetch(`/api/tugas/anak?studentCacheId=${studentCacheId}`),
  tugasTandaiSelesai: (id: number, studentCacheId: number) =>
    authedFetch(`/api/tugas/${id}/tandai-selesai`, { method: "POST", body: JSON.stringify({ studentCacheId }) }),

  // Aduan - lihat routes/aduan.js (Node)
  aduanSubmit: (data: { studentCacheId: number; kategori: "wali_kelas" | "admin_it" | "keuangan" | "tu"; isi: string; buktiFotoUri?: string; buktiFotoMime?: string }) => {
    const form = new FormData();
    form.append("studentCacheId", String(data.studentCacheId));
    form.append("kategori", data.kategori);
    form.append("isi", data.isi);
    if (data.buktiFotoUri) {
      form.append("bukti_foto", fileFromUri(data.buktiFotoUri, `bukti.${(data.buktiFotoMime ?? "image/jpeg").split("/")[1] ?? "jpg"}`, data.buktiFotoMime ?? "image/jpeg"));
    }
    return authedUpload("/api/aduan/submit", form);
  },
  aduanMine: () => authedFetch("/api/aduan/mine"),
  aduanInbox: () => authedFetch("/api/aduan/inbox"),
  aduanMarkRead: (id: number) => authedFetch(`/api/aduan/${id}/read`, { method: "PATCH" }),
  aduanMarkResolved: (id: number) => authedFetch(`/api/aduan/${id}/resolve`, { method: "PATCH" }),
  faceStatus: () => authedFetch("/api/face/status"),
  faceAnalyze: (imageBase64: string) => authedFetch("/api/face/analyze", { method: "POST", body: JSON.stringify({ image_base64: imageBase64 }) }),
  faceEnrollSample: (angle: string, sampleIndex: number, imageBase64: string) =>
    authedFetch("/api/face/enroll-sample", { method: "POST", body: JSON.stringify({ angle, sample_index: sampleIndex, image_base64: imageBase64 }) }),
  faceChildStatus: (studentCacheId?: number) => authedFetch(`/api/face/child/status${studentCacheId ? `?studentCacheId=${studentCacheId}` : ""}`),
  faceChildEnrollSample: (angle: string, sampleIndex: number, imageBase64: string, studentCacheId?: number) =>
    authedFetch("/api/face/child/enroll-sample", { method: "POST", body: JSON.stringify({ angle, sample_index: sampleIndex, image_base64: imageBase64, studentCacheId }) }),
  stats: () => authedFetch("/api/stats"),
  adminUsers: () => authedFetch("/api/admin/users"),
  adminCreateUser: (data: { username: string; password: string; full_name: string; role: string; phone?: string }) =>
    authedFetch("/api/admin/users", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateUser: (id: number, data: { role?: string; full_name?: string; phone?: string }) =>
    authedFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminDeleteUser: (id: number) => authedFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
  adminAccountLinkReviews: () => authedFetch("/api/admin/account-link-reviews"),
  adminLinkAccountReview: (id: number) => authedFetch(`/api/admin/account-link-reviews/${id}/link`, { method: "POST" }),
  adminRejectAccountReview: (id: number, note?: string) =>
    authedFetch(`/api/admin/account-link-reviews/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  changePassword: (data: { old_password: string; new_password: string }) =>
    authedFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
  updateFullName: (fullName: string) =>
    authedFetch("/api/auth/full-name", { method: "POST", body: JSON.stringify({ full_name: fullName }) }),
  adminWaStatus: () => authedFetch("/api/admin/wa-status"),
  adminWaQr: () => authedFetch("/api/admin/wa-qr"),
  adminWaDisconnect: () => authedFetch("/api/admin/wa-disconnect", { method: "POST" }),
  adminWaRegenerateQr: () => authedFetch("/api/admin/wa-regenerate-qr", { method: "POST" }),
  adminGetAlertPhone: () => authedFetch("/api/admin/alert-phone"),
  adminSetAlertPhone: (phone: string) => authedFetch("/api/admin/alert-phone", { method: "PUT", body: JSON.stringify({ phone }) }),
  adminSyncStatus: () => authedFetch("/api/admin/sync-status"),
  adminActivityLogs: (page = 1) => authedFetch(`/api/admin/activity-logs?page=${page}`),
  adminCreateAnnouncement: (data: { title: string; message: string; target_role: string }) =>
    authedFetch("/api/admin/announcements", { method: "POST", body: JSON.stringify(data) }),
  backupStatus: () => authedFetch("/api/admin/backup/status"),

  beritaAcaraList: () => authedFetch("/api/berita-acara"),
  beritaAcaraDetail: (id: number) => authedFetch(`/api/berita-acara/${id}`),
  beritaAcaraCreate: (data: { title: string; category?: string; description?: string; author_name?: string; activity_date?: string; unit_scope?: string }) =>
    authedFetch("/api/berita-acara", { method: "POST", body: JSON.stringify(data) }),
  beritaAcaraUpdate: (id: number, data: { title?: string; category?: string; description?: string; author_name?: string; activity_date?: string; unit_scope?: string }) =>
    authedFetch(`/api/berita-acara/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  beritaAcaraPublish: (id: number) => authedFetch(`/api/berita-acara/${id}/publish`, { method: "POST" }),
  beritaAcaraDelete: (id: number) => authedFetch(`/api/berita-acara/${id}`, { method: "DELETE" }),
  beritaAcaraUploadMedia: (id: number, uri: string, mimeType: string, type: "thumbnail" | "activity") => {
    const form = new FormData();
    form.append("file", fileFromUri(uri, `media.${mimeType.split("/")[1] ?? "jpg"}`, mimeType));
    form.append("type", type);
    return authedUpload(`/api/berita-acara/${id}/media`, form);
  },
  beritaAcaraDeleteMedia: (id: number, mediaId: number) => authedFetch(`/api/berita-acara/${id}/media/${mediaId}`, { method: "DELETE" }),
  beritaAcaraAddLink: (id: number, url: string) => authedFetch(`/api/berita-acara/${id}/links`, { method: "POST", body: JSON.stringify({ url }) }),
  beritaAcaraDeleteLink: (id: number, linkId: number) => authedFetch(`/api/berita-acara/${id}/links/${linkId}`, { method: "DELETE" }),
  beritaAcaraToggleLike: (id: number) => authedFetch(`/api/berita-acara/${id}/like`, { method: "POST" }),
  beritaAcaraComments: (id: number) => authedFetch(`/api/berita-acara/${id}/comments`),
  beritaAcaraAddComment: (id: number, comment: string, parentCommentId?: number) =>
    authedFetch(`/api/berita-acara/${id}/comments`, { method: "POST", body: JSON.stringify({ comment, parent_comment_id: parentCommentId }) }),
  beritaAcaraDeleteComment: (id: number, commentId: number) => authedFetch(`/api/berita-acara/${id}/comments/${commentId}`, { method: "DELETE" }),
  beritaAcaraEditComment: (id: number, commentId: number, comment: string) =>
    authedFetch(`/api/berita-acara/${id}/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ comment }) }),
  beritaAcaraToggleCommentLike: (id: number, commentId: number) =>
    authedFetch(`/api/berita-acara/${id}/comments/${commentId}/like`, { method: "POST" }),
  beritaAcaraBlockCommenter: (id: number, commentId: number) => authedFetch(`/api/berita-acara/${id}/comments/${commentId}/block`, { method: "POST" }),
  beritaAcaraBlockedCommenters: () => authedFetch("/api/berita-acara/blocked-commenters"),
  beritaAcaraUnblockCommenter: (userId: number) => authedFetch(`/api/berita-acara/blocked-commenters/${userId}`, { method: "DELETE" }),
  beritaAcaraStats: () => authedFetch("/api/berita-acara/stats"),
};
