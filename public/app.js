/**
 * BTW - Анкети. Клієнтська логіка захищеної сторінки.
 *
 * Файл є ES-модулем. Чисті функції експортуються для тестування.
 * Підключення до DOM і fetch - тільки в init() внизу файлу.
 */

// ─── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Форматує дату у локалізований рядок uk-UA.
 * Для null / undefined / некоректних значень повертає «-».
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
export function formatDate(value) {
  if (value == null || value === "") return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "-";
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
 * Розбирає рядок `trainingDisplay` форматів «дата | час | спікер | назва»
 * або «дата | спікер | назва». Решта частин об'єднується як назва
 * (щоб уникнути обрізання назв, що містять «|»).
 * @param {string} label
 * @returns {{ date: string; time: string; speaker: string; title: string }}
 */
export function parseTrainingLabel(label) {
  const parts = label.split("|");
  const hasTime = parts.length >= 4;
  const date = (parts[0] ?? "").trim();
  const time = hasTime ? (parts[1] ?? "").trim() : "";
  const speaker = (parts[hasTime ? 2 : 1] ?? "").trim();
  const title = parts
    .slice(hasTime ? 3 : 2)
    .map((p) => p.trim())
    .join(" | ");
  return { date, time, speaker, title };
}

/**
 * Форматує ціле число для статистичних показників.
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatStatisticNumber(value) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("uk-UA").format(Number.isFinite(number) ? number : 0);
}

/**
 * Створює один рядок горизонтальної діаграми статистики.
 * @param {{ label: string; speaker?: string; count: number; percentage?: number }} item
 * @param {number} maxCount
 * @returns {HTMLElement}
 */
export function createStatisticsRow(item, maxCount) {
  const row = document.createElement("div");
  row.className = "stats-row";

  const top = document.createElement("div");
  top.className = "stats-row__top";

  const label = document.createElement("div");
  label.className = "stats-row__label";
  label.textContent = item.label ?? "Не вказано";
  if (item.speaker) {
    const speaker = document.createElement("span");
    speaker.className = "stats-row__speaker";
    speaker.textContent = item.speaker;
    label.append(speaker);
  }

  const value = document.createElement("span");
  value.className = "stats-row__value";
  const percentage = Number(item.percentage ?? 0);
  const formattedPercentage = new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 1,
  }).format(Number.isFinite(percentage) ? percentage : 0);
  value.textContent = `${formatStatisticNumber(item.count)} (${formattedPercentage}%)`;

  top.append(label, value);

  const track = document.createElement("div");
  track.className = "stats-row__track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(Math.max(0, maxCount)));
  track.setAttribute("aria-valuenow", String(Math.max(0, Number(item.count) || 0)));
  track.setAttribute("aria-label", item.label ?? "Статистика");

  const fill = document.createElement("div");
  fill.className = "stats-row__fill";
  const count = Math.max(0, Number(item.count) || 0);
  const width = maxCount > 0 ? Math.min(100, (count / maxCount) * 100) : 0;
  fill.style.width = `${width}%`;
  track.append(fill);

  row.append(top, track);
  return row;
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
 * @param {object} user  - об'єкт анкети з API
 * @param {() => void} onOpen  - callback натискання «Відкрити»
 * @returns {HTMLTableRowElement}
 */
export function createUserRow(user, onOpen) {
  const tr = document.createElement("tr");

  // Учасник
  const tdParticipant = document.createElement("td");
  const nameEl = document.createElement("div");
  nameEl.className = "cell-primary";
  nameEl.textContent = user.name ?? "-";
  const idEl = document.createElement("div");
  idEl.className = "cell-secondary";
  idEl.textContent = `ID: ${user.id ?? "-"}`;
  tdParticipant.append(nameEl, idEl);
  tr.append(tdParticipant);

  // Контакти
  const tdContacts = document.createElement("td");
  tdContacts.className = "cell-two-line";
  const phoneEl = document.createElement("div");
  phoneEl.className = "cell-primary";
  phoneEl.textContent = user.phoneNumber ?? "-";
  const tgEl = document.createElement("div");
  tgEl.className = "cell-secondary";
  tgEl.textContent = user.telegramUsername ? `@${user.telegramUsername}` : "-";
  tdContacts.append(phoneEl, tgEl);
  tr.append(tdContacts);

  // Навчання
  const tdEducation = document.createElement("td");
  tdEducation.className = "cell-two-line";
  const instEl = document.createElement("div");
  instEl.className = "cell-primary";
  instEl.textContent = user.institution ?? "-";
  const courseEl = document.createElement("div");
  courseEl.className = "cell-secondary";
  courseEl.textContent = user.course ? `${user.course} курс` : "-";
  tdEducation.append(instEl, courseEl);
  tr.append(tdEducation);

  // Тренінги - кількість
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
    none.textContent = "-";
    tdTrainings.append(none);
  }
  tr.append(tdTrainings);

  // Джерело
  const tdSource = document.createElement("td");
  const sourceEl = document.createElement("div");
  sourceEl.className = "cell-primary";
  sourceEl.textContent = user.discoverySource ?? "-";
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
  nameEl.textContent = user.name ?? "-";
  const idEl = document.createElement("div");
  idEl.className = "user-card__id";
  idEl.textContent = `ID: ${user.id ?? "-"}`;
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
    ["Телефон", user.phoneNumber ?? "-"],
    ["Telegram", user.telegramUsername ? `@${user.telegramUsername}` : "-"],
    ["Заклад", user.institution ?? "-"],
    ["Курс", user.course ? `${user.course} курс` : "-"],
    ["Тренінги", formatTrainingCount(user.trainingIds) || "-"],
    ["Джерело", user.discoverySource ?? "-"],
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

const REGISTRATION_STEP_LABELS = {
  name: "ПІБ",
  phone: "Телефон",
  institution: "Навчальний заклад",
  institutionOther: "Інший навчальний заклад",
  course: "Курс",
  courseOther: "Інший курс",
  trainings: "Тренінги",
  source: "Джерело інформації",
  sourceOther: "Інше джерело",
  personalConsent: "Згода на персональні дані",
  rulesConsent: "Згода з правилами",
};

/**
 * Створює рядок таблиці незавершених реєстрацій.
 * @param {object} registration
 * @returns {HTMLTableRowElement}
 */
export function createIncompleteRegistrationRow(registration) {
  const tr = document.createElement("tr");

  const tdUser = document.createElement("td");
  const username = document.createElement("div");
  username.className = "cell-primary";
  username.textContent = registration.telegramUsername
    ? `@${registration.telegramUsername}`
    : "Без username";
  const id = document.createElement("div");
  id.className = "cell-secondary";
  id.textContent = `ID: ${registration.telegramUserId ?? "-"}`;
  tdUser.append(username, id);
  tr.append(tdUser);

  const tdStep = document.createElement("td");
  tdStep.textContent = REGISTRATION_STEP_LABELS[registration.step] ?? registration.step ?? "-";
  tr.append(tdStep);

  const tdUpdated = document.createElement("td");
  tdUpdated.textContent = formatDate(registration.updatedAt);
  tr.append(tdUpdated);

  const tdExpires = document.createElement("td");
  tdExpires.textContent = formatDate(registration.expiresAt);
  tr.append(tdExpires);

  return tr;
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
    valueEl.textContent = value || "-";

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
  // Не передаємо статус лише кольором - додаємо текст
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
    /** @type {HTMLElement | null} - кнопка, що відкрила drawer */
    openerButton: null,
    activeTab: "users",
    notifPage: 1,
    notifPageSize: 20,
    /** @type {AbortController | null} */
    notifAbortController: null,
    /** @type {HTMLElement | null} */
    notifOpenerButton: null,
    /** @type {AbortController | null} */
    statsAbortController: null,
    /** @type {AbortController | null} */
    incompleteAbortController: null,
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

  const statsPanel = document.getElementById("stats-panel");
  const statsLoading = document.getElementById("stats-loading");
  const statsContent = document.getElementById("stats-content");
  const statsError = document.getElementById("stats-error");
  const statsRefresh = document.getElementById("stats-refresh");
  const statsRetry = document.getElementById("stats-retry");
  const statsTotalUsers = document.getElementById("stats-total-users");
  const statsUsersWithTraining = document.getElementById("stats-users-with-training");
  const statsTrainingShare = document.getElementById("stats-training-share");
  const statsTrainingSelections = document.getElementById("stats-training-selections");
  const statsAverageTrainings = document.getElementById("stats-average-trainings");
  const statsUsersWithoutTraining = document.getElementById("stats-users-without-training");
  const statsTrainings = document.getElementById("stats-trainings");
  const statsSources = document.getElementById("stats-sources");
  const statsInstitutions = document.getElementById("stats-institutions");
  const statsCourses = document.getElementById("stats-courses");

  const incompletePanel = document.getElementById("incomplete-panel");
  const incompleteRefresh = document.getElementById("incomplete-refresh");
  const incompleteLoading = document.getElementById("incomplete-loading");
  const incompleteContent = document.getElementById("incomplete-content");
  const incompleteBody = document.getElementById("incomplete-body");
  const incompleteEmpty = document.getElementById("incomplete-empty");
  const incompleteError = document.getElementById("incomplete-error");

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
    const metaText = `Показано ${from}-${to} із ${pagination.total}`;
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
        // Запит скасовано - нічого не робимо
        return;
      }
      setErrorState();
    }
  }

  function setIncompleteLoading() {
    if (incompleteLoading) incompleteLoading.hidden = false;
    if (incompleteContent) incompleteContent.hidden = true;
    if (incompleteEmpty) incompleteEmpty.hidden = true;
    if (incompleteError) incompleteError.hidden = true;
    if (incompleteRefresh) incompleteRefresh.disabled = true;
  }

  function renderIncompleteRegistrations(registrations) {
    if (!incompleteBody) return;
    incompleteBody.replaceChildren();
    for (const registration of registrations) {
      incompleteBody.append(createIncompleteRegistrationRow(registration));
    }
    if (incompleteLoading) incompleteLoading.hidden = true;
    if (incompleteError) incompleteError.hidden = true;
    if (incompleteRefresh) incompleteRefresh.disabled = false;
    if (incompleteContent) incompleteContent.hidden = registrations.length === 0;
    if (incompleteEmpty) incompleteEmpty.hidden = registrations.length !== 0;
  }

  function setIncompleteError() {
    if (incompleteLoading) incompleteLoading.hidden = true;
    if (incompleteContent) incompleteContent.hidden = true;
    if (incompleteEmpty) incompleteEmpty.hidden = true;
    if (incompleteError) incompleteError.hidden = false;
    if (incompleteRefresh) incompleteRefresh.disabled = false;
  }

  async function loadIncompleteRegistrations() {
    if (!incompletePanel) return;
    if (state.incompleteAbortController) state.incompleteAbortController.abort();
    state.incompleteAbortController = new AbortController();
    setIncompleteLoading();

    try {
      const response = await fetch("/api/incomplete-registrations", {
        credentials: "same-origin",
        signal: state.incompleteAbortController.signal,
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("request");
      const result = await response.json();
      renderIncompleteRegistrations(
        Array.isArray(result.registrations) ? result.registrations : [],
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setIncompleteError();
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
  const tabStatistics = document.getElementById("tab-statistics");
  const tabSpeakers = document.getElementById("tab-speakers");
  const tabNotifications = document.getElementById("tab-notifications");
  const tabIncomplete = document.getElementById("tab-incomplete");
  const usersPanel = document.getElementById("users-panel");
  const statisticsPanel = document.getElementById("stats-panel");
  const speakerPanel = document.getElementById("speaker-panel");
  const notifPanel = document.getElementById("notif-panel");

  // ── Speakers ───────────────────────────────────────────────────────────

  const speakerBody = document.getElementById("speaker-body");
  const speakerTableScroll = document.getElementById("speaker-table-scroll");
  const speakerEmpty = document.getElementById("speaker-empty");
  const createSpeakerBtn = document.getElementById("create-speaker-btn");
  const speakerOverlay = document.getElementById("speaker-overlay");
  const speakerClose = document.getElementById("speaker-close");
  const speakerCancel = document.getElementById("speaker-cancel");
  const speakerSubmit = document.getElementById("speaker-submit");
  const speakerModalTitle = document.getElementById("speaker-modal-title");
  const speakerTraining = document.getElementById("speaker-training");
  const speakerPhoto = document.getElementById("speaker-photo");
  const speakerPhotoAssets = document.getElementById("speaker-photo-assets");
  const speakerName = document.getElementById("speaker-name");
  const speakerDescription = document.getElementById("speaker-description");
  const speakerDetailedDescription = document.getElementById("speaker-detailed-description");
  const speakerOrder = document.getElementById("speaker-order");
  const speakerActive = document.getElementById("speaker-active");
  const speakerError = document.getElementById("speaker-error");
  let editingSpeakerId = null;
  let speakerTrainings = [];

  function renderStatisticsList(container, items) {
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "stats-empty";
      empty.textContent = "Даних поки немає";
      container.append(empty);
      return;
    }
    const maxCount = Math.max(...items.map((item) => Number(item.count) || 0), 0);
    for (const item of items) container.append(createStatisticsRow(item, maxCount));
  }

  function renderStatistics(data) {
    const summary = data?.summary ?? {};
    const totalUsers = Number(summary.totalUsers) || 0;
    const usersWithTraining = Number(summary.usersWithTraining) || 0;
    const usersWithoutTraining = Number(summary.usersWithoutTraining) || 0;
    const trainingShare = totalUsers > 0 ? Math.round((usersWithTraining / totalUsers) * 100) : 0;
    const averageTrainings = Number(summary.averageTrainingsPerUser) || 0;

    if (statsTotalUsers) statsTotalUsers.textContent = formatStatisticNumber(totalUsers);
    if (statsUsersWithTraining)
      statsUsersWithTraining.textContent = formatStatisticNumber(usersWithTraining);
    if (statsTrainingShare) statsTrainingShare.textContent = `${trainingShare}% від усіх учасників`;
    if (statsTrainingSelections)
      statsTrainingSelections.textContent = formatStatisticNumber(summary.totalTrainingSelections);
    if (statsAverageTrainings) {
      statsAverageTrainings.textContent = `у середньому ${new Intl.NumberFormat("uk-UA", {
        maximumFractionDigits: 1,
      }).format(averageTrainings)} на учасника`;
    }
    if (statsUsersWithoutTraining)
      statsUsersWithoutTraining.textContent = formatStatisticNumber(usersWithoutTraining);

    renderStatisticsList(statsTrainings, data?.trainingSelections);
    renderStatisticsList(statsSources, data?.discoverySources);
    renderStatisticsList(statsInstitutions, data?.institutions);
    renderStatisticsList(statsCourses, data?.courses);

    if (statsLoading) statsLoading.hidden = true;
    if (statsError) statsError.hidden = true;
    if (statsContent) statsContent.hidden = false;
    if (statsRefresh) statsRefresh.disabled = false;
  }

  function setStatisticsLoading() {
    if (statsLoading) statsLoading.hidden = false;
    if (statsContent) statsContent.hidden = true;
    if (statsError) statsError.hidden = true;
    if (statsRefresh) statsRefresh.disabled = true;
  }

  function setStatisticsError() {
    if (statsLoading) statsLoading.hidden = true;
    if (statsContent) statsContent.hidden = true;
    if (statsError) statsError.hidden = false;
    if (statsRefresh) statsRefresh.disabled = false;
  }

  async function loadStatistics() {
    if (!statsPanel) return;
    if (state.statsAbortController) state.statsAbortController.abort();
    state.statsAbortController = new AbortController();
    setStatisticsLoading();

    try {
      const response = await fetch("/api/statistics", {
        credentials: "same-origin",
        signal: state.statsAbortController.signal,
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("request");
      renderStatistics(await response.json());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setStatisticsError();
    }
  }

  function trainingTitle(trainingId) {
    const training = speakerTrainings.find((item) => item.id === trainingId);
    return training?.title ?? trainingId;
  }

  function createSpeakerRow(speaker) {
    const tr = document.createElement("tr");
    const trainingCell = document.createElement("td");
    trainingCell.textContent = trainingTitle(speaker.trainingId);
    tr.append(trainingCell);

    const speakerCell = document.createElement("td");
    const name = document.createElement("div");
    name.className = "cell-primary";
    name.textContent = speaker.name;
    const photo = document.createElement("div");
    photo.className = "cell-secondary speaker-photo-id";
    photo.textContent = speaker.photoFileId ? "Фото додано" : "Без фото";
    speakerCell.append(name, photo);
    const assetMatch = /^asset:([a-z0-9-]+)$/.exec(speaker.photoFileId ?? "");
    if (assetMatch?.[1]) {
      const preview = document.createElement("img");
      preview.className = "speaker-photo-preview";
      preview.src = `/speaker-assets/${encodeURIComponent(assetMatch[1])}`;
      preview.alt = `Фото спікера ${speaker.name}`;
      speakerCell.append(preview);
    }
    tr.append(speakerCell);

    const orderCell = document.createElement("td");
    orderCell.textContent = String(speaker.sortOrder);
    tr.append(orderCell);

    const statusCell = document.createElement("td");
    statusCell.append(createStatusBadge(speaker.isActive ? "active" : "inactive"));
    statusCell.querySelector(".status-badge").textContent = speaker.isActive
      ? "Активний"
      : "Прихований";
    tr.append(statusCell);

    const actions = document.createElement("td");
    const edit = document.createElement("button");
    edit.className = "btn btn-open btn-sm";
    edit.type = "button";
    edit.textContent = "Редагувати";
    edit.addEventListener("click", () => openSpeakerModal(speaker));
    const toggle = document.createElement("button");
    toggle.className = "btn btn-secondary btn-sm";
    toggle.type = "button";
    toggle.textContent = speaker.isActive ? "Приховати" : "Увімкнути";
    toggle.addEventListener("click", () => void toggleSpeaker(speaker));
    const remove = document.createElement("button");
    remove.className = "btn btn-secondary btn-sm";
    remove.type = "button";
    remove.textContent = "Видалити";
    remove.addEventListener("click", () => void deleteSpeaker(speaker));
    actions.append(edit, toggle, remove);
    tr.append(actions);
    return tr;
  }

  function renderSpeakers(speakers) {
    if (!speakerBody || !speakerTableScroll || !speakerEmpty) return;
    speakerBody.replaceChildren();
    if (!Array.isArray(speakers) || speakers.length === 0) {
      speakerTableScroll.hidden = true;
      speakerEmpty.hidden = false;
      return;
    }
    speakerEmpty.hidden = true;
    speakerTableScroll.hidden = false;
    for (const speaker of speakers) speakerBody.append(createSpeakerRow(speaker));
  }

  async function loadSpeakerTrainings() {
    const response = await fetch("/api/trainings", { credentials: "same-origin" });
    if (!response.ok) throw new Error("trainings");
    const data = await response.json();
    speakerTrainings = Array.isArray(data.trainings) ? data.trainings : [];
    if (speakerTraining) {
      while (speakerTraining.options.length > 1) speakerTraining.remove(1);
      for (const training of speakerTrainings) {
        const option = document.createElement("option");
        option.value = training.id;
        option.textContent = training.label;
        speakerTraining.append(option);
      }
    }
  }

  async function loadSpeakerAssets() {
    const response = await fetch("/api/speaker-assets", { credentials: "same-origin" });
    if (!response.ok) throw new Error("speaker-assets");
    const data = await response.json();
    if (!speakerPhotoAssets) return;
    speakerPhotoAssets.replaceChildren();
    for (const asset of Array.isArray(data.assets) ? data.assets : []) {
      const option = document.createElement("option");
      option.value = `asset:${asset.id}`;
      option.label = asset.name;
      speakerPhotoAssets.append(option);
    }
  }

  async function loadSpeakers() {
    try {
      const response = await fetch("/api/speakers", { credentials: "same-origin" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("speakers");
      const data = await response.json();
      renderSpeakers(data.speakers);
    } catch {
      renderSpeakers([]);
    }
  }

  function openSpeakerModal(speaker = null) {
    editingSpeakerId = speaker?.id ?? null;
    if (speakerModalTitle)
      speakerModalTitle.textContent = speaker ? "Редагувати спікера" : "Новий спікер";
    if (speakerTraining) speakerTraining.value = speaker?.trainingId ?? "";
    if (speakerPhoto) speakerPhoto.value = speaker?.photoFileId ?? "";
    if (speakerName) speakerName.value = speaker?.name ?? "";
    if (speakerDescription) speakerDescription.value = speaker?.description ?? "";
    if (speakerDetailedDescription)
      speakerDetailedDescription.value = speaker?.detailedDescription ?? "";
    if (speakerOrder) speakerOrder.value = String(speaker?.sortOrder ?? 0);
    if (speakerActive) speakerActive.checked = speaker?.isActive ?? true;
    if (speakerError) speakerError.hidden = true;
    if (speakerOverlay) speakerOverlay.classList.add("is-visible");
  }

  function closeSpeakerModal() {
    editingSpeakerId = null;
    if (speakerOverlay) speakerOverlay.classList.remove("is-visible");
  }

  async function saveSpeaker() {
    if (speakerError) speakerError.hidden = true;
    const body = {
      trainingId: speakerTraining?.value ?? "",
      photoFileId: speakerPhoto?.value?.trim() ?? "",
      name: speakerName?.value?.trim() ?? "",
      description: speakerDescription?.value?.trim() ?? "",
      detailedDescription: speakerDetailedDescription?.value?.trim() ?? "",
      sortOrder: Number(speakerOrder?.value ?? ""),
      isActive: speakerActive?.checked ?? false,
    };
    if (
      !body.trainingId ||
      !body.name ||
      !body.description ||
      !body.detailedDescription ||
      !Number.isInteger(body.sortOrder) ||
      (body.isActive && !body.photoFileId)
    ) {
      if (speakerError) {
        speakerError.textContent =
          "Заповніть усі обов’язкові поля та вкажіть фото для активного спікера";
        speakerError.hidden = false;
      }
      return;
    }
    if (speakerSubmit) speakerSubmit.disabled = true;
    try {
      const response = await fetch(
        editingSpeakerId ? `/api/speakers/${editingSpeakerId}` : "/api/speakers",
        {
          method: editingSpeakerId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не вдалося зберегти спікера");
      closeSpeakerModal();
      await loadSpeakers();
    } catch (error) {
      if (speakerError) {
        speakerError.textContent =
          error instanceof Error ? error.message : "Не вдалося зберегти спікера";
        speakerError.hidden = false;
      }
    } finally {
      if (speakerSubmit) speakerSubmit.disabled = false;
    }
  }

  async function toggleSpeaker(speaker) {
    try {
      await fetch(`/api/speakers/${speaker.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !speaker.isActive }),
      });
      await loadSpeakers();
    } catch {
      // The next refresh will show the unchanged state.
    }
  }

  async function deleteSpeaker(speaker) {
    if (!window.confirm(`Видалити спікера «${speaker.name}»?`)) return;
    try {
      await fetch(`/api/speakers/${speaker.id}`, { method: "DELETE", credentials: "same-origin" });
      await loadSpeakers();
    } catch {
      // The next refresh will show the unchanged state.
    }
  }

  if (createSpeakerBtn) {
    createSpeakerBtn.addEventListener("click", () => {
      void loadSpeakerTrainings()
        .then(() => loadSpeakerAssets())
        .then(() => openSpeakerModal())
        .catch(() => {
          if (speakerError) {
            speakerError.textContent = "Не вдалося завантажити список тренінгів";
            speakerError.hidden = false;
          }
        });
    });
  }
  if (speakerClose) speakerClose.addEventListener("click", closeSpeakerModal);
  if (speakerCancel) speakerCancel.addEventListener("click", closeSpeakerModal);
  if (speakerOverlay) {
    speakerOverlay.addEventListener("click", (event) => {
      if (event.target === speakerOverlay) closeSpeakerModal();
    });
  }
  if (speakerSubmit) speakerSubmit.addEventListener("click", () => void saveSpeaker());

  function switchTab(tab) {
    state.activeTab = tab;
    if (tab === "users") {
      tabUsers.classList.add("is-active");
      tabStatistics?.classList.remove("is-active");
      tabSpeakers?.classList.remove("is-active");
      tabNotifications.classList.remove("is-active");
      tabIncomplete?.classList.remove("is-active");
      if (usersPanel) usersPanel.style.display = "";
      if (statisticsPanel) statisticsPanel.classList.remove("is-visible");
      if (speakerPanel) speakerPanel.classList.remove("is-visible");
      if (notifPanel) notifPanel.classList.remove("is-visible");
      if (incompletePanel) incompletePanel.classList.remove("is-visible");
    } else if (tab === "statistics") {
      tabUsers.classList.remove("is-active");
      tabStatistics?.classList.add("is-active");
      tabSpeakers?.classList.remove("is-active");
      tabNotifications.classList.remove("is-active");
      tabIncomplete?.classList.remove("is-active");
      if (usersPanel) usersPanel.style.display = "none";
      if (statisticsPanel) statisticsPanel.classList.add("is-visible");
      if (speakerPanel) speakerPanel.classList.remove("is-visible");
      if (notifPanel) notifPanel.classList.remove("is-visible");
      if (incompletePanel) incompletePanel.classList.remove("is-visible");
      void loadStatistics();
    } else if (tab === "speakers") {
      tabUsers.classList.remove("is-active");
      tabStatistics?.classList.remove("is-active");
      tabSpeakers?.classList.add("is-active");
      tabNotifications.classList.remove("is-active");
      tabIncomplete?.classList.remove("is-active");
      if (usersPanel) usersPanel.style.display = "none";
      if (statisticsPanel) statisticsPanel.classList.remove("is-visible");
      if (speakerPanel) speakerPanel.classList.add("is-visible");
      if (notifPanel) notifPanel.classList.remove("is-visible");
      if (incompletePanel) incompletePanel.classList.remove("is-visible");
      void loadSpeakerTrainings().catch(() => undefined);
      void loadSpeakerAssets().catch(() => undefined);
      void loadSpeakers();
    } else if (tab === "incomplete") {
      tabUsers.classList.remove("is-active");
      tabStatistics?.classList.remove("is-active");
      tabSpeakers?.classList.remove("is-active");
      tabNotifications.classList.remove("is-active");
      tabIncomplete?.classList.add("is-active");
      if (usersPanel) usersPanel.style.display = "none";
      if (statisticsPanel) statisticsPanel.classList.remove("is-visible");
      if (speakerPanel) speakerPanel.classList.remove("is-visible");
      if (notifPanel) notifPanel.classList.remove("is-visible");
      if (incompletePanel) incompletePanel.classList.add("is-visible");
      void loadIncompleteRegistrations();
    } else {
      tabUsers.classList.remove("is-active");
      tabStatistics?.classList.remove("is-active");
      tabSpeakers?.classList.remove("is-active");
      tabNotifications.classList.add("is-active");
      tabIncomplete?.classList.remove("is-active");
      if (usersPanel) usersPanel.style.display = "none";
      if (statisticsPanel) statisticsPanel.classList.remove("is-visible");
      if (speakerPanel) speakerPanel.classList.remove("is-visible");
      if (notifPanel) notifPanel.classList.add("is-visible");
      if (incompletePanel) incompletePanel.classList.remove("is-visible");
      void loadNotifications();
    }
  }

  if (tabUsers) tabUsers.addEventListener("click", () => switchTab("users"));
  if (tabStatistics) tabStatistics.addEventListener("click", () => switchTab("statistics"));
  if (tabSpeakers) tabSpeakers.addEventListener("click", () => switchTab("speakers"));
  if (tabIncomplete) tabIncomplete.addEventListener("click", () => switchTab("incomplete"));
  if (tabNotifications)
    tabNotifications.addEventListener("click", () => switchTab("notifications"));

  if (statsRefresh) statsRefresh.addEventListener("click", () => void loadStatistics());
  if (statsRetry) statsRetry.addEventListener("click", () => void loadStatistics());
  if (incompleteRefresh) incompleteRefresh.addEventListener("click", () => void loadIncompleteRegistrations());

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
    titleEl.textContent = notif.title ?? "-";
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
        ["Термін", notif.expiresAt ? formatDate(notif.expiresAt) : "-"],
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
        notifBody.append(createNotifRow(notif, (n, btn) => void loadNotifDetail(n.id, btn)));
      }
    }

    if (pagination && pagination.total > 0) {
      const from = (pagination.page - 1) * pagination.pageSize + 1;
      const to = Math.min(pagination.page * pagination.pageSize, pagination.total);
      if (notifPaginationMeta)
        notifPaginationMeta.textContent = `Показано ${from}-${to} із ${pagination.total}`;
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
        ? userIdsRaw
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => !isNaN(n))
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
      if (notifPreviewCount)
        notifPreviewCount.textContent = `Це повідомлення отримають ${data.count} учасників`;
    } catch {
      // silently fail
    }
  }

  if (notifTrainingSelect)
    notifTrainingSelect.addEventListener("change", () => void updatePreviewCount());

  if (notifSubmitBtn) {
    notifSubmitBtn.addEventListener("click", async () => {
      if (notifError) notifError.hidden = true;

      const title = notifTitleInput?.value?.trim() ?? "";
      const message = notifMessageInput?.value?.trim() ?? "";
      const targetType =
        document.querySelector('input[name="notif-target"]:checked')?.value ?? "all";
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
        body.targetUserIds = raw
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n));
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
