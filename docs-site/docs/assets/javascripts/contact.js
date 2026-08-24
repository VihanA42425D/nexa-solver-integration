(() => {
  "use strict";

  const form = document.querySelector("#nexa-contact-form");
  if (!(form instanceof HTMLFormElement)) return;

  const status = document.querySelector("#nexa-contact-status");
  const button = form.querySelector('button[type="submit"]');

  const setStatus = (message, state = "") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const turnstileToken = String(data.get("cf-turnstile-response") ?? "");
    if (!turnstileToken) {
      setStatus("Complete the anti-bot check before sending.", "error");
      return;
    }

    const payload = {
      name: data.get("name"),
      email: data.get("email"),
      category: data.get("category"),
      affectedUrl: data.get("affectedUrl"),
      summary: data.get("summary"),
      details: data.get("details"),
      company: data.get("company"),
      consent: data.get("consent") === "on",
      turnstileToken,
    };

    if (button) button.disabled = true;
    form.setAttribute("aria-busy", "true");
    setStatus("Sending ticket…");

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true || typeof result.ticketId !== "string") {
        throw new Error("Ticket delivery failed");
      }

      form.reset();
      window.turnstile?.reset();
      setStatus(`Ticket ${result.ticketId} was sent. Keep this reference for follow-up.`, "success");
    } catch {
      window.turnstile?.reset();
      setStatus("The ticket could not be sent. Please wait a moment and try again.", "error");
    } finally {
      form.removeAttribute("aria-busy");
      if (button) button.disabled = false;
    }
  });
})();
