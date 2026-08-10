import nodemailer, { type Transporter } from "nodemailer";
import { getSetting } from "./data";

/**
 * Outgoing email.
 *
 * Works with any SMTP server; Gmail is the common case, so Settings offers it
 * as a preset. Sending never throws — a mail outage should never lose a rental
 * application or block a payment being recorded — so callers get a result
 * object and the app carries on either way.
 */

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  /** Where landlord notifications go; falls back to the SMTP user. */
  notifyEmail: string;
};

export async function smtpConfig(): Promise<SmtpConfig> {
  const [host, port, user, password, fromName, fromEmail, notifyEmail, secure] = await Promise.all([
    getSetting("smtp_host"),
    getSetting("smtp_port"),
    getSetting("smtp_user"),
    getSetting("smtp_password"),
    getSetting("smtp_from_name"),
    getSetting("smtp_from_email"),
    getSetting("smtp_notify_email"),
    getSetting("smtp_secure"),
  ]);

  const resolvedHost = process.env.SMTP_HOST?.trim() || host;
  const resolvedUser = process.env.SMTP_USER?.trim() || user;
  const resolvedPort = Number(process.env.SMTP_PORT?.trim() || port || 587);

  return {
    host: resolvedHost,
    port: Number.isFinite(resolvedPort) ? resolvedPort : 587,
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: (process.env.SMTP_SECURE?.trim() || secure) === "true" || resolvedPort === 465,
    user: resolvedUser,
    password: process.env.SMTP_PASSWORD?.trim() || password,
    fromName: process.env.SMTP_FROM_NAME?.trim() || fromName || "OpenTenant",
    fromEmail: process.env.SMTP_FROM_EMAIL?.trim() || fromEmail || resolvedUser,
    notifyEmail: process.env.SMTP_NOTIFY_EMAIL?.trim() || notifyEmail || resolvedUser,
  };
}

export async function emailConfigured(): Promise<boolean> {
  const config = await smtpConfig();
  return Boolean(config.host && config.fromEmail);
}

function transport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    // Some local/self-hosted relays accept mail without credentials.
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const config = await smtpConfig();
  if (!config.host || !config.fromEmail) {
    return { ok: false, error: "Email isn't set up yet — add SMTP details in Settings." };
  }
  if (!options.to) {
    return { ok: false, error: "No recipient address." };
  }

  try {
    const info = await transport(config).sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text ?? stripHtml(options.html),
      replyTo: options.replyTo || config.notifyEmail || undefined,
    });
    return { ok: true, id: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { ok: false, error: message };
  }
}

/** Fire-and-forget: used on paths where a mail failure must not block the action. */
export async function sendEmailQuietly(options: Parameters<typeof sendEmail>[0]): Promise<void> {
  try {
    const result = await sendEmail(options);
    if (!result.ok) console.warn(`[email] ${options.subject} → ${options.to}: ${result.error}`);
  } catch {
    // Never let mail break the caller.
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-3]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ---------- Templates ----------

function shell(businessName: string, heading: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f2f4f9;font:15px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;color:#101828;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e6ee;border-radius:12px;overflow:hidden;">
    <div style="padding:18px 24px;border-bottom:1px solid #eef1f6;font-weight:700;">${escapeHtml(businessName)}</div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 12px;font-size:19px;line-height:1.3;">${escapeHtml(heading)}</h1>
      ${body}
      ${
        cta
          ? `<p style="margin:22px 0 0;">
               <a href="${cta.url}" style="display:inline-block;background:#2f6fed;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;">${escapeHtml(cta.label)}</a>
             </p>
             <p style="margin:10px 0 0;font-size:12px;color:#5b6478;word-break:break-all;">${cta.url}</p>`
          : ""
      }
    </div>
  </div>
  <p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#5b6478;text-align:center;">
    Sent by ${escapeHtml(businessName)} using OpenTenant.
  </p>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;">${text}</p>`;
}

export const templates = {
  applicationReceived(businessName: string, applicantName: string, propertyLabel: string) {
    return {
      subject: `We received your application — ${propertyLabel}`,
      html: shell(
        businessName,
        `Thanks, ${escapeHtml(applicantName)} — we got your application`,
        p(`Your application for <strong>${escapeHtml(propertyLabel)}</strong> has been received.`) +
          p("We'll review it and get back to you, usually within a couple of days.") +
          p("If screening is required, you'll get a separate invitation from a screening bureau. Reply to this email with any questions.")
      ),
    };
  },

  newApplicationAlert(businessName: string, applicantName: string, propertyLabel: string, income: number, appUrl: string) {
    return {
      subject: `New application: ${applicantName} — ${propertyLabel}`,
      html: shell(
        businessName,
        "New rental application",
        p(`<strong>${escapeHtml(applicantName)}</strong> applied for <strong>${escapeHtml(propertyLabel)}</strong>.`) +
          p(`Stated monthly income: <strong>$${income.toLocaleString()}</strong>`),
        { label: "Review the application", url: `${appUrl}/applications` }
      ),
    };
  },

  applicationApproved(businessName: string, applicantName: string, propertyLabel: string) {
    return {
      subject: `Good news about your application — ${propertyLabel}`,
      html: shell(
        businessName,
        `You're approved, ${escapeHtml(applicantName)}!`,
        p(`Your application for <strong>${escapeHtml(propertyLabel)}</strong> has been approved.`) +
          p("We'll follow up shortly with the lease to review and sign, plus move-in details.")
      ),
    };
  },

  applicationDenied(businessName: string, applicantName: string, propertyLabel: string) {
    return {
      subject: `Update on your application — ${propertyLabel}`,
      html: shell(
        businessName,
        "Update on your application",
        p(`Hi ${escapeHtml(applicantName)},`) +
          p(`Thank you for applying for <strong>${escapeHtml(propertyLabel)}</strong>. We're not moving forward with your application at this time.`) +
          p("We appreciate your interest and wish you the best in your search.")
      ),
    };
  },

  portalInvite(businessName: string, tenantName: string, portalUrl: string) {
    return {
      subject: `Your tenant portal — ${businessName}`,
      html: shell(
        businessName,
        `Welcome, ${escapeHtml(tenantName)}`,
        p("Use your private link to see what's due, tell us when you've paid, view your payment history, and send maintenance requests.") +
          p("<strong>Keep this link private</strong> — anyone with it can see your tenancy details."),
        { label: "Open your portal", url: portalUrl }
      ),
    };
  },

  paymentReminder(businessName: string, tenantName: string, amount: string, dueDate: string, pastDue: boolean, portalUrl: string, instructions: string) {
    return {
      subject: pastDue ? `Past due: ${amount} — ${businessName}` : `Rent reminder: ${amount} due ${dueDate}`,
      html: shell(
        businessName,
        pastDue ? "A payment is past due" : "Friendly rent reminder",
        p(`Hi ${escapeHtml(tenantName)},`) +
          p(
            pastDue
              ? `Our records show <strong>${amount}</strong>, due ${escapeHtml(dueDate)}, hasn't been received yet.`
              : `This is a reminder that <strong>${amount}</strong> is due on <strong>${escapeHtml(dueDate)}</strong>.`
          ) +
          (instructions ? p(`How to pay:<br />${escapeHtml(instructions).replace(/\n/g, "<br />")}`) : "") +
          p("Already paid? Record it in your portal and we'll confirm."),
        { label: "Open your portal", url: portalUrl }
      ),
    };
  },

  paymentReceipt(businessName: string, tenantName: string, amount: string, paidDate: string, method: string, portalUrl: string) {
    return {
      subject: `Payment received — ${amount}`,
      html: shell(
        businessName,
        "Payment received — thank you",
        p(`Hi ${escapeHtml(tenantName)},`) +
          p(`We've recorded your payment of <strong>${amount}</strong> on ${escapeHtml(paidDate)} via ${escapeHtml(method)}.`) +
          p("This email is your receipt."),
        { label: "View payment history", url: portalUrl }
      ),
    };
  },

  maintenanceReceived(businessName: string, tenantName: string, title: string, portalUrl: string) {
    return {
      subject: `We got your maintenance request: ${title}`,
      html: shell(
        businessName,
        "Maintenance request received",
        p(`Hi ${escapeHtml(tenantName)},`) +
          p(`We've logged your request: <strong>${escapeHtml(title)}</strong>.`) +
          p("We'll be in touch to arrange the repair. For anything urgent that risks safety or property damage, call us directly."),
        { label: "Track your requests", url: portalUrl }
      ),
    };
  },

  maintenanceAlert(businessName: string, tenantName: string, propertyLabel: string, title: string, priority: string, appUrl: string) {
    return {
      subject: `${priority === "urgent" ? "URGENT — " : ""}Maintenance: ${title} (${propertyLabel})`,
      html: shell(
        businessName,
        "New maintenance request",
        p(`<strong>${escapeHtml(tenantName)}</strong> reported an issue at <strong>${escapeHtml(propertyLabel)}</strong>.`) +
          p(`<strong>${escapeHtml(title)}</strong> — priority: ${escapeHtml(priority)}`),
        { label: "Open maintenance", url: `${appUrl}/maintenance` }
      ),
    };
  },

  test(businessName: string) {
    return {
      subject: "OpenTenant test email",
      html: shell(
        businessName,
        "Email is working",
        p("If you're reading this, OpenTenant can send mail through your SMTP settings.") +
          p("Applicants, tenants, and you will now get notifications automatically.")
      ),
    };
  },
};
