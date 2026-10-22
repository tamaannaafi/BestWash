// =====================================================================
// auth.js  ->  dipakai di login.html dan register.html
// =====================================================================

// ⚠️ AKUN ADMIN SEMENTARA (sesuai permintaan: admin / admin123)
// Nilai ini terlihat oleh siapa pun yang membuka "View Source".
// Cukup untuk tugas/demo, JANGAN dipakai untuk aplikasi sungguhan.
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  if (!loginForm && !registerForm) return;

  const $ = (id) => document.getElementById(id);
  const alertBox = $("auth-alert");
  const nextPage = BestWashAuth.safeNext(); // mis. "dashboard.html?paket=reguler"

  // ---------- Fungsi bantu tampilan ----------
  function showAlert(message, type) {
    if (!alertBox) return alert(message);
    alertBox.textContent = message;
    alertBox.className =
      "rounded-xl px-4 py-3 text-sm font-semibold " +
      (type === "success"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-red-100 text-red-700");
  }

  function hideAlert() {
    if (alertBox) alertBox.className = "hidden";
  }

  function setLoading(button, loading) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = loading;
    button.textContent = loading ? "Memproses..." : button.dataset.label;
    button.classList.toggle("opacity-70", loading);
  }

  // Ubah pesan error Supabase (bahasa Inggris) jadi bahasa Indonesia
  function translateError(err) {
    const msg = ((err && err.message) || "").toLowerCase();
    if (msg.includes("invalid login credentials"))
      return "Username/email atau password salah.";
    if (msg.includes("email not confirmed"))
      return "Email belum diverifikasi. Cek inbox/spam emailmu.";
    if (msg.includes("already registered"))
      return "Email sudah terdaftar. Silakan login.";
    if (msg.includes("database error saving new user"))
      return "Username sudah dipakai atau formatnya tidak valid.";
    if (msg.includes("rate limit"))
      return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
    if (msg.includes("failed to fetch"))
      return "Tidak bisa terhubung ke server. Periksa koneksi internetmu.";
    if (msg.includes("get_email_by_username"))
      return "Setup database belum lengkap. Jalankan SQL di Supabase dulu (langkah 4 pada panduan).";
    return "Terjadi kesalahan: " + ((err && err.message) || "silakan coba lagi.");
  }

  // Bawa parameter ?next= saat pindah antara halaman Sign In <-> Sign Up
  if (nextPage) {
    const qs = "?next=" + encodeURIComponent(nextPage);
    const toRegister = document.querySelector('a[href="register.html"]');
    const toLogin = document.querySelector('a[href="login.html"]');
    if (toRegister) toRegister.href = "register.html" + qs;
    if (toLogin) toLogin.href = "login.html" + qs;
  }

  // =====================================================================
  // LOGIN
  // =====================================================================
  if (loginForm) {
    const params = new URLSearchParams(location.search);

    // Pesan setelah user selesai mendaftar
    const registered = params.get("registered");
    if (registered === "confirm") {
      showAlert(
        "Pendaftaran berhasil! Cek emailmu untuk verifikasi, lalu login.",
        "success",
      );
    } else if (registered) {
      showAlert("Pendaftaran berhasil! Silakan login.", "success");
    }

    // Sudah login sebelumnya? Langsung arahkan (kecuali dipaksa ke form login admin)
    if (SUPABASE_READY && !params.get("admin")) {
      BestWashAuth.getSession().then(async (session) => {
        if (!session) return;
        await BestWashAuth.syncLocalUser(session);
        location.replace(nextPage || "dashboard.html");
      });
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();

      const username = $("username").value.trim();
      const password = $("password").value;

      // ---- 1) Cek ADMIN dulu (tidak butuh Supabase sama sekali) ----
      if (
        username.toLowerCase() === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD
      ) {
        if (supabaseClient) supabaseClient.auth.signOut().catch(() => {}); // buang sesi user lain
        BestWashAuth.setLocal("admin", "admin");
        location.href = "admin.html";
        return;
      }

      // ---- 2) User biasa wajib lewat Supabase ----
      if (!SUPABASE_READY) return showAlert(supabaseNotReadyMessage());

      const button = loginForm.querySelector('button[type="submit"]');
      setLoading(button, true);

      try {

        // login lewat Supabase Auth
        // Supabase login memakai email, jadi username diubah dulu jadi email
        // lewat fungsi SQL get_email_by_username (dibuat di langkah 4).
        let email = username;
        if (!username.includes("@")) {
          const { data, error } = await supabaseClient.rpc(
            "get_email_by_username",
            { p_username: username },
          );
          if (error) throw error;
          email = data;
        }
        if (!email) return showAlert("Username/email atau password salah.");

        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        await BestWashAuth.syncLocalUser(data.session);
        location.href = nextPage || "dashboard.html";
      } catch (err) {
        showAlert(translateError(err));
      } finally {
        setLoading(button, false);
      }
    });
  }

  // =====================================================================
  // REGISTER
  // =====================================================================
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert();

      if (!SUPABASE_READY) return showAlert(supabaseNotReadyMessage());

      const username = $("username").value.trim();
      const email = $("email").value.trim();
      const password = $("password").value;
      const noTelp = $("telp").value.replace(/[\s-]/g, "");

      // ---- Validasi sederhana ----
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
        return showAlert(
          "Username 3-20 karakter: hanya huruf, angka, dan underscore (_).",
        );
      if (username.toLowerCase() === ADMIN_USERNAME)
        return showAlert('Username "admin" tidak boleh dipakai.');
      if (password.length < 6)
        return showAlert("Password minimal 6 karakter.");
      if (!/^\+?[0-9]{9,15}$/.test(noTelp))
        return showAlert("Nomor telepon tidak valid (9-15 angka).");

      const button = registerForm.querySelector('button[type="submit"]');
      setLoading(button, true);

      try {
        // Username sudah dipakai orang lain?
        const { data: dipakai, error: errCek } = await supabaseClient.rpc(
          "get_email_by_username",
          { p_username: username },
        );
        if (errCek) throw errCek;
        if (dipakai) return showAlert("Username sudah dipakai, pilih yang lain.");

        // Buat akun. username & no_telp ikut disimpan di "metadata";
        // trigger SQL kemudian menyalinnya ke tabel profiles.
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { username, no_telp: noTelp } },
        });
        if (error) throw error;

        // Email sudah terdaftar (Supabase mengembalikan user "kosong" tanpa error)
        if (data.user && data.user.identities && data.user.identities.length === 0)
          return showAlert("Email sudah terdaftar. Silakan login.");

        // Jika "Confirm email" nonaktif, Supabase langsung membuat sesi.
        // Kita logout dulu supaya user login manual dari halaman Sign In.
        const perluVerifikasi = !data.session;
        if (data.session) await supabaseClient.auth.signOut();

        location.href =
          "login.html?registered=" +
          (perluVerifikasi ? "confirm" : "1") +
          (nextPage ? "&next=" + encodeURIComponent(nextPage) : "");
      } catch (err) {
        showAlert(translateError(err));
      } finally {
        setLoading(button, false);
      }
    });
  }
});
