// @vitest-environment jsdom
/**
 * Тести UI-логіки public/app.js.
 *
 * Середовище: jsdom (не тестує CSS-адаптивність, лише DOM-структуру).
 *
 * Примітка щодо дат: використовуємо ISO-рядки та перевіряємо наявність
 * компонентів дати через regex, щоб уникнути залежності від часового поясу CI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  pluralizeTrainings,
  formatTrainingCount,
  parseTrainingLabel,
  createUserRow,
  createUserCard,
  createDetailSection,
  createConsentBadge,
  createDrawerContent,
  init,
} from "../public/app.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Мінімальна анкета для тестів */
function makeUser(overrides = {}) {
  return {
    id: "42",
    telegramUserId: "123456789",
    name: "Іванова Марія Петрівна",
    phoneNumber: "+380991234567",
    telegramUsername: "maria_btw",
    institution: "ВНТУ",
    course: "3",
    trainingIds: ["cybersecurity", "business", "change"],
    trainingDisplay: [
      "10 листопада | 17:00 | Ольга Гунько | Кібербезпека та безпечна цифрова поведінка",
      "12 листопада | 17:00 | Оксана Ломич | Як почати бізнес з нуля без стартового капіталу",
      "13 листопада | 17:00 | Світлана Пенькова | Як подолати страх змін і почати діяти",
    ],
    discoverySource: "Від знайомих",
    personalDataConsent: true,
    personalDataConsentAt: "2026-08-20T14:30:00.000Z",
    personalDataPolicyVersion: "2026-01",
    eventRulesConsent: true,
    eventRulesConsentAt: "2026-08-20T14:30:00.000Z",
    eventRulesVersion: "2026-01",
    createdAt: "2026-08-20T14:30:00.000Z",
    updatedAt: "2026-08-21T09:00:00.000Z",
    ...overrides,
  };
}

// ─── formatDate ──────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("повертає «—» для null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("повертає «—» для undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("повертає «—» для порожнього рядка", () => {
    expect(formatDate("")).toBe("—");
  });

  it("повертає «—» для некоректного значення", () => {
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("форматує коректний ISO-рядок (містить рік і коректний формат)", () => {
    const result = formatDate("2026-08-20T14:30:00.000Z");
    expect(result).toMatch(/2026/);
    // Повинен мати числа (день, місяць, хвилини)
    expect(result).toMatch(/\d/);
    expect(result).not.toBe("—");
  });

  it("приймає об'єкт Date", () => {
    const result = formatDate(new Date("2026-08-20T14:30:00.000Z"));
    expect(result).toMatch(/2026/);
    expect(result).not.toBe("—");
  });
});

// ─── pluralizeTrainings ───────────────────────────────────────────────────────

describe("pluralizeTrainings", () => {
  it("1 тренінг", () => {
    expect(pluralizeTrainings(1)).toBe("1 тренінг");
  });

  it("2 тренінги", () => {
    expect(pluralizeTrainings(2)).toBe("2 тренінги");
  });

  it("3 тренінги", () => {
    expect(pluralizeTrainings(3)).toBe("3 тренінги");
  });

  it("4 тренінги", () => {
    expect(pluralizeTrainings(4)).toBe("4 тренінги");
  });

  it("5 тренінгів", () => {
    expect(pluralizeTrainings(5)).toBe("5 тренінгів");
  });

  it("11 тренінгів (виняток mod100)", () => {
    expect(pluralizeTrainings(11)).toBe("11 тренінгів");
  });

  it("12 тренінгів (виняток mod100)", () => {
    expect(pluralizeTrainings(12)).toBe("12 тренінгів");
  });

  it("21 тренінг", () => {
    expect(pluralizeTrainings(21)).toBe("21 тренінг");
  });

  it("101 тренінг", () => {
    expect(pluralizeTrainings(101)).toBe("101 тренінг");
  });

  it("0 тренінгів", () => {
    expect(pluralizeTrainings(0)).toBe("0 тренінгів");
  });
});

// ─── formatTrainingCount ─────────────────────────────────────────────────────

describe("formatTrainingCount", () => {
  it("повертає порожній рядок для порожнього масиву", () => {
    expect(formatTrainingCount([])).toBe("");
  });

  it("повертає порожній рядок для null", () => {
    expect(formatTrainingCount(null)).toBe("");
  });

  it("повертає порожній рядок для undefined", () => {
    expect(formatTrainingCount(undefined)).toBe("");
  });

  it("повертає «3 тренінги» для масиву з 3 елементів", () => {
    expect(formatTrainingCount(["a", "b", "c"])).toBe("3 тренінги");
  });

  it("повертає «1 тренінг» для масиву з 1 елемента", () => {
    expect(formatTrainingCount(["x"])).toBe("1 тренінг");
  });

  it("повертає «7 тренінгів» для 7 елементів", () => {
    expect(formatTrainingCount(["a", "b", "c", "d", "e", "f", "g"])).toBe("7 тренінгів");
  });
});

// ─── parseTrainingLabel ──────────────────────────────────────────────────────

describe("parseTrainingLabel", () => {
  it("розбирає стандартний рядок", () => {
    const result = parseTrainingLabel(
      "10 листопада | 17:00 | Ольга Гунько | Кібербезпека та безпечна цифрова поведінка",
    );
    expect(result.date).toBe("10 листопада");
    expect(result.time).toBe("17:00");
    expect(result.speaker).toBe("Ольга Гунько");
    expect(result.title).toBe("Кібербезпека та безпечна цифрова поведінка");
  });

  it("назва з «|» у тексті об'єднується правильно", () => {
    const result = parseTrainingLabel("15 листопада | 11:00 | Спікер | Назва | з пайпом");
    expect(result.title).toBe("Назва | з пайпом");
  });

  it("порожній рядок не ламає парсер", () => {
    const result = parseTrainingLabel("");
    expect(result.date).toBe("");
    expect(result.time).toBe("");
    expect(result.speaker).toBe("");
    expect(result.title).toBe("");
  });
});

// ─── createUserRow ───────────────────────────────────────────────────────────

describe("createUserRow", () => {
  it("рендерить рядок з 7 комірками", () => {
    const user = makeUser();
    const row = createUserRow(user, () => {});
    expect(row.querySelectorAll("td").length).toBe(7);
  });

  it("показує ПІБ учасника", () => {
    const user = makeUser({ name: "Коваль Тест" });
    const row = createUserRow(user, () => {});
    expect(row.textContent).toContain("Коваль Тест");
  });

  it("показує кількість тренінгів badge, а не повний текст", () => {
    const user = makeUser();
    const row = createUserRow(user, () => {});
    // Badge показує лише «3 тренінги»
    expect(row.querySelector(".training-badge")?.textContent).toBe("3 тренінги");
    // Повний текст тренінгу не повинен бути в рядку таблиці
    expect(row.textContent).not.toContain("Кібербезпека та безпечна цифрова поведінка");
  });

  it("показує «—» для відсутніх тренінгів", () => {
    const user = makeUser({ trainingIds: [], trainingDisplay: [] });
    const row = createUserRow(user, () => {});
    expect(row.querySelector(".training-none")?.textContent).toBe("—");
  });

  it("показує Telegram з @", () => {
    const user = makeUser({ telegramUsername: "test_user" });
    const row = createUserRow(user, () => {});
    expect(row.textContent).toContain("@test_user");
  });

  it("показує «—» для відсутнього Telegram", () => {
    const user = makeUser({ telegramUsername: null });
    const row = createUserRow(user, () => {});
    // Другий рядок контактів
    const contactsTd = row.querySelectorAll("td")[1];
    expect(contactsTd?.querySelector(".cell-secondary")?.textContent).toBe("—");
  });

  it("кнопка «Відкрити» викликає callback", () => {
    const user = makeUser();
    const onOpen = vi.fn();
    const row = createUserRow(user, onOpen);
    const btn = row.querySelector("button");
    btn?.click();
    expect(onOpen).toHaveBeenCalledWith(user, btn);
  });

  it("кнопка «Відкрити» має aria-label", () => {
    const user = makeUser({ name: "Тест Тест" });
    const row = createUserRow(user, () => {});
    const btn = row.querySelector("button");
    expect(btn?.getAttribute("aria-label")).toContain("Тест Тест");
  });

  it("не використовує innerHTML для даних користувача (XSS-безпека)", () => {
    const xssName = "<img src=x onerror=alert(1)>";
    const user = makeUser({ name: xssName });
    const row = createUserRow(user, () => {});
    // innerHTML рядка не повинен містити тег img вставлений через дані
    const nameEl = row.querySelector(".cell-primary");
    expect(nameEl?.textContent).toBe(xssName);
    // Перевіряємо що тег не виконується — innerHTML не містить реального <img>
    expect(nameEl?.innerHTML).toBe(
      // textContent встановлений — HTML-символи екрановані браузером
      xssName.replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    );
  });
});

// ─── createUserCard ──────────────────────────────────────────────────────────

describe("createUserCard", () => {
  it("містить ПІБ", () => {
    const user = makeUser({ name: "Мобільна Картка" });
    const card = createUserCard(user, () => {});
    expect(card.querySelector(".user-card__name")?.textContent).toBe("Мобільна Картка");
  });

  it("містить телефон", () => {
    const user = makeUser({ phoneNumber: "+380501112233" });
    const card = createUserCard(user, () => {});
    expect(card.textContent).toContain("+380501112233");
  });

  it("містить кількість тренінгів", () => {
    const user = makeUser({ trainingIds: ["a", "b"] });
    const card = createUserCard(user, () => {});
    expect(card.textContent).toContain("2 тренінги");
  });

  it("містить кнопку «Відкрити»", () => {
    const user = makeUser();
    const card = createUserCard(user, () => {});
    expect(card.querySelector("button")?.textContent).toBe("Відкрити");
  });

  it("кнопка викликає callback", () => {
    const user = makeUser();
    const onOpen = vi.fn();
    const card = createUserCard(user, onOpen);
    card.querySelector("button")?.click();
    expect(onOpen).toHaveBeenCalledWith(user, expect.any(HTMLButtonElement));
  });
});

// ─── createDetailSection ─────────────────────────────────────────────────────

describe("createDetailSection", () => {
  it("рендерить заголовок секції", () => {
    const section = createDetailSection("Контакти", [["Телефон", "+38099"]]);
    expect(section.querySelector(".detail-section__title")?.textContent).toBe("Контакти");
  });

  it("рендерить поля з label і value", () => {
    const section = createDetailSection("Навчання", [
      ["Заклад", "ВНТУ"],
      ["Курс", "3 курс"],
    ]);
    const labels = Array.from(section.querySelectorAll(".detail-label")).map(
      (el) => el.textContent,
    );
    const values = Array.from(section.querySelectorAll(".detail-value")).map(
      (el) => el.textContent,
    );
    expect(labels).toContain("Заклад");
    expect(labels).toContain("Курс");
    expect(values).toContain("ВНТУ");
    expect(values).toContain("3 курс");
  });

  it("показує «—» для порожніх значень", () => {
    const section = createDetailSection("Тест", [["Поле", ""]]);
    const value = section.querySelector(".detail-value");
    expect(value?.textContent).toBe("—");
  });
});

// ─── createConsentBadge ──────────────────────────────────────────────────────

describe("createConsentBadge", () => {
  it("«Прийнято» для true зі success-стилем", () => {
    const badge = createConsentBadge(true, "2026-08-20T14:30:00.000Z");
    const badgeEl = badge.querySelector(".badge");
    expect(badgeEl?.classList.contains("badge-success")).toBe(true);
    expect(badgeEl?.textContent).toContain("Прийнято");
  });

  it("«Не прийнято» для false з neutral-стилем", () => {
    const badge = createConsentBadge(false, null);
    const badgeEl = badge.querySelector(".badge");
    expect(badgeEl?.classList.contains("badge-neutral")).toBe(true);
    expect(badgeEl?.textContent).toContain("Не прийнято");
  });

  it("показує дату для прийнятої згоди", () => {
    const badge = createConsentBadge(true, "2026-08-20T14:30:00.000Z");
    // Дата рендериться окремим елементом після badge
    const children = Array.from(badge.children);
    expect(children.length).toBe(2);
    // Другий елемент — дата
    expect(children[1]?.textContent).toMatch(/2026/);
  });

  it("не показує дату для відхиленої згоди", () => {
    const badge = createConsentBadge(false, "2026-08-20T14:30:00.000Z");
    const children = Array.from(badge.children);
    expect(children.length).toBe(1);
  });

  it("badge має aria-label (не лише колір)", () => {
    const accepted = createConsentBadge(true, null);
    expect(accepted.querySelector(".badge")?.getAttribute("aria-label")).toBe("Прийнято");

    const declined = createConsentBadge(false, null);
    expect(declined.querySelector(".badge")?.getAttribute("aria-label")).toBe("Не прийнято");
  });
});

// ─── createDrawerContent ─────────────────────────────────────────────────────

describe("createDrawerContent", () => {
  it("рендерить всі 7 секцій", () => {
    const user = makeUser();
    const frag = createDrawerContent(user);
    const container = document.createElement("div");
    container.appendChild(frag);

    const sections = container.querySelectorAll(".detail-section");
    expect(sections.length).toBe(7);
  });

  it("секція тренінгів показує картки для кожного тренінгу", () => {
    const user = makeUser();
    const frag = createDrawerContent(user);
    const container = document.createElement("div");
    container.appendChild(frag);

    const trainingCards = container.querySelectorAll(".training-card");
    expect(trainingCards.length).toBe(3);
  });

  it("картка тренінгу містить назву (не обрізає через |)", () => {
    const user = makeUser({
      trainingDisplay: ["15 листопада | 11:00 | Спікер | Назва тренінгу | з пайпом у тексті"],
    });
    const frag = createDrawerContent(user);
    const container = document.createElement("div");
    container.appendChild(frag);

    const cardTitle = container.querySelector(".training-card__title");
    expect(cardTitle?.textContent).toBe("Назва тренінгу | з пайпом у тексті");
  });

  it("показує «Тренінгів не обрано» якщо trainingDisplay порожній", () => {
    const user = makeUser({ trainingIds: [], trainingDisplay: [] });
    const frag = createDrawerContent(user);
    const container = document.createElement("div");
    container.appendChild(frag);

    expect(container.querySelector(".training-empty")?.textContent).toBe("Тренінгів не обрано");
  });

  it("відображає конkретні дані анкети в деталях", () => {
    const user = makeUser({
      name: "Петренко Олег",
      institution: "ВНМУ",
      course: "2",
    });
    const frag = createDrawerContent(user);
    const container = document.createElement("div");
    container.appendChild(frag);

    expect(container.textContent).toContain("Петренко Олег");
    expect(container.textContent).toContain("ВНМУ");
    expect(container.textContent).toContain("2 курс");
  });

  it("згоди відображаються через badge, а не одним рядком", () => {
    const user = makeUser({
      personalDataConsent: true,
      personalDataConsentAt: "2026-08-20T14:30:00.000Z",
      eventRulesConsent: false,
      eventRulesConsentAt: null,
    });
    const frag = createDrawerContent(user);
    const container = document.createElement("div");
    container.appendChild(frag);

    const badges = container.querySelectorAll(".badge");
    expect(badges.length).toBeGreaterThanOrEqual(2);
    // Не повинно бути одного рядка "Так (2026-01) 22.08.26"
    expect(container.textContent).not.toMatch(/Так \(\d{4}-\d{2}\)/);
  });

  it("XSS-безпека: HTML у даних анкети не виконується", () => {
    const user = makeUser({
      name: '<script>alert("xss")</script>',
      institution: "<img src=x onerror=alert(2)>",
    });
    const frag = createDrawerContent(user);
    const container = document.createElement("div");
    container.appendChild(frag);

    // Тег script не повинен з'явитися як DOM-елемент
    expect(container.querySelectorAll("script").length).toBe(0);
    expect(container.querySelectorAll("img").length).toBe(0);
  });
});

// ─── init() — інтеграційний тест через jsdom ─────────────────────────────────

describe("init (DOM integration)", () => {
  let originalFetch;

  beforeEach(() => {
    // Мінімальна DOM-структура сторінки
    document.body.innerHTML = `
      <div class="page-wrapper">
        <span id="total-count" hidden></span>
        <button id="logout"></button>
        <form id="search-form">
          <div class="search-input-wrap">
            <input id="search" type="search" />
            <button id="search-clear" hidden>×</button>
          </div>
          <button id="search-btn" type="submit">Знайти</button>
        </form>
        <section id="table-section">
          <div id="skeleton"></div>
          <div id="table-scroll" hidden>
            <table><colgroup><col/><col/><col/><col/><col/><col/><col/></colgroup>
            <thead><tr>
              <th>Учасник</th><th>Контакти</th><th>Навчання</th>
              <th>Тренінги</th><th>Джерело</th><th>Подано</th><th></th>
            </tr></thead>
            <tbody id="users-body"></tbody></table>
          </div>
          <div id="empty-state" hidden>
            <div id="empty-title"></div>
            <div id="empty-desc"></div>
            <button id="clear-search-btn" hidden></button>
          </div>
          <div id="error-state" hidden>
            <button id="retry-btn">Спробувати ще раз</button>
          </div>
        </section>
        <footer id="pagination-bar" hidden>
          <span id="pagination-meta"></span>
          <button id="previous">← Попередня</button>
          <button id="next">Наступна →</button>
        </footer>
        <section id="cards-list"></section>
        <footer id="mobile-pagination-bar" hidden>
          <span id="mobile-pagination-meta"></span>
          <button id="mobile-previous">← Попередня</button>
          <button id="mobile-next">Наступна →</button>
        </footer>
        <div id="drawer-overlay" class="drawer-overlay"></div>
        <aside id="drawer" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
          <div class="drawer-header">
            <h2 id="drawer-title"></h2>
            <button id="drawer-close">×</button>
          </div>
          <div id="drawer-body"></div>
        </aside>
      </div>
    `;

    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = "";
    document.body.classList.remove("drawer-open");
  });

  function mockFetch(users = [], total = 0, page = 1) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        users,
        pagination: {
          page,
          pageSize: 20,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        },
      }),
    });
  }

  function mockFetchError() {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
  }

  // ── Loading state ───────────────────────────────────────────────────────

  it("skeleton видимий під час завантаження", () => {
    mockFetch([], 0);
    init();
    const skeleton = document.getElementById("skeleton");
    // Одразу після init (до resolve fetch) skeleton не прихований
    expect(skeleton?.hidden).toBe(false);
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  it("порожній стан відображається коли нема анкет", async () => {
    mockFetch([], 0);
    init();
    await vi.waitFor(() => {
      expect(document.getElementById("empty-state")?.hidden).toBe(false);
    });
    expect(document.getElementById("empty-title")?.textContent).toBe("Анкет поки немає");
  });

  // ── Error state ─────────────────────────────────────────────────────────

  it("error state відображається при помилці мережі", async () => {
    mockFetchError();
    init();
    await vi.waitFor(() => {
      expect(document.getElementById("error-state")?.hidden).toBe(false);
    });
  });

  it("retry кнопка повторює запит", async () => {
    mockFetchError();
    init();
    await vi.waitFor(() => {
      expect(document.getElementById("error-state")?.hidden).toBe(false);
    });

    // Тепер мок повертає успіх
    mockFetch([], 0);
    document.getElementById("retry-btn")?.click();

    await vi.waitFor(() => {
      expect(document.getElementById("empty-state")?.hidden).toBe(false);
    });
  });

  // ── Table render ────────────────────────────────────────────────────────

  it("таблиця рендерить рядки з анкетами", async () => {
    mockFetch([makeUser(), makeUser({ id: "43", name: "Іншой Учасник" })], 2);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(2);
    });
  });

  it("повний текст тренінгів не з'являється в рядку таблиці", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });
    const row = document.querySelector("#users-body tr");
    expect(row?.textContent).not.toContain("Кібербезпека та безпечна цифрова поведінка");
    expect(row?.querySelector(".training-badge")?.textContent).toBe("3 тренінги");
  });

  // ── Pagination ──────────────────────────────────────────────────────────

  it("pagination-meta показує «Показано 1–1 із 1»", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.getElementById("pagination-meta")?.textContent).toContain(
        "Показано 1–1 із 1",
      );
    });
  });

  it("кнопка «Попередня» disabled на першій сторінці", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      const prev = document.getElementById("previous");
      expect(prev?.disabled).toBe(true);
    });
  });

  it("кнопка «Наступна» disabled якщо одна сторінка", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      const next = document.getElementById("next");
      expect(next?.disabled).toBe(true);
    });
  });

  it("«Наступна» переходить на наступну сторінку", async () => {
    // Перша сторінка: 20 анкет із 25
    const users20 = Array.from({ length: 20 }, (_, i) => makeUser({ id: String(i) }));
    mockFetch(users20, 25, 1);
    init();

    await vi.waitFor(() => {
      expect(document.getElementById("next")?.disabled).toBe(false);
    });

    // Кнопка Наступна
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        users: [makeUser({ id: "99" })],
        pagination: { page: 2, pageSize: 20, total: 25, totalPages: 2 },
      }),
    });
    globalThis.fetch = fetchSpy;

    document.getElementById("next")?.click();

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      const url = fetchSpy.mock.calls[0][0];
      expect(url).toContain("page=2");
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────

  it("пошук передає search-параметр у fetch", async () => {
    mockFetch([], 0);
    init();
    await vi.waitFor(() => expect(document.getElementById("empty-state")?.hidden).toBe(false));

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        users: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }),
    });
    globalThis.fetch = fetchSpy;

    const searchInput = /** @type {HTMLInputElement} */ document.getElementById("search");
    searchInput.value = "Марія";
    document
      .getElementById("search-form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      expect(fetchSpy.mock.calls[0][0]).toContain("search=%D0%9C%D0%B0%D1%80%D1%96%D1%8F");
    });
  });

  it("пошук показує повідомлення з запитом у empty state", async () => {
    mockFetch([], 0);
    init();

    const searchInput = /** @type {HTMLInputElement} */ document.getElementById("search");
    searchInput.value = "Тест запит";

    // Submit з тим самим моком
    document
      .getElementById("search-form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("empty-title")?.textContent).toBe("Нічого не знайдено");
    });
    expect(document.getElementById("empty-desc")?.textContent).toContain("Тест запит");
  });

  it("очищення пошуку прибирає запит та перезавантажує", async () => {
    mockFetch([], 0);
    init();
    await vi.waitFor(() => expect(document.getElementById("empty-state")?.hidden).toBe(false));

    const searchInput = /** @type {HTMLInputElement} */ document.getElementById("search");
    searchInput.value = "щось";
    searchInput.dispatchEvent(new Event("input"));

    const clearBtn = document.getElementById("search-clear");
    expect(clearBtn?.hidden).toBe(false);

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        users: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }),
    });
    globalThis.fetch = fetchSpy;

    clearBtn?.click();

    expect(searchInput.value).toBe("");
    expect(clearBtn?.hidden).toBe(true);

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      expect(fetchSpy.mock.calls[0][0]).toContain("search=");
    });

    // search= порожній
    const url = new URL(fetchSpy.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("search")).toBe("");
  });

  // ── Drawer ──────────────────────────────────────────────────────────────

  it("відкриває drawer після натискання «Відкрити»", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });

    const openBtn = document.querySelector("#users-body .btn-open");
    openBtn?.click();

    const drawer = document.getElementById("drawer");
    expect(drawer?.getAttribute("aria-hidden")).toBe("false");
  });

  it("drawer містить ПІБ учасника в заголовку", async () => {
    mockFetch([makeUser({ name: "Тестовий Учасник" })], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });

    document.querySelector("#users-body .btn-open")?.click();

    expect(document.getElementById("drawer-title")?.textContent).toBe("Тестовий Учасник");
  });

  it("закриває drawer через кнопку ×", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });

    document.querySelector("#users-body .btn-open")?.click();
    expect(document.getElementById("drawer")?.getAttribute("aria-hidden")).toBe("false");

    document.getElementById("drawer-close")?.click();
    expect(document.getElementById("drawer")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("закриває drawer через Escape", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });

    document.querySelector("#users-body .btn-open")?.click();
    expect(document.getElementById("drawer")?.getAttribute("aria-hidden")).toBe("false");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById("drawer")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("закриває drawer через overlay", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });

    document.querySelector("#users-body .btn-open")?.click();
    document.getElementById("drawer-overlay")?.click();
    expect(document.getElementById("drawer")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("блокує прокручування сторінки при відкритому drawer", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });

    document.querySelector("#users-body .btn-open")?.click();
    expect(document.body.classList.contains("drawer-open")).toBe(true);

    document.getElementById("drawer-close")?.click();
    expect(document.body.classList.contains("drawer-open")).toBe(false);
  });

  // ── Mobile cards ────────────────────────────────────────────────────────

  it("мобільні картки рендеруються паралельно з таблицею", async () => {
    mockFetch([makeUser(), makeUser({ id: "55" })], 2);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#cards-list .user-card").length).toBe(2);
    });
  });

  it("картка містить усі потрібні поля", async () => {
    mockFetch([makeUser()], 1);
    init();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("#cards-list .user-card").length).toBe(1);
    });
    const card = document.querySelector(".user-card");
    expect(card?.textContent).toContain("Іванова Марія Петрівна");
    expect(card?.textContent).toContain("+380991234567");
    expect(card?.textContent).toContain("@maria_btw");
    expect(card?.textContent).toContain("ВНТУ");
    expect(card?.textContent).toContain("3 тренінги");
  });

  // ── AbortController ─────────────────────────────────────────────────────

  it("попередній запит скасовується при новому пошуку", async () => {
    // Перший запит «завислий»
    let resolveFirst;
    const firstFetch = new Promise((res) => {
      resolveFirst = res;
    });

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return firstFetch;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          users: [makeUser()],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }),
      });
    });

    init();

    // Другий запит (пошук)
    const searchInput = /** @type {HTMLInputElement} */ document.getElementById("search");
    searchInput.value = "новий";
    document
      .getElementById("search-form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.querySelectorAll("#users-body tr").length).toBe(1);
    });

    // Перший запит вирішується — не повинен перезаписати результат
    resolveFirst({
      ok: true,
      status: 200,
      json: async () => ({
        users: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      }),
    });

    // Результат другого запиту залишається
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelectorAll("#users-body tr").length).toBe(1);
  });
});
