import { FormEvent, useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import {
  createAdminUser,
  getAdminUsers,
  getIntegrationSettings,
  updateAdminUser,
  updateIntegrationSettings,
  type AdminUser,
  type IntegrationSettings
} from "./settings-client";

export function AdminSettingsPage() {
  const { locale } = useI18n();
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError(null);
    try {
      const [settingsResult, usersResult] = await Promise.all([
        getIntegrationSettings(),
        getAdminUsers()
      ]);
      setSettings(settingsResult);
      setUsers(usersResult);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : locale === "pl"
            ? "Nie mozna zaladowac danych administracyjnych."
            : "Failed to load admin data"
      );
    }
  }

  async function onSubmitIntegrations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setStatus("saving");
    setError(null);
    try {
      const openrouterApiKey = String(formData.get("openrouterApiKey") ?? "").trim();
      const elevenlabsApiKey = String(formData.get("elevenlabsApiKey") ?? "").trim();
      const elevenlabsWebhookSecret = String(formData.get("elevenlabsWebhookSecret") ?? "").trim();

      const updated = await updateIntegrationSettings({
        openrouterBaseUrl: String(formData.get("openrouterBaseUrl") ?? ""),
        openrouterModel: String(formData.get("openrouterModel") ?? ""),
        elevenlabsBaseUrl: String(formData.get("elevenlabsBaseUrl") ?? ""),
        elevenlabsAgentId: String(formData.get("elevenlabsAgentId") ?? ""),
        ...(openrouterApiKey ? { openrouterApiKey } : {}),
        ...(elevenlabsApiKey ? { elevenlabsApiKey } : {}),
        ...(elevenlabsWebhookSecret ? { elevenlabsWebhookSecret } : {})
      });
      setSettings(updated);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie mozna zapisac ustawien integracji."
            : "Failed to save integration settings"
      );
    } finally {
      setStatus("idle");
    }
  }

  async function onCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setStatus("saving");
    setError(null);
    try {
      await createAdminUser({
        fullName: String(formData.get("fullName") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        role: String(formData.get("role") ?? "EMPLOYEE") as "EMPLOYEE" | "ADMIN",
        password: String(formData.get("password") ?? "").trim() || undefined
      });
      form.reset();
      const updatedUsers = await getAdminUsers();
      setUsers(updatedUsers);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie mozna utworzyc uzytkownika."
            : "Failed to create user"
      );
    } finally {
      setStatus("idle");
    }
  }

  async function onToggleActive(user: AdminUser) {
    setError(null);
    await updateAdminUser(user.id, { isActive: !user.isActive });
    setUsers(await getAdminUsers());
  }

  async function onRoleChange(user: AdminUser, role: "EMPLOYEE" | "ADMIN") {
    setError(null);
    await updateAdminUser(user.id, { role });
    setUsers(await getAdminUsers());
  }

  async function onConfirmResetPassword() {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 8) {
      setError(
        locale === "pl"
          ? "Nowe haslo musi miec co najmniej 8 znakow."
          : "Reset password must be at least 8 characters"
      );
      return;
    }

    setStatus("saving");
    setError(null);
    try {
      await updateAdminUser(resetTarget.id, { password: resetPassword.trim() });
      setResetTarget(null);
      setResetPassword("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie mozna zresetowac hasla."
            : "Failed to reset password"
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2 border-b border-neutral-900 pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-700">
          {locale === "pl" ? "Admin" : "Admin"}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {locale === "pl" ? "Konsola administracyjna" : "Administration Console"}
        </h1>
        <p className="max-w-3xl leading-7 text-neutral-800">
          {locale === "pl"
            ? "Zarzadzaj kontami tlumaczy i integracjami uslug zewnetrznych."
            : "Manage translator accounts and external service integrations."}
        </p>
      </header>

      {error ? (
        <p role="alert" className="border border-accent p-3 text-sm">
          {error}
        </p>
      ) : null}

      <section className="space-y-5 border border-neutral-900 p-5">
        <header className="space-y-1 border-b border-neutral-900 pb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">
            {locale === "pl" ? "Administracja tlumaczy" : "Translator Administration"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {locale === "pl" ? "Uzytkownicy i role" : "Users & Roles"}
          </h2>
        </header>

        <form className="grid items-end gap-4 md:grid-cols-4" onSubmit={onCreateUser}>
          <Field label={locale === "pl" ? "Imie i nazwisko" : "Full Name"} name="fullName" required />
          <Field label="Email" name="email" type="email" required />
          <SelectField
            label={locale === "pl" ? "Rola" : "Role"}
            name="role"
            options={[
              { value: "EMPLOYEE", label: locale === "pl" ? "Tlumacz (Pracownik)" : "Translator (Employee)" },
              { value: "ADMIN", label: "Admin" }
            ]}
          />
          <Field
            label={locale === "pl" ? "Haslo poczatkowe" : "Initial Password"}
            name="password"
            type="password"
            placeholder={locale === "pl" ? "Opcjonalne" : "Optional"}
          />
          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={status === "saving"}
              className="border border-neutral-900 bg-ink px-6 py-3 text-xs uppercase tracking-[0.16em] text-paper disabled:opacity-60"
            >
              {status === "saving"
                ? locale === "pl"
                  ? "Zapisywanie"
                  : "Saving"
                : locale === "pl"
                  ? "Utworz uzytkownika"
                  : "Create User"}
            </button>
          </div>
        </form>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-300">
                <th className="py-2">{locale === "pl" ? "Nazwa" : "Name"}</th>
                <th className="py-2">Email</th>
                <th className="py-2">{locale === "pl" ? "Rola" : "Role"}</th>
                <th className="py-2">{locale === "pl" ? "Status" : "Status"}</th>
                <th className="py-2">{locale === "pl" ? "Akcje" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-neutral-200">
                  <td className="py-2">{user.fullName}</td>
                  <td className="py-2">{user.email}</td>
                  <td className="py-2">
                    {user.role === "CUSTOMER" ? (
                      locale === "pl" ? "Klient" : "Customer"
                    ) : (
                      <select
                        value={user.role}
                        onChange={(event) => {
                          void onRoleChange(user, event.target.value as "EMPLOYEE" | "ADMIN");
                        }}
                        className="border border-neutral-900 bg-paper px-2 py-1"
                      >
                        <option value="EMPLOYEE">EMPLOYEE</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    )}
                  </td>
                  <td className="py-2">{user.isActive ? (locale === "pl" ? "Aktywny" : "Active") : locale === "pl" ? "Nieaktywny" : "Inactive"}</td>
                  <td className="py-2">
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          void onToggleActive(user);
                        }}
                        className="underline underline-offset-4"
                      >
                        {user.isActive
                          ? locale === "pl"
                            ? "Dezaktywuj"
                            : "Deactivate"
                          : locale === "pl"
                            ? "Aktywuj"
                            : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetTarget(user);
                          setResetPassword("");
                        }}
                        className="underline underline-offset-4"
                      >
                        {locale === "pl" ? "Resetuj haslo" : "Reset Password"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {settings ? (
        <form className="space-y-8" onSubmit={onSubmitIntegrations}>
          <section className="space-y-5 border border-neutral-900 p-5">
            <header className="space-y-1 border-b border-neutral-900 pb-3">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">{locale === "pl" ? "Zewnetrzny LLM" : "External LLM"}</p>
              <h2 className="text-2xl font-semibold tracking-tight">OpenRouter</h2>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label={locale === "pl" ? "OpenRouter Base URL" : "OpenRouter Base URL"} name="openrouterBaseUrl" defaultValue={settings.openrouterBaseUrl} required />
              <Field label={locale === "pl" ? "Model OpenRouter" : "OpenRouter Model"} name="openrouterModel" defaultValue={settings.openrouterModel} required />
              <Field label={locale === "pl" ? "Klucz API OpenRouter" : "OpenRouter API Key"} name="openrouterApiKey" placeholder={settings.openrouterApiKey || (locale === "pl" ? "Nie ustawiono" : "Not set")} type="password" />
            </div>
          </section>

          <section className="space-y-5 border border-neutral-900 p-5">
            <header className="space-y-1 border-b border-neutral-900 pb-3">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">{locale === "pl" ? "Dostawca glosu" : "Voice Provider"}</p>
              <h2 className="text-2xl font-semibold tracking-tight">ElevenLabs</h2>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label={locale === "pl" ? "ElevenLabs Base URL" : "ElevenLabs Base URL"} name="elevenlabsBaseUrl" defaultValue={settings.elevenlabsBaseUrl} required />
              <Field label={locale === "pl" ? "Klucz API ElevenLabs" : "ElevenLabs API Key"} name="elevenlabsApiKey" placeholder={settings.elevenlabsApiKey || (locale === "pl" ? "Nie ustawiono" : "Not set")} type="password" />
              <Field label={locale === "pl" ? "ID agenta ElevenLabs" : "ElevenLabs Agent ID"} name="elevenlabsAgentId" defaultValue={settings.elevenlabsAgentId} />
              <Field label={locale === "pl" ? "Sekret webhooka ElevenLabs" : "ElevenLabs Webhook Secret"} name="elevenlabsWebhookSecret" placeholder={settings.elevenlabsWebhookSecret || (locale === "pl" ? "Nie ustawiono" : "Not set")} type="password" />
            </div>
          </section>

          <div>
            <button
              type="submit"
              disabled={status === "saving"}
              className="border border-neutral-900 bg-ink px-6 py-3 text-xs uppercase tracking-[0.16em] text-paper disabled:opacity-60"
            >
              {status === "saving"
                ? locale === "pl"
                  ? "Zapisywanie"
                  : "Saving"
                : locale === "pl"
                  ? "Zapisz ustawienia integracji"
                  : "Save Integration Settings"}
            </button>
          </div>
        </form>
      ) : (
        <p>{locale === "pl" ? "Ladowanie ustawien..." : "Loading settings..."}</p>
      )}

      {resetTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        >
          <div className="w-full max-w-md space-y-4 border border-neutral-900 bg-paper p-5">
            <h3 id="reset-password-title" className="text-xl font-semibold tracking-tight">
              {locale === "pl" ? "Reset hasla" : "Reset Password"}
            </h3>
            <p className="text-sm leading-6">
              {locale === "pl" ? "Ustaw nowe haslo dla " : "Set a new password for "}
              <span className="font-medium">{resetTarget.fullName}</span>.
            </p>
            <div className="space-y-2">
              <label htmlFor="resetPassword" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                {locale === "pl" ? "Nowe haslo" : "New Password"}
              </label>
              <input
                id="resetPassword"
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                className="h-12 w-full border border-neutral-900 bg-paper px-3"
                minLength={8}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void onConfirmResetPassword();
                }}
                disabled={status === "saving"}
                className="border border-neutral-900 bg-ink px-4 py-2 text-xs uppercase tracking-[0.16em] text-paper disabled:opacity-60"
              >
                {status === "saving"
                  ? locale === "pl"
                    ? "Zapisywanie"
                    : "Saving"
                  : locale === "pl"
                    ? "Potwierdz reset"
                    : "Confirm Reset"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword("");
                }}
                className="border border-neutral-900 px-4 py-2 text-xs uppercase tracking-[0.16em]"
              >
                {locale === "pl" ? "Anuluj" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-xs uppercase tracking-[0.16em] text-neutral-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="h-12 w-full border border-neutral-900 bg-paper px-3"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-xs uppercase tracking-[0.16em] text-neutral-700">
        {label}
      </label>
      <select id={name} name={name} className="h-12 w-full border border-neutral-900 bg-paper px-3">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
