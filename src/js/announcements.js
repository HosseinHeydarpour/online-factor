import { store, faNum, toJalali, nowTimeFa } from "./store.js";
import { syncAllStorages } from "./github.js";

let quillInstance = null;
let editingAnnId = null;
let isInitialized = false;

const el = {
  list: null,
  empty: null,
  search: null,
  modal: null,
  titleModal: null,
  form: null,
  titleInput: null,
  categorySelect: null,
  summaryInput: null,
  pinInput: null,
  btnSubmit: null,
  btnClose: null,
  btnCancel: null,
};

function queryElements() {
  el.list = document.getElementById("announcements-list");
  el.empty = document.getElementById("announcements-empty");
  el.search = document.getElementById("announcement-search");
  el.modal = document.getElementById("announcement-modal");
  el.titleModal = document.getElementById("ann-modal-title");
  el.form = document.getElementById("announcement-form");
  el.titleInput = document.getElementById("ann-title");
  el.categorySelect = document.getElementById("ann-category");
  el.summaryInput = document.getElementById("ann-summary");
  el.pinInput = document.getElementById("ann-pin");
  el.btnSubmit = document.getElementById("btn-save-announcement");
  el.btnClose = document.getElementById("btn-close-ann-modal");
  el.btnCancel = document.getElementById("btn-cancel-ann-modal");
}

function toast(msg, isError = false) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `fixed bottom-24 lg:bottom-5 right-4 lg:right-5 z-[80] text-white text-xs px-4 py-2.5 rounded-xl shadow-lg fade-in ${
    isError ? "bg-rose-600" : "bg-slate-800"
  }`;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initQuillEditor() {
  if (quillInstance || !window.Quill) return;

  const container = document.getElementById("ann-editor-container");
  if (!container) return;

  quillInstance = new window.Quill(container, {
    theme: "snow",
    placeholder: "متن کامل، شرایط، مراحل یا لینک‌های خبر را اینجا بنویسید…",
    modules: {
      toolbar: [
        [{ header: [false, 1, 2, 3] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link", "blockquote", "clean"],
      ],
    },
  });

  if (quillInstance.root) {
    quillInstance.root.setAttribute("dir", "rtl");
    quillInstance.format("direction", "rtl");
    quillInstance.format("align", "right");
  }
}

export function renderAnnouncements(filter = "") {
  queryElements();
  if (!el.list) return;

  const query = (filter || "").trim().toLowerCase();
  let list = store.getAnnouncements();

  if (query) {
    list = list.filter(
      (a) =>
        (a.title || "").toLowerCase().includes(query) ||
        (a.summary || "").toLowerCase().includes(query) ||
        (a.category || "").toLowerCase().includes(query),
    );
  }

  el.empty?.classList.toggle("hidden", list.length > 0);

  if (!list.length) {
    el.list.innerHTML = "";
    return;
  }

  el.list.innerHTML = list
    .map(
      (ann) => `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border ${
      ann.pin
        ? "border-amber-400 dark:border-amber-500/80 shadow-md ring-1 ring-amber-400/30"
        : "border-slate-200 dark:border-slate-700 shadow-sm"
    } p-4 transition fade-in space-y-2.5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            ${
              ann.pin
                ? `<span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                     📌 سنجاق‌شده
                   </span>`
                : ""
            }
            <span class="bg-brand-50 dark:bg-slate-700 text-brand-700 dark:text-brand-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-brand-100 dark:border-slate-600">
              ${escapeHtml(ann.category || "عمومی")}
            </span>
            <span class="text-[10px] text-slate-400 font-mono">
              🕒 ${escapeHtml(ann.date || "")} ساعت ${escapeHtml(ann.time || "")}
            </span>
          </div>
          <h3 class="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-6">
            ${escapeHtml(ann.title)}
          </h3>
          ${
            ann.summary
              ? `<p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-5">${escapeHtml(ann.summary)}</p>`
              : ""
          }
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button data-ann-pin="${ann.id}" type="button" title="${ann.pin ? "برداشتن سنجاق" : "سنجاق در صدر"}"
            class="p-2 rounded-xl text-xs font-bold transition ${
              ann.pin
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200"
            }">
            📌
          </button>
          <button data-ann-edit="${ann.id}" type="button" title="ویرایش خبر"
            class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition">
            ✏️
          </button>
          <button data-ann-del="${ann.id}" type="button" title="حذف خبر"
            class="bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-xl text-xs font-bold transition">
            🗑️
          </button>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

export function openAnnouncementModal(ann = null) {
  queryElements();
  initQuillEditor();

  editingAnnId = ann?.id || null;
  if (el.titleModal) {
    el.titleModal.textContent = ann ? "✏️ ویرایش اعلان" : "📢 ایجاد اعلان جدید";
  }
  if (el.titleInput) el.titleInput.value = ann?.title || "";
  if (el.categorySelect) el.categorySelect.value = ann?.category || "عمومی";
  if (el.summaryInput) el.summaryInput.value = ann?.summary || "";
  if (el.pinInput) el.pinInput.checked = Boolean(ann?.pin);

  if (quillInstance) {
    quillInstance.root.innerHTML = ann?.content || "";
  }

  el.modal?.classList.remove("hidden");
  setTimeout(() => el.titleInput?.focus(), 60);
}

export function closeAnnouncementModal() {
  queryElements();
  el.modal?.classList.add("hidden");
  editingAnnId = null;
  if (quillInstance) quillInstance.root.innerHTML = "";
  if (el.btnSubmit) {
    el.btnSubmit.disabled = false;
    el.btnSubmit.innerHTML = "💾 انتشار و ذخیره اعلان";
  }
}

export function initAnnouncements() {
  queryElements();

  if (isInitialized) {
    renderAnnouncements(el.search?.value || "");
    return;
  }
  isInitialized = true;

  document
    .getElementById("btn-add-announcement")
    ?.addEventListener("click", () => openAnnouncementModal());

  el.btnClose?.addEventListener("click", closeAnnouncementModal);
  el.btnCancel?.addEventListener("click", closeAnnouncementModal);

  el.modal?.addEventListener("click", (e) => {
    if (e.target === el.modal) closeAnnouncementModal();
  });

  el.search?.addEventListener("input", () =>
    renderAnnouncements(el.search.value),
  );

  el.form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = el.titleInput?.value.trim() || "";
    if (!title) return alert("عنوان اعلان الزامی است.");

    let contentHtml = "";
    let rawText = "";
    if (quillInstance) {
      contentHtml = quillInstance.root.innerHTML.trim();
      rawText = quillInstance.getText().trim();
      if (contentHtml === "<p><br></p>" || !rawText) {
        contentHtml = "";
      }
    }

    let summary = el.summaryInput?.value.trim() || "";
    if (!summary && rawText) {
      summary = rawText.slice(0, 120) + (rawText.length > 120 ? "..." : "");
    }

    const category = el.categorySelect?.value || "عمومی";
    const pin = Boolean(el.pinInput?.checked);

    if (el.btnSubmit) {
      el.btnSubmit.disabled = true;
      el.btnSubmit.innerHTML = "⏳ در حال ذخیره و همگام‌سازی…";
    }

    try {
      const existing = editingAnnId
        ? store.getAnnouncement(editingAnnId)
        : null;

      store.saveAnnouncement({
        id: editingAnnId,
        title,
        summary,
        content: contentHtml,
        category,
        pin,
        date: existing?.date || toJalali().full,
        time: existing?.time || nowTimeFa(),
      });

      closeAnnouncementModal();
      renderAnnouncements(el.search?.value || "");
      toast(editingAnnId ? "اعلان ویرایش شد ✅" : "اعلان منتشر شد 📢");

      await syncAllStorages({ showToast: true });
    } catch (err) {
      console.error("خطا در ذخیره اعلان:", err);
      toast("❌ خطا در فرآیند ذخیره اعلان", true);
    } finally {
      if (el.btnSubmit) {
        el.btnSubmit.disabled = false;
        el.btnSubmit.innerHTML = "💾 انتشار و ذخیره اعلان";
      }
    }
  });

  el.list?.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-ann-edit]");
    const delBtn = e.target.closest("[data-ann-del]");
    const pinBtn = e.target.closest("[data-ann-pin]");

    if (editBtn) {
      const ann = store.getAnnouncement(editBtn.dataset.annEdit);
      if (ann) openAnnouncementModal(ann);
      return;
    }

    if (delBtn) {
      if (confirm("آیا از حذف این اعلان اطمینان دارید؟")) {
        store.deleteAnnouncement(delBtn.dataset.annDel);
        renderAnnouncements(el.search?.value || "");
        toast("اعلان حذف شد 🗑️");
        await syncAllStorages({ showToast: true });
      }
      return;
    }

    if (pinBtn) {
      const ann = store.getAnnouncement(pinBtn.dataset.annPin);
      if (ann) {
        ann.pin = !ann.pin;
        store.saveAnnouncement(ann);
        renderAnnouncements(el.search?.value || "");
        toast(ann.pin ? "📌 اعلان سنجاق شد" : "📌 سنجاق برداشته شد");
        await syncAllStorages({ showToast: true });
      }
    }
  });

  renderAnnouncements();
}
