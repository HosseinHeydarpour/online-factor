import { store } from "./store.js";

const el = {
  overlay: document.getElementById("login-overlay"),
  form: document.getElementById("login-form"),
  user: document.getElementById("login-user"),
  pass: document.getElementById("login-pass"),
  remember: document.getElementById("login-remember"),
  error: document.getElementById("login-error"),
};

export function showLogin() {
  el.overlay.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  el.pass.value = "";
  el.error.classList.add("hidden");
  setTimeout(() => el.user.focus(), 60);
}

export function hideLogin() {
  el.overlay.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

export function initAuth() {
  // ورود
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!store.login(el.user.value, el.pass.value)) {
      el.error.textContent = "❌ نام کاربری یا رمز عبور اشتباه است!";
      el.error.classList.remove("hidden");
      el.pass.value = "";
      el.pass.focus();
      return;
    }
    store.setSession(el.remember.checked);
    hideLogin();
  });

  // خروج
  document.getElementById("btn-logout").addEventListener("click", () => {
    if (!confirm("از حساب مدیر خارج می‌شوید؟")) return;
    store.logout();
    showLogin();
  });

  // وضعیت اولیه: اگر نشست نبود، لاگین را نشان بده
  if (!store.isLoggedIn()) showLogin();
  else hideLogin();
}
