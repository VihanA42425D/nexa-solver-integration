---
title: Contact Nexa documentation support
description: Submit a private ticket for public Nexa documentation defects, integration questions, broken links, and responsible security reports.
---

# Contact documentation support

Use this form to report a documentation defect, broken public artifact,
integration question, or security concern. Include enough detail to reproduce
the problem.

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<div class="contact-panel" markdown>

<form id="nexa-contact-form" novalidate>
  <div class="contact-grid">
    <label for="ticket-name">
      Name <span class="field-note">(optional)</span>
      <input id="ticket-name" name="name" type="text" autocomplete="name" maxlength="100">
    </label>

    <label for="ticket-email">
      Reply-to email
      <input id="ticket-email" name="email" type="email" autocomplete="email" maxlength="254" required>
    </label>
  </div>

  <label for="ticket-category">
    Category
    <select id="ticket-category" name="category" required>
      <option value="">Select a category</option>
      <option value="Documentation defect">Documentation defect</option>
      <option value="Broken link or artifact">Broken link or artifact</option>
      <option value="Integration question">Integration question</option>
      <option value="Security report">Security report</option>
      <option value="Other public-docs issue">Other public-docs issue</option>
    </select>
  </label>

  <label for="ticket-url">
    Affected public URL <span class="field-note">(optional)</span>
    <input id="ticket-url" name="affectedUrl" type="url" inputmode="url" maxlength="500" placeholder="https://docs.vsnexa.com/...">
  </label>

  <label for="ticket-summary">
    Summary
    <input id="ticket-summary" name="summary" type="text" minlength="5" maxlength="140" required>
  </label>

  <label for="ticket-details">
    Details
    <textarea id="ticket-details" name="details" rows="9" minlength="20" maxlength="3000" required></textarea>
  </label>

  <div class="contact-honeypot" aria-hidden="true">
    <label for="ticket-company">Company website</label>
    <input id="ticket-company" name="company" type="text" tabindex="-1" autocomplete="off">
  </div>

  <div class="cf-turnstile" data-sitekey="0x4AAAAAAEal9fmVwKPkUd16" data-action="docs_contact" data-theme="auto"></div>

  <label class="contact-consent" for="ticket-consent">
    <input id="ticket-consent" name="consent" type="checkbox" required>
    I have removed private keys, credentials, seed phrases, personal financial
    data, and other secrets from this ticket.
  </label>

  <button class="md-button md-button--primary" type="submit">Send ticket</button>
  <p id="nexa-contact-status" class="contact-status" role="status" aria-live="polite"></p>
</form>

</div>

## What happens next

After the ticket is accepted, the page shows a reference such as
`NXDOC-20260824-1A2B3C4D`. Keep that reference in follow-up replies. A valid
reply-to address lets support respond.

For reproducible public defects that contain no sensitive information, you can
also use the [GitHub issue tracker](https://github.com/VihanA42425D/nexa-solver-integration/issues).
Follow the repository [security policy](https://github.com/VihanA42425D/nexa-solver-integration/security/policy)
for vulnerability reports, and do not publish exploit details before they can
be reviewed.
