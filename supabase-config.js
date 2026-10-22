// =====================================================================
// supabase-config.js
// 1) Menghubungkan frontend BestWash ke project Supabase
// 2) Berisi fungsi bantu auth (BestWashAuth) yang dipakai halaman lain
//
// URUTAN MEMUAT SCRIPT (wajib):
//   CDN supabase-js  ->  supabase-config.js  ->  auth.js / guard.js / landing.js
// =====================================================================

// ---- ISI DUA BARIS INI dari Supabase: Project Settings -> API ----
const SUPABASE_URL = "sb_secret_u4rdc6tZoBoUPr9OAeJzsw_G6VxJ_V7";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impua21hYW93cmp4ZmVwZGthZGZpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjYyNzgzOSwiZXhwIjoyMTA4MjAzODM5fQ.3JTN60-fwyRC1C3tMDFM86NIgRD6hT6tM5mrM-XnEvs";
// Kunci anon/publishable AMAN ditaruh di frontend (keamanan data dijaga RLS).
// JANGAN PERNAH menaruh kunci "service_role" di sini.

// Penanda: apakah dua baris di atas sudah diisi?
const SUPABASE_READY =
  !SUPABASE_URL.includes("GANTI") && !SUPABASE_ANON_KEY.includes("GANTI");

if (!SUPABASE_READY) {
  console.error(
    "[BestWash] Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di supabase-config.js",
  );
}

// PENTING: jangan beri nama variabel "supabase" -> bentrok dengan library CDN.
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// Kunci localStorage ini SAMA dengan yang sudah dipakai dashboard.html & admin.html,
// jadi kedua halaman itu tetap berjalan tanpa perlu diubah banyak.
const LS_USER = "bestwash_user";
const LS_ROLE = "bestwash_role";

const BestWashAuth = {
  loggingOut: false,

  // Ambil parameter ?next=... dari URL, tapi hanya terima nama file .html lokal
  // (mencegah user dialihkan ke website lain). Aturannya sama dengan nextPage() di dashboard.
  safeNext(raw = new URLSearchParams(location.search).get("next")) {
    if (!raw || !/^[\w-]+\.html(\?[\w=&%.+-]*)?$/.test(raw)) return null;
    if (/^admin/i.test(raw)) return null; // user biasa tidak boleh diarahkan ke admin
    return raw;
  },

  // Sesi login Supabase saat ini (null jika belum login)
  async getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  },

  isAdminLocal() {
    try {
      return localStorage.getItem(LS_ROLE) === "admin";
    } catch (e) {
      return false;
    }
  },

  setLocal(name, role) {
    try {
      localStorage.setItem(LS_USER, name);
      localStorage.setItem(LS_ROLE, role);
    } catch (e) {}
  },

  clearLocal() {
    try {
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_ROLE);
    } catch (e) {}
  },

  // Salin username dari Supabase ke localStorage agar dashboard.html bisa membacanya
  async syncLocalUser(session) {
    session = session || (await this.getSession());
    if (!session) return null;
    const user = session.user;

    let username = null;
    try {
      const { data } = await supabaseClient
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      username = data && data.username;
    } catch (e) {}

    username =
      username ||
      (user.user_metadata && user.user_metadata.username) ||
      (user.email || "user").split("@")[0];

    this.setLocal(username, "user");
    return username;
  },

  // Keluar: hapus data lokal + akhiri sesi Supabase, lalu ke landing page
  async logout() {
    this.loggingOut = true;
    this.clearLocal();
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {}
    location.href = "landing_page.html";
  },
};
