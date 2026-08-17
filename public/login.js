document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.querySelector("#error");
  error.hidden = true;
  const form = new FormData(event.currentTarget);
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("login");
    window.location.assign("/");
  } catch {
    error.hidden = false;
  }
});
