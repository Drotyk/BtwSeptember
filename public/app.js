/**
 * BTW — Анкети. Клієнтська логіка захищеної сторінки.
 *
 * Файл є ES-модулем. Чисті функції експортуються для тестування.
 * Підключення до DOM і fetch — тільки в init() внизу файлу.
 */

// ─── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Форматує дату у локалізований рядок uk-UA.
 * Для null / undefined / некоректних значень повертає «—».
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
export function formatDate(value) {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Правильна відмінка слова «тренінг» за числом.
 * @param {number} count
 * @returns {string}
 */
export function pluralizeTrainings(count) {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${count} тренінгів`;
  if (mod10 === 1) return `${count} тренінг`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} тренінги`;
  return `${count} тренінгів`;
}

/**
 * Повертає рядок для стовпця «Тренінги» у таблиці.
 * @param {string[] | null | undefined} trainingIds
 * @returns {string}
 */
export function formatTrainingCount(trainingIds) {
  const count = Array.isArray(trainingIds) ? trainingIds.length : 0;
  return count === 0 ? "" : pluralizeTrainings(count);
}

/**
 * Розбирає рядок `trainingDisplay` формату «дата | час | спікер | назва».
 * Перші 3 частини витягуються окремо, решта об'єднується як назва
 * (щоб уникнути обрізання назв, що містять «|»).
 * @param {string} label
 * @returns {{ date: string; time: string; speaker: string; title: string }}
 */
export function parseTrainingLabel(label) {
  const parts = label.split("|");
  const date = (parts[0] ?? "").trim();
  const time = (parts[1] ?? "").trim();
  const speaker = (parts[2] ?? "").trim();
  const title = parts
    .slice(3)
    .map((p) => p.trim())
    .join(" | ");
  return { date, time, speaker, title };
}

/**
 * Безпечно встановлює textContent дочірнього елемента.
 * @param {Element} parent
 * @param {string} selector
 * @param {string} text
 */
function setText(parent, selector, text) {
  const el = parent.querySelector(selector);
  if (el) el.textContent = text;
}

// ─── DOM builders (return HTMLElement, never use innerHTML for user data) ───

/**
 * Створює рядок таблиці для однієї анкети.
 * @param {object} user  — об'єкт анкети з API
 * @param {() => void} onOpen  — callback натискання «Відкрити»
 * @returns {HTMLTableRowElement}
 */
export function createUserRow(user, onOpen) {
  const tr = document.createElement("tr");

  // Учасник
  const tdParticipant = document.createElement("td");
  const nameEl = document.createElement("div");
  nameEl.className = "cell-primary";
  nameEl.textContent = user.name ?? "—";
  const idEl = document.createElement("div");
  idEl.className = "cell-secondary";
  idEl.textContent = `ID: ${user.id ?? "—"}`;
  tdParticipant.append(nameEl, idEl);
  tr.append(tdParticipant);

  // Контакти
  const tdContacts = document.createElement("td");
  tdContacts.className = "cell-two-line";
  const phoneEl = document.createElement("div");
  phoneEl.className = "cell-primary";
  phoneEl.textContent = user.phoneNumber ?? "—";
  const tgEl = document.createElement("div");
  tgEl.className = "cell-secondary";
  tgEl.textContent = user.telegramUsername ? `@${user.telegramUsername}` : "—";
  tdContacts.append(phoneEl, tgEl);
  tr.append(tdContacts);

  // Навчання
  const tdEducation = document.createElement("td");
  tdEducation.className = "cell-two-line";
  const instEl = document.createElement("div");
  instEl.className = "cell-primary";
  instEl.textContent = user.institution ?? "—";
  const courseEl = document.createElement("div");
  courseEl.className = "cell-secondary";
  courseEl.textContent = user.course ? `${user.course} курс` : "—";
  tdEducation.append(instEl, courseEl);
  tr.append(tdEducation);

  // Тренінги — кількість
  const tdTrainings = document.createElement("td");
  const count = Array.isArray(user.trainingIds) ? user.trainingIds.length : 0;
  if (count > 0) {
    const badge = document.createElement("span");
    badge.className = "training-badge";
    badge.textContent = pluralizeTrainings(count);
    tdTrainings.append(badge);
  } else {
    const none = document.createElement("span");
    none.className = "training-none";
    none.textContent = "—";
    tdTrainings.append(none);
  }
  tr.append(tdTrainings);

  // Джерело
  const tdSource = document.createElement("td");
  const sourceEl = document.createElement("div");
  sourceEl.className = "cell-primary";
  sourceEl.textContent = user.discoverySource ?? "—";
  tdSource.append(sourceEl);
  tr.append(tdSource);

  // Подано
  const tdSubmitted = document.createElement("td");
  const submittedEl = document.createElement("div");
  submittedEl.className = "cell-primary";
  submittedEl.textContent = formatDate(user.createdAt);
  tdSubmitted.append(submittedEl);
  tr.append(tdSubmitted);

  // Дії
  const tdActions = document.createElement("td");
  const openBtn = document.createElement("button");
  openBtn.className = "btn btn-open";
  openBtn.type = "button";
  openBtn.textContent = "Відкрити";
  openBtn.setAttribute("aria-label", `Відкрити анкету учасника ${user.name ?? user.id}`);
  openBtn.dataset.userId = String(user.id);
  if (typeof onOpen === "function") {
    openBtn.addEventListener("click", () => onOpen(user, openBtn));
  }
  tdActions.append(openBtn);
  tr.append(tdActions);

  return tr;
}

/**
 * Створює мобільну картку анкети.
 * @param {object} user
 * @param {() => void} onOpen
 * @returns {HTMLElement}
 */
export function createUserCard(user, onOpen) {
  const card = document.createElement("article");
  card.className = "user-card";

  // Header: ПІБ + ID
  const header = document.createElement("div");
  header.className = "user-card__header";

  const nameWrap = document.createElement("div");
  const nameEl = document.createElement("div");
  nameEl.className = "user-card__name";
  nameEl.textContent = user.name ?? "—";
  const idEl = document.createElement("div");
  idEl.className = "user-card__id";
  idEl.textContent = `ID: ${user.id ?? "—"}`;
  nameWrap.append(nameEl, idEl);

  const openBtn = document.createElement("button");
  openBtn.className = "btn btn-open";
  openBtn.type = "button";
  openBtn.textContent = "Відкрити";
  openBtn.setAttribute("aria-label", `Відкрити анкету учасника ${user.name ?? user.id}`);
  openBtn.dataset.userId = String(user.id);
  if (typeof onOpen === "function") {
    openBtn.addEventListener("click", () => onOpen(user, openBtn));
  }

  header.append(nameWrap, openBtn);

  // Rows
  const rows = document.createElement("div");
  rows.className = "user-card__rows";

  const cardRows = [
    ["Телефон", user.phoneNumber ?? "—"],
    ["Telegram", user.telegramUsername ? `@${user.telegramUsername}` : "—"],
    ["Заклад", user.institution ?? "—"],
    ["Курс", user.course ? `${user.course} курс` : "—"],
    ["Тренінги", formatTrainingCount(user.trainingIds) || "—"],
    ["Джерело", user.discoverySource ?? "—"],
  ];

  for (const [label, value] of cardRows) {
    const row = document.createElement("div");
    row.className = "user-card__row";
    const labelEl = document.createElement("span");
    labelEl.className = "user-card__label";
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "user-card__value";
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    rows.append(row);
  }

  card.append(header, rows);
  return card;
}

/**
 * Рендерить секцію detail-rows у drawer.
 * @param {string} title
 * @param {Array<[string, string]>} fields
 * @returns {HTMLElement}
 */
export function createDetailSection(title, fields) {
  const section = document.createElement("div");
  section.className = "detail-section";

  const titleEl = document.createElement("h3");
  titleEl.className = "detail-section__title";
  titleEl.textContent = title;
  section.append(titleEl);

  const rows = document.createElement("div");
  rows.className = "detail-rows";

  for (const [label, value] of fields) {
    const row = document.createElement("div");
    row.className = "detail-row";

    const labelEl = document.createElement("span");
    labelEl.className = "detail-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "detail-value";
    valueEl.textContent = value || "—";

    row.append(labelEl, valueEl);
    rows.append(row);
  }

  section.append(rows);
  return section;
}

/**
 * Рендерить badge згоди.
 * @param {boolean} accepted
 * @param {string | null | undefined} at
 * @returns {HTMLElement}
 */
export function createConsentBadge(accepted, at) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "4px";

  const badge = document.createElement("span");
  badge.className = accepted ? "badge badge-success" : "badge badge-neutral";
  // Не передаємо статус лише кольором — додаємо текст
  badge.textContent = accepted ? "✓ Прийнято" : "Не прийнято";
  badge.setAttribute("aria-label", accepted ? "Прийнято" : "Не прийнято");
  wrap.append(badge);

  if (accepted && at) {
    const dateEl = document.createElement("span");
    dateEl.style.fontSize = "12px";
    dateEl.style.color = "var(--text-secondary)";
    dateEl.textContent = formatDate(at);
    wrap.append(dateEl);
  }

  return wrap;
}

/**
 * Рендерить повний вміст drawer для конкретної анкети.
 * @param {object} user
 * @returns {DocumentFragment}
 */
export function createDrawerContent(user) {
  const frag = document.createDocumentFragment();

  // 1. Основні дані
  frag.append(
    createDetailSection("Основні дані", [
      ["ПІБ", user.name],
      ["ID анкети", user.id],
    ]),
  );

  // 2. Контакти
  frag.append(
    createDetailSection("Контакти", [
      ["Телефон", user.phoneNumber],
      ["Telegram", user.telegramUsername ? `@${user.telegramUsername}` : null],
      ["Telegram ID", user.telegramUserId],
    ]),
  );

  // 3. Навчання
  frag.append(
    createDetailSection("Навчальний заклад і курс", [
      ["Заклад", user.institution],
      ["Курс", user.course ? `${user.course} курс` : null],
    ]),
  );

  // 4. Тренінги
  const trainingsSection = document.createElement("div");
  trainingsSection.className = "detail-section";
  const trainingsTitle = document.createElement("h3");
  trainingsTitle.className = "detail-section__title";
  trainingsTitle.textContent = "Обрані тренінги";
  trainingsSection.append(trainingsTitle);

  const displayList = Array.isArray(user.trainingDisplay) ? user.trainingDisplay : [];
  if (displayList.length === 0) {
    const emptyEl = document.createElement("p");
    emptyEl.className = "training-empty";
    emptyEl.textContent = "Тренінгів не обрано";
    trainingsSection.append(emptyEl);
  } else {
    const cards = document.createElement("div");
    cards.className = "training-cards";
    for (const label of displayList) {
      const parsed = parseTrainingLabel(label);
      const card = document.createElement("div");
      card.className = "training-card";

      const titleEl = document.createElement("div");
      titleEl.className = "training-card__title";
      titleEl.textContent = parsed.title || label;
      card.append(titleEl);

      const meta = document.createElement("div");
      meta.className = "training-card__meta";

      const metaItems = [
        ["Дата", parsed.date],
        ["Час", parsed.time],
        ["Спікер", parsed.speaker],
      ];
      for (const [metaLabel, metaValue] of metaItems) {
        if (metaValue) {
          const item = document.createElement("div");
          item.className = "training-card__meta-item";
          const strong = document.createElement("strong");
          strong.textContent = `${metaLabel}: `;
          item.append(strong);
          item.append(document.createTextNode(metaValue));
          meta.append(item);
        }
      }
      card.append(meta);
      cards.append(card);
    }
    trainingsSection.append(cards);
  }
  frag.append(trainingsSection);

  // 5. Джерело
  frag.append(
    createDetailSection("Джерело інформації", [["Дізнався(-лась) про BTW", user.discoverySource]]),
  );

  // 6. Згоди
  const consentSection = document.createElement("div");
  consentSection.className = "detail-section";
  const consentTitle = document.createElement("h3");
  consentTitle.className = "detail-section__title";
  consentTitle.textContent = "Згоди";
  consentSection.append(consentTitle);

  const consentRows = document.createElement("div");
  consentRows.className = "detail-rows";

  // Персональні дані
  const pdRow = document.createElement("div");
  pdRow.className = "detail-row";
  const pdLabel = document.createElement("span");
  pdLabel.className = "detail-label";
  pdLabel.textContent = "Персональні дані";
  if (user.personalDataPolicyVersion) {
    pdLabel.textContent += ` (${user.personalDataPolicyVersion})`;
  }
  pdRow.append(pdLabel, createConsentBadge(user.personalDataConsent, user.personalDataConsentAt));
  consentRows.append(pdRow);

  // Правила BTW
  const erRow = document.createElement("div");
  erRow.className = "detail-row";
  const erLabel = document.createElement("span");
  erLabel.className = "detail-label";
  erLabel.textContent = "Правила BTW";
  if (user.eventRulesVersion) {
    erLabel.textContent += ` (${user.eventRulesVersion})`;
  }
  erRow.append(erLabel, createConsentBadge(user.eventRulesConsent, user.eventRulesConsentAt));
  consentRows.append(erRow);

  consentSection.append(consentRows);
  frag.append(consentSection);

  // 7. Технічні дані
  frag.append(
    createDetailSection("Технічні дані", [
      ["Подано", formatDate(user.createdAt)],
      ["Оновлено", formatDate(user.updatedAt)],
    ]),
  );

  return frag;
}

// ─── Application state & DOM init ──────────────────────────────────────────

/**
 * Ініціалізує застосунок. Виконується тільки в браузері.
 * Винесено окремо, щоб import у Vitest не запускав автоматичний fetch.
 */
export function init() {
  const state = {
    page: 1,
    pageSize: 20,
    search: "",
    /** @type {AbortController | null} */
    abortController: null,
    /** @type {HTMLElement | null} — кнопка, що відкрила drawer */
    openerButton: null,
    activeTab: "users",
    notifPage: 1,
    notifPageSize: 20,
    /** @type {AbortController | null} */
    notifAbortController: null,
    /** @type {HTMLElement | null} */
    notifOpenerButton: null,
  };

  // ── DOM refs ──────────────────────────────────────────────────────────
  const searchForm = /** @type {HTMLFormElement} */ (document.getElementById("search-form"));
  const searchInput = /** @type {HTMLInputElement} */ (document.getElementById("search"));
  const searchClear = /** @type {HTMLButtonElement} */ (document.getElementById("search-clear"));
  const searchBtn = /** @type {HTMLButtonElement} */ (document.getElementById("search-btn"));
  const usersBody = /** @type {HTMLElement} */ (document.getElementById("users-body"));
  const cardsList = /** @type {HTMLElement} */ (document.getElementById("cards-list"));
  const skeletonEl = /** @type {HTMLElement} */ (document.getElementById("skeleton"));
  const tableScroll = /** @type {HTMLElement} */ (document.getElementById("table-scroll"));
  const emptyState = /** @type {HTMLElement} */ (document.getElementById("empty-state"));
  const emptyTitle = /** @type {HTMLElement} */ (document.getElementById("empty-title"));
  const emptyDesc = /** @type {HTMLElement} */ (document.getElementById("empty-desc"));
  const clearSearchBtn = /** @type {HTMLButtonElement} */ (
    document.getElementById("clear-search-btn")
  );
  const errorState = /** @type {HTMLElement} */ (document.getElementById("error-state"));
  const retryBtn = /** @type {HTMLButtonElement} */ (document.getElementById("retry-btn"));
  const totalCount = /** @type {HTMLElement} */ (document.getElementById("total-count"));
  const paginationBar = /** @type {HTMLElement} */ (document.getElementById("pagination-bar"));
  const paginationMeta = /** @type {HTMLElement} */ (document.getElementById("pagination-meta"));
  const previousBtn = /** @type {HTMLButtonElement} */ (document.getElementById("previous"));
  const nextBtn = /** @type {HTMLButtonElement} */ (document.getElementById("next"));
  const mobilePaginationBar = /** @type {HTMLElement} */ (
    document.getElementById("mobile-pagination-bar")
  );
  const mobilePaginationMeta = /** @type {HTMLElement} */ (
    document.getElementById("mobile-pagination-meta")
  );
  const mobilePreviousBtn = /** @type {HTMLButtonElement} */ (
    document.getElementById("mobile-previous")
  );
  const mobileNextBtn = /** @type {HTMLButtonElement} */ (document.getElementById("mobile-next"));
  const drawer = /** @type {HTMLElement} */ (document.getElementById("drawer"));
  const drawerOverlay = /** @type {HTMLElement} */ (document.getElementById("drawer-overlay"));
  const drawerTitle = /** @type {HTMLElement} */ (document.getElementById("drawer-title"));
  const drawerBody = /** @type {HTMLElement} */ (document.getElementById("drawer-body"));
  const drawerClose = /** @type {HTMLButtonElement} */ (document.getElementById("drawer-close"));
  const logoutBtn = /** @type {HTMLButtonElement} */ (document.getElementById("logout"));

  // ── Drawer management ─────────────────────────────────────────────────

  /** @type {HTMLElement[]} */
  let focusTrapElements = [];

  function getFocusable() {
    return Array.from(
      drawer.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  function trapFocus(event) {
    focusTrapElements = getFocusable();
    if (focusTrapElements.length === 0) return;
    const first = focusTrapElements[0];
    const last = focusTrapElements[focusTrapElements.length - 1];
    if (event.key === "Tab") {
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
  }

  function openDrawer(user, openerBtn) {
    state.openerButton = openerBtn ?? null;
    drawerTitle.textContent = user.name ?? "Анкета учасника";
    drawerBody.replaceChildren(createDrawerContent(user));
    drawer.setAttribute("aria-hidden", "false");
    drawerOverlay.classList.add("is-visible");
    drawerOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    drawerClose.focus();
    document.addEventListener("keydown", handleDrawerKeydown);
  }

  function closeDrawer() {
    drawer.setAttribute("aria-hidden", "true");
    drawerOverlay.classList.remove("is-visible");
    drawerOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");
    document.removeEventListener("keydown", handleDrawerKeydown);
    if (state.openerButton) {
      state.openerButton.focus();
      state.openerButton = null;
    }
  }

  function handleDrawerKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
    } else if (event.key === "Tab") {
      trapFocus(event);
    }
  }

  drawerClose.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  // ── Render ────────────────────────────────────────────────────────────

  function setLoadingState() {
    skeletonEl.hidden = false;
    tableScroll.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = true;
    paginationBar.hidden = true;
    mobilePaginationBar.hidden = true;
    cardsList.replaceChildren();
    searchBtn.disabled = true;
  }

  function setErrorState() {
    skeletonEl.hidden = true;
    tableScroll.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = false;
    paginationBar.hidden = true;
    mobilePaginationBar.hidden = true;
    searchBtn.disabled = false;
  }

  /**
   * @param {object[]} users
   * @param {{ page: number, pageSize: number, total: number, totalPages: number }} pagination
   */
  function render(users, pagination) {
    skeletonEl.hidden = true;
    searchBtn.disabled = false;

    const hasResults = users.length > 0;

    if (!hasResults) {
      tableScroll.hidden = true;
      paginationBar.hidden = true;
      mobilePaginationBar.hidden = true;
      emptyState.hidden = false;
      errorState.hidden = true;
      cardsList.replaceChildren();

      if (state.search) {
        emptyTitle.textContent = "Нічого не знайдено";
        emptyDesc.textContent = `Не знайдено анкет за запитом «${state.search}»`;
        clearSearchBtn.hidden = false;
      } else {
        emptyTitle.textContent = "Анкет поки немає";
        emptyDesc.textContent = "Збережені анкети з'являться тут";
        clearSearchBtn.hidden = true;
      }
      return;
    }

    emptyState.hidden = true;
    errorState.hidden = true;
    tableScroll.hidden = false;

    // Table rows
    usersBody.replaceChildren();
    for (const user of users) {
      usersBody.append(createUserRow(user, openDrawer));
    }

    // Mobile cards
    cardsList.replaceChildren();
    for (const user of users) {
      cardsList.append(createUserCard(user, openDrawer));
    }

    // Pagination meta
    const from = (pagination.page - 1) * pagination.pageSize + 1;
    const to = Math.min(pagination.page * pagination.pageSize, pagination.total);
    const metaText = `Показано ${from}–${to} із ${pagination.total}`;
    paginationMeta.textContent = metaText;
    mobilePaginationMeta.textContent = metaText;

    previousBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.totalPages;
    mobilePreviousBtn.disabled = pagination.page <= 1;
    mobileNextBtn.disabled = pagination.page >= pagination.totalPages;

    paginationBar.hidden = false;
    mobilePaginationBar.hidden = false;

    // Total count badge
    totalCount.textContent = `${pagination.total} ${
      pagination.total % 10 === 1 && pagination.total % 100 !== 11
        ? "анкета"
        : pagination.total % 10 >= 2 &&
            pagination.total % 10 <= 4 &&
            !(pagination.total % 100 >= 12 && pagination.total % 100 <= 14)
          ? "анкети"
          : "анкет"
    }`;
    totalCount.hidden = false;
  }

  // ── Data fetching ─────────────────────────────────────────────────────

  async function loadUsers() {
    // Скасувати попередній незавершений запит
    if (state.abortController) {
      state.abortController.abort();
    }
    state.abortController = new AbortController();
    const signal = state.abortController.signal;

    setLoadingState();

    const params = new URLSearchParams({
      page: String(state.page),
      pageSize: String(state.pageSize),
      search: state.search,
    });

    try {
      const response = await fetch(`/api/users?${params}`, {
        credentials: "same-origin",
        signal,
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("request");
      const result = await response.json();
      render(result.users, result.pagination);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Запит скасовано — нічого не робимо
        return;
      }
      setErrorState();
    }
  }

  // ── Search ────────────────────────────────────────────────────────────

  function updateClearButton() {
    searchClear.hidden = searchInput.value.length === 0;
  }

  searchInput.addEventListener("input", updateClearButton);

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.search = searchInput.value.trim();
    state.page = 1;
    void loadUsers();
  });

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    updateClearButton();
    state.search = "";
    state.page = 1;
    void loadUsers();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    updateClearButton();
    state.search = "";
    state.page = 1;
    void loadUsers();
  });

  // ── Pagination ────────────────────────────────────────────────────────

  function goToPrevious() {
    if (state.page > 1) {
      state.page -= 1;
      void loadUsers();
    }
  }

  function goToNext() {
    state.page += 1;
    void loadUsers();
  }

  previousBtn.addEventListener("click", goToPrevious);
  nextBtn.addEventListener("click", goToNext);
  mobilePreviousBtn.addEventListener("click", goToPrevious);
  mobileNextBtn.addEventListener("click", goToNext);

  // ── Retry ─────────────────────────────────────────────────────────────

  retryBtn.addEventListener("click", () => {
    void loadUsers();
  });

  // ── Logout ────────────────────────────────────────────────────────────

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/login");
  });

  // ── Initial load ──────────────────────────────────────────────────────

  void loadUsers();

  // ── Tab switching ──────────────────────────────────────────────────────

  const tabUsers = document.getElementById("tab-users");
  const tabNotifications = document.getElementById("tab-notifications");
  const usersPanel = document.getElementById("users-panel");
  const notifPanel = document.getElementById("notif-panel");

  function switchTab(tab) {
    state.activeTab = tab;
    if (tab === "users") {
      tabUsers.classList.add("is-active");
      tabNotifications.classList.remove("is-active");
      if (usersPanel) usersPanel.style.display = "";
      if (notifPanel) notifPanel.classList.remove("is-visible");
    } else {
      tabUsers.classList.remove("is-active");
      tabNotifications.classList.add("is-active");
      if (usersPanel) usersPanel.style.display = "none";
      if (notifPanel) notifPanel.classList.add("is-visible");
      void loadNotifications();
    }
  }

  if (tabUsers) tabUsers.addEventListener("click", () => switchTab("users"));
  if (tabNotifications) tabNotifications.addEventListener("click", () => switchTab("notifications"));

  // ── Notifications ─────────────────────────────────────────────────────

  const notifSkeleton = document.getElementById("notif-skeleton");
  const notifTableScroll = document.getElementById("notif-table-scroll");
  const notifBody = document.getElementById("notif-body");
  const notifEmpty = document.getElementById("notif-empty");
  const notifPagination = document.getElementById("notif-pagination");
  const notifPaginationMeta = document.getElementById("notif-pagination-meta");
  const notifPrevBtn = document.getElementById("notif-prev");
  const notifNextBtn = document.getElementById("notif-next");
  const createNotifBtn = document.getElementById("create-notif-btn");

  // Notification detail drawer
  const notifDrawer = document.getElementById("notif-drawer");
  const notifDrawerOverlay = document.getElementById("notif-drawer-overlay");
  const notifDrawerTitle = document.getElementById("notif-drawer-title");
  const notifDrawerBody = document.getElementById("notif-drawer-body");
  const notifDrawerClose = document.getElementById("notif-drawer-close");

  function openNotifDrawer(notification, openerBtn) {
    state.notifOpenerButton = openerBtn ?? null;
    if (notifDrawerTitle) notifDrawerTitle.textContent = notification.title ?? "Оповіщення";
    if (notifDrawerBody) notifDrawerBody.replaceChildren(createNotifDrawerContent(notification));
    if (notifDrawer) notifDrawer.setAttribute("aria-hidden", "false");
    if (notifDrawerOverlay) {
      notifDrawerOverlay.classList.add("is-visible");
      notifDrawerOverlay.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("drawer-open");
    if (notifDrawerClose) notifDrawerClose.focus();
    document.addEventListener("keydown", handleNotifDrawerKeydown);
  }

  function closeNotifDrawer() {
    if (notifDrawer) notifDrawer.setAttribute("aria-hidden", "true");
    if (notifDrawerOverlay) {
      notifDrawerOverlay.classList.remove("is-visible");
      notifDrawerOverlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("drawer-open");
    document.removeEventListener("keydown", handleNotifDrawerKeydown);
    if (state.notifOpenerButton) {
      state.notifOpenerButton.focus();
      state.notifOpenerButton = null;
    }
  }

  function handleNotifDrawerKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeNotifDrawer();
    }
  }

  if (notifDrawerClose) notifDrawerClose.addEventListener("click", closeNotifDrawer);
  if (notifDrawerOverlay) notifDrawerOverlay.addEventListener("click", closeNotifDrawer);

  const STATUS_LABELS = {
    pending: "Очікує",
    processing: "Обробка",
    sent: "Надіслано",
    partially_sent: "Частково",
    failed: "Помилка",
    expired: "Протерміновано",
    cancelled: "Скасовано",
  };

  const TARGET_LABELS = {
    all: "Усім",
    training: "Тренінг",
    user: "Користувачу",
    custom: "Вибірково",
  };

  function createStatusBadge(status) {
    const badge = document.createElement("span");
    badge.className = `status-badge status-badge--${status}`;
    badge.textContent = STATUS_LABELS[status] ?? status;
    return badge;
  }

  function createNotifRow(notif, onOpen) {
    const tr = document.createElement("tr");

    const tdTitle = document.createElement("td");
    const titleEl = document.createElement("div");
    titleEl.className = "cell-primary";
    titleEl.textContent = notif.title ?? "—";
    const msgEl = document.createElement("div");
    msgEl.className = "cell-secondary";
    const msgText = notif.message ?? "";
    msgEl.textContent = msgText.length > 60 ? msgText.slice(0, 60) + "…" : msgText;
    tdTitle.append(titleEl, msgEl);
    tr.append(tdTitle);

    const tdAudience = document.createElement("td");
    tdAudience.textContent = TARGET_LABELS[notif.targetType] ?? notif.targetType;
    tr.append(tdAudience);

    const tdScheduled = document.createElement("td");
    tdScheduled.textContent = formatDate(notif.scheduledAt);
    tr.append(tdScheduled);

    const tdStatus = document.createElement("td");
    tdStatus.append(createStatusBadge(notif.status));
    tr.append(tdStatus);

    const tdStats = document.createElement("td");
    const pills = document.createElement("div");
    pills.className = "stat-pills";
    if (notif.sentCount > 0) {
      const p = document.createElement("span");
      p.className = "stat-pill";
      p.textContent = `✓ ${notif.sentCount}`;
      pills.append(p);
    }
    if (notif.failedCount > 0) {
      const p = document.createElement("span");
      p.className = "stat-pill";
      p.textContent = `✗ ${notif.failedCount}`;
      pills.append(p);
    }
    if (notif.blockedCount > 0) {
      const p = document.createElement("span");
      p.className = "stat-pill";
      p.textContent = `⊘ ${notif.blockedCount}`;
      pills.append(p);
    }
    if (notif.pendingCount > 0) {
      const p = document.createElement("span");
      p.className = "stat-pill";
      p.textContent = `… ${notif.pendingCount}`;
      pills.append(p);
    }
    tdStats.append(pills);
    tr.append(tdStats);

    const tdActions = document.createElement("td");
    const openBtn = document.createElement("button");
    openBtn.className = "btn btn-open";
    openBtn.type = "button";
    openBtn.textContent = "Деталі";
    openBtn.addEventListener("click", () => onOpen(notif, openBtn));
    tdActions.append(openBtn);
    tr.append(tdActions);

    return tr;
  }

  function createNotifDrawerContent(notif) {
    const frag = document.createDocumentFragment();

    frag.append(
      createDetailSection("Основне", [
        ["Заголовок", notif.title],
        ["Статус", STATUS_LABELS[notif.status] ?? notif.status],
        ["Аудиторія", TARGET_LABELS[notif.targetType] ?? notif.targetType],
        ["Заплановано", formatDate(notif.scheduledAt)],
        ["Надіслано", formatDate(notif.sentAt)],
        ["Термін", notif.expiresAt ? formatDate(notif.expiresAt) : "—"],
      ]),
    );

    // Message
    const msgSection = document.createElement("div");
    msgSection.className = "detail-section";
    const msgTitle = document.createElement("h3");
    msgTitle.className = "detail-section__title";
    msgTitle.textContent = "Текст повідомлення";
    msgSection.append(msgTitle);
    const msgPre = document.createElement("p");
    msgPre.style.whiteSpace = "pre-wrap";
    msgPre.style.fontSize = "13px";
    msgPre.style.color = "var(--text-primary)";
    msgPre.textContent = notif.message ?? "";
    msgSection.append(msgPre);
    frag.append(msgSection);

    // Action buttons
    if (notif.status === "pending" || notif.status === "processing") {
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.marginBottom = "20px";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn btn-secondary btn-sm";
      cancelBtn.textContent = "Скасувати";
      cancelBtn.addEventListener("click", async () => {
        await fetch(`/api/notifications/${notif.id}/cancel`, {
          method: "POST",
          credentials: "same-origin",
        });
        closeNotifDrawer();
        void loadNotifications();
      });
      actions.append(cancelBtn);
      frag.append(actions);
    }

    if (notif.status === "partially_sent" || notif.status === "failed") {
      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.marginBottom = "20px";
      const retryBtn = document.createElement("button");
      retryBtn.className = "btn btn-secondary btn-sm";
      retryBtn.textContent = "Повторити невдалі";
      retryBtn.addEventListener("click", async () => {
        await fetch(`/api/notifications/${notif.id}/retry-failed`, {
          method: "POST",
          credentials: "same-origin",
        });
        closeNotifDrawer();
        void loadNotifications();
      });
      actions.append(retryBtn);
      frag.append(actions);
    }

    // Deliveries table
    if (Array.isArray(notif.deliveries) && notif.deliveries.length > 0) {
      const delSection = document.createElement("div");
      delSection.className = "detail-section";
      const delTitle = document.createElement("h3");
      delTitle.className = "detail-section__title";
      delTitle.textContent = `Доставка (${notif.deliveries.length})`;
      delSection.append(delTitle);

      const delRows = document.createElement("div");
      delRows.className = "detail-rows";
      for (const delivery of notif.deliveries) {
        const row = document.createElement("div");
        row.className = "detail-row";
        const nameEl = document.createElement("span");
        nameEl.className = "detail-label";
        nameEl.textContent = delivery.userName ?? `User #${delivery.userId}`;
        const valEl = document.createElement("span");
        valEl.className = "detail-value";
        valEl.append(createStatusBadge(delivery.status));
        if (delivery.lastError) {
          const errEl = document.createElement("span");
          errEl.style.fontSize = "11px";
          errEl.style.color = "var(--text-secondary)";
          errEl.style.marginLeft = "8px";
          errEl.textContent = delivery.lastError;
          valEl.append(errEl);
        }
        row.append(nameEl, valEl);
        delRows.append(row);
      }
      delSection.append(delRows);
      frag.append(delSection);
    }

    return frag;
  }

  async function loadNotifDetail(id, openerBtn) {
    try {
      const response = await fetch(`/api/notifications/${id}`, { credentials: "same-origin" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      openNotifDrawer(data.notification, openerBtn);
    } catch {
      // silently fail
    }
  }

  function renderNotifications(notifications, pagination) {
    if (notifSkeleton) notifSkeleton.hidden = true;

    if (notifications.length === 0) {
      if (notifTableScroll) notifTableScroll.hidden = true;
      if (notifPagination) notifPagination.hidden = true;
      if (notifEmpty) notifEmpty.hidden = false;
      return;
    }

    if (notifEmpty) notifEmpty.hidden = true;
    if (notifTableScroll) notifTableScroll.hidden = false;

    if (notifBody) {
      notifBody.replaceChildren();
      for (const notif of notifications) {
        notifBody.append(
          createNotifRow(notif, (n, btn) => void loadNotifDetail(n.id, btn)),
        );
      }
    }

    if (pagination && pagination.total > 0) {
      const from = (pagination.page - 1) * pagination.pageSize + 1;
      const to = Math.min(pagination.page * pagination.pageSize, pagination.total);
      if (notifPaginationMeta) notifPaginationMeta.textContent = `Показано ${from}–${to} із ${pagination.total}`;
      if (notifPrevBtn) notifPrevBtn.disabled = pagination.page <= 1;
      if (notifNextBtn) notifNextBtn.disabled = pagination.page >= pagination.totalPages;
      if (notifPagination) notifPagination.hidden = false;
    } else {
      if (notifPagination) notifPagination.hidden = true;
    }
  }

  async function loadNotifications() {
    if (state.notifAbortController) state.notifAbortController.abort();
    state.notifAbortController = new AbortController();

    if (notifSkeleton) notifSkeleton.hidden = false;
    if (notifTableScroll) notifTableScroll.hidden = true;
    if (notifEmpty) notifEmpty.hidden = true;

    const params = new URLSearchParams({
      page: String(state.notifPage),
      pageSize: String(state.notifPageSize),
    });

    try {
      const response = await fetch(`/api/notifications?${params}`, {
        credentials: "same-origin",
        signal: state.notifAbortController.signal,
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("request");
      const result = await response.json();
      renderNotifications(result.notifications, result.pagination);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (notifSkeleton) notifSkeleton.hidden = true;
    }
  }

  if (notifPrevBtn) {
    notifPrevBtn.addEventListener("click", () => {
      if (state.notifPage > 1) {
        state.notifPage -= 1;
        void loadNotifications();
      }
    });
  }
  if (notifNextBtn) {
    notifNextBtn.addEventListener("click", () => {
      state.notifPage += 1;
      void loadNotifications();
    });
  }

  // ── Create notification modal ─────────────────────────────────────────

  const createNotifOverlay = document.getElementById("create-notif-overlay");
  const createNotifClose = document.getElementById("create-notif-close");
  const notifTitleInput = document.getElementById("notif-title");
  const notifMessageInput = document.getElementById("notif-message");
  const trainingSelectGroup = document.getElementById("training-select-group");
  const notifTrainingSelect = document.getElementById("notif-training");
  const userIdGroup = document.getElementById("user-id-group");
  const notifUserIdsInput = document.getElementById("notif-user-ids");
  const scheduleRow = document.getElementById("schedule-row");
  const notifDateInput = document.getElementById("notif-date");
  const notifTimeInput = document.getElementById("notif-time");
  const notifExpiresInput = document.getElementById("notif-expires");
  const notifError = document.getElementById("notif-error");
  const notifPreviewCount = document.getElementById("notif-preview-count");
  const notifSubmitBtn = document.getElementById("notif-submit");

  function openCreateModal() {
    if (createNotifOverlay) createNotifOverlay.classList.add("is-visible");
    // Load trainings for selector
    void loadTrainings();
  }

  function closeCreateModal() {
    if (createNotifOverlay) createNotifOverlay.classList.remove("is-visible");
    // Reset form
    if (notifTitleInput) notifTitleInput.value = "";
    if (notifMessageInput) notifMessageInput.value = "";
    if (notifExpiresInput) notifExpiresInput.value = "";
    if (notifError) notifError.hidden = true;
    if (notifPreviewCount) notifPreviewCount.textContent = "";
  }

  if (createNotifBtn) createNotifBtn.addEventListener("click", openCreateModal);
  if (createNotifClose) createNotifClose.addEventListener("click", closeCreateModal);
  if (createNotifOverlay) {
    createNotifOverlay.addEventListener("click", (e) => {
      if (e.target === createNotifOverlay) closeCreateModal();
    });
  }

  // Target type radio
  const targetRadios = document.querySelectorAll('input[name="notif-target"]');
  for (const radio of targetRadios) {
    radio.addEventListener("change", () => {
      const value = radio.value;
      if (trainingSelectGroup) trainingSelectGroup.hidden = value !== "training";
      if (userIdGroup) userIdGroup.hidden = value !== "user" && value !== "custom";
      void updatePreviewCount();
    });
  }

  // When radio
  const whenRadios = document.querySelectorAll('input[name="notif-when"]');
  for (const radio of whenRadios) {
    radio.addEventListener("change", () => {
      if (scheduleRow) scheduleRow.hidden = radio.value !== "scheduled";
    });
  }

  async function loadTrainings() {
    try {
      const response = await fetch("/api/trainings", { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await response.json();
      if (notifTrainingSelect) {
        // Keep first option
        while (notifTrainingSelect.options.length > 1) notifTrainingSelect.remove(1);
        for (const t of data.trainings) {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = t.label;
          notifTrainingSelect.append(opt);
        }
      }
    } catch {
      // silently fail
    }
  }

  async function updatePreviewCount() {
    const targetType = document.querySelector('input[name="notif-target"]:checked')?.value ?? "all";
    const trainingId = targetType === "training" ? notifTrainingSelect?.value : null;
    const userIdsRaw = notifUserIdsInput?.value ?? "";
    const targetUserIds =
      targetType === "user" && userIdsRaw
        ? userIdsRaw.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n))
        : null;

    try {
      const response = await fetch("/api/notifications/preview-count", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, trainingId, targetUserIds }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (notifPreviewCount) notifPreviewCount.textContent = `Це повідомлення отримають ${data.count} учасників`;
    } catch {
      // silently fail
    }
  }

  if (notifTrainingSelect) notifTrainingSelect.addEventListener("change", () => void updatePreviewCount());

  if (notifSubmitBtn) {
    notifSubmitBtn.addEventListener("click", async () => {
      if (notifError) notifError.hidden = true;

      const title = notifTitleInput?.value?.trim() ?? "";
      const message = notifMessageInput?.value?.trim() ?? "";
      const targetType = document.querySelector('input[name="notif-target"]:checked')?.value ?? "all";
      const whenValue = document.querySelector('input[name="notif-when"]:checked')?.value ?? "now";

      if (!title || !message) {
        if (notifError) {
          notifError.textContent = "Заголовок і текст обов'язкові";
          notifError.hidden = false;
        }
        return;
      }

      let scheduledAt;
      if (whenValue === "scheduled") {
        const dateVal = notifDateInput?.value;
        const timeVal = notifTimeInput?.value;
        if (!dateVal || !timeVal) {
          if (notifError) {
            notifError.textContent = "Вкажіть дату та час";
            notifError.hidden = false;
          }
          return;
        }
        scheduledAt = new Date(`${dateVal}T${timeVal}:00`).toISOString();
      } else {
        scheduledAt = new Date().toISOString();
      }

      const body = {
        title,
        message,
        targetType,
        scheduledAt,
      };

      if (targetType === "training") body.trainingId = notifTrainingSelect?.value;
      if (targetType === "user") {
        const raw = notifUserIdsInput?.value ?? "";
        body.targetUserIds = raw.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n));
      }

      const expiresVal = notifExpiresInput?.value;
      if (expiresVal) body.expiresAt = new Date(expiresVal).toISOString();

      notifSubmitBtn.disabled = true;
      try {
        const response = await fetch("/api/notifications", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) {
          if (notifError) {
            notifError.textContent = data.error ?? "Помилка створення";
            notifError.hidden = false;
          }
          return;
        }
        closeCreateModal();
        void loadNotifications();
      } catch {
        if (notifError) {
          notifError.textContent = "Не вдалося створити оповіщення";
          notifError.hidden = false;
        }
      } finally {
        notifSubmitBtn.disabled = false;
      }
    });
  }
}

// Запускаємо тільки в браузері і лише якщо в DOM є кореневий елемент сторінки.
// Це запобігає автозапуску під час import у Vitest, де beforeEach ще не виконався.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const run = () => {
    if (document.getElementById("search-form")) init();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}
