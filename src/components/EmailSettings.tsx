"use client";

import { useState } from "react";

const PRESETS: Record<string, { host: string; port: string; secure: string; label: string }> = {
  gmail: { host: "smtp.gmail.com", port: "587", secure: "false", label: "Gmail / Google Workspace" },
  outlook: { host: "smtp-mail.outlook.com", port: "587", secure: "false", label: "Outlook / Microsoft 365" },
  icloud: { host: "smtp.mail.me.com", port: "587", secure: "false", label: "iCloud Mail" },
  yahoo: { host: "smtp.mail.yahoo.com", port: "465", secure: "true", label: "Yahoo Mail" },
  custom: { host: "", port: "587", secure: "false", label: "Other / custom SMTP" },
};

/**
 * SMTP setup. Picking a provider fills in the server details, so the only
 * things to type are the address and password.
 */
export default function EmailSettings({
  host,
  port,
  secure,
  user,
  fromName,
  fromEmail,
  notifyEmail,
  hasPassword,
}: {
  host: string;
  port: string;
  secure: string;
  user: string;
  fromName: string;
  fromEmail: string;
  notifyEmail: string;
  hasPassword: boolean;
}) {
  const initial =
    Object.keys(PRESETS).find((key) => PRESETS[key].host && PRESETS[key].host === host) ??
    (host ? "custom" : "gmail");

  const [provider, setProvider] = useState(initial);
  const [server, setServer] = useState({
    host: host || PRESETS[initial].host,
    port: port || PRESETS[initial].port,
    secure: secure || PRESETS[initial].secure,
  });

  function choose(key: string) {
    setProvider(key);
    if (key !== "custom") {
      setServer({ host: PRESETS[key].host, port: PRESETS[key].port, secure: PRESETS[key].secure });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Email provider</label>
        <select value={provider} onChange={(e) => choose(e.target.value)} className="input">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>{preset.label}</option>
          ))}
        </select>
      </div>

      {provider === "gmail" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Gmail needs an App Password, not your normal password.</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>Turn on 2-Step Verification on your Google account.</li>
            <li>
              Go to{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                myaccount.google.com/apppasswords
              </a>{" "}
              and create one for &ldquo;Mail&rdquo;.
            </li>
            <li>Paste the 16-character password below.</li>
          </ol>
          <p className="mt-1">Free Gmail sends up to ~500 messages a day, which is plenty for a rental portfolio.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Your email address</label>
          <input
            name="smtp_user"
            type="email"
            defaultValue={user}
            className="input"
            placeholder="you@gmail.com"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label">
            Password {hasPassword && <span className="text-emerald-600">· saved</span>}
          </label>
          <input
            name="smtp_password"
            type="password"
            className="input"
            placeholder={hasPassword ? "•••••• (leave blank to keep)" : "App password"}
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">SMTP server</label>
          <input
            name="smtp_host"
            value={server.host}
            onChange={(e) => setServer({ ...server, host: e.target.value })}
            className="input"
            readOnly={provider !== "custom"}
          />
        </div>
        <div>
          <label className="label">Port</label>
          <input
            name="smtp_port"
            value={server.port}
            onChange={(e) => setServer({ ...server, port: e.target.value })}
            className="input"
            readOnly={provider !== "custom"}
          />
        </div>
        <div>
          <label className="label">TLS</label>
          <select
            name="smtp_secure"
            value={server.secure}
            onChange={(e) => setServer({ ...server, secure: e.target.value })}
            className="input"
            disabled={provider !== "custom"}
          >
            <option value="false">STARTTLS (587)</option>
            <option value="true">SSL/TLS (465)</option>
          </select>
          {/* A disabled select submits nothing, so mirror the value. */}
          {provider !== "custom" && <input type="hidden" name="smtp_secure" value={server.secure} />}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Send as (name)</label>
          <input name="smtp_from_name" defaultValue={fromName} className="input" placeholder="Sunrise Property Management" />
        </div>
        <div>
          <label className="label">Send from (address)</label>
          <input
            name="smtp_from_email"
            type="email"
            defaultValue={fromEmail}
            className="input"
            placeholder="Same as your email address"
          />
        </div>
      </div>

      <div>
        <label className="label">Send my notifications to</label>
        <input
          name="smtp_notify_email"
          type="email"
          defaultValue={notifyEmail}
          className="input"
          placeholder="you@gmail.com"
        />
        <p className="mt-1 text-xs text-ink-500">
          Where new applications and maintenance requests are announced.
        </p>
      </div>

      {hasPassword && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" name="clear_smtp_password" className="h-4 w-4 rounded border-slate-300" />
          Remove the saved password
        </label>
      )}
    </div>
  );
}
