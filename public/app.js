const state = { page: 1, pageSize: 20, search: "" };
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search");
const usersBody = document.querySelector("#users-body");
const empty = document.querySelector("#empty");
const error = document.querySelector("#error");
const meta = document.querySelector("#meta");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(value),
      )
    : "";
}
function addCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value == null ? "" : String(value);
  row.append(cell);
}
function formatConsent(value, version, at) {
  return value ? `Так (${version ?? "—"})\n${formatDate(at)}` : "Ні";
}
function formatTrainings(user) {
  return (user.trainingDisplay ?? user.trainingIds ?? user.trainings ?? []).join("\n");
}

function render(users, pagination) {
  usersBody.replaceChildren();
  empty.hidden = users.length !== 0;
  for (const user of users) {
    const row = document.createElement("tr");
    addCell(row, user.id);
    addCell(row, user.name);
    addCell(row, user.phoneNumber);
    addCell(row, user.telegramUsername);
    addCell(row, user.institution);
    addCell(row, user.course);
    addCell(row, formatTrainings(user), "trainings");
    addCell(row, user.discoverySource);
    addCell(
      row,
      formatConsent(
        user.personalDataConsent,
        user.personalDataPolicyVersion,
        user.personalDataConsentAt,
      ),
    );
    addCell(
      row,
      formatConsent(user.eventRulesConsent, user.eventRulesVersion, user.eventRulesConsentAt),
    );
    addCell(row, user.telegramUserId);
    addCell(row, formatDate(user.createdAt));
    addCell(row, formatDate(user.updatedAt));
    usersBody.append(row);
  }
  meta.textContent = `Записів: ${pagination.total} | Сторінка ${pagination.page} з ${pagination.totalPages}`;
  previous.disabled = pagination.page <= 1;
  next.disabled = pagination.page >= pagination.totalPages;
}

async function loadUsers() {
  error.hidden = true;
  meta.textContent = "Завантаження...";
  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.pageSize),
    search: state.search,
  });
  try {
    const response = await fetch(`/api/users?${params}`, { credentials: "same-origin" });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (!response.ok) throw new Error("request");
    const result = await response.json();
    render(result.users, result.pagination);
  } catch {
    usersBody.replaceChildren();
    empty.hidden = true;
    error.hidden = false;
    meta.textContent = "Помилка завантаження";
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.search = searchInput.value.trim();
  state.page = 1;
  void loadUsers();
});
previous.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    void loadUsers();
  }
});
next.addEventListener("click", () => {
  state.page += 1;
  void loadUsers();
});
document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  window.location.assign("/login");
});
void loadUsers();
