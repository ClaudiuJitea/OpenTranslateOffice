import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";
import {
  createAdminUser,
  deleteAdminUser,
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
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError(null);
    setNotice(null);
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
            ? "Nie można załadować danych administracyjnych."
            : "Failed to load admin data"
      );
    }
  }

  async function onSubmitIntegrations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setStatus("saving");
    setError(null);
    setNotice(null);
    try {
      const openrouterApiKey = String(formData.get("openrouterApiKey") ?? "").trim();
      const elevenlabsApiKey = String(formData.get("elevenlabsApiKey") ?? "").trim();
      const openrouterBaseUrl = String(formData.get("openrouterBaseUrl") ?? "").trim();
      const openrouterModel = String(formData.get("openrouterModel") ?? "").trim();
      const elevenlabsBaseUrl = String(formData.get("elevenlabsBaseUrl") ?? "").trim();
      const elevenlabsAgentId = String(formData.get("elevenlabsAgentId") ?? "").trim();

      const updated = await updateIntegrationSettings({
        ...(openrouterBaseUrl ? { openrouterBaseUrl } : {}),
        ...(openrouterModel ? { openrouterModel } : {}),
        ...(elevenlabsBaseUrl ? { elevenlabsBaseUrl } : {}),
        ...(elevenlabsAgentId ? { elevenlabsAgentId } : {}),
        ...(openrouterApiKey ? { openrouterApiKey } : {}),
        ...(elevenlabsApiKey ? { elevenlabsApiKey } : {})
      });
      setSettings(updated);
      setNotice(
        locale === "pl"
          ? "Ustawienia integracji zostały zapisane."
          : "Integration settings saved."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie można zapisać ustawień integracji."
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
    setNotice(null);
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
            ? "Nie można utworzyć użytkownika."
            : "Failed to create user"
      );
    } finally {
      setStatus("idle");
    }
  }

  async function onToggleActive(user: AdminUser) {
    setStatus("saving");
    setError(null);
    setNotice(null);
    try {
      await updateAdminUser(user.id, { isActive: !user.isActive });
      setUsers(await getAdminUsers());
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie można zaktualizować statusu użytkownika."
            : "Unable to update user status"
      );
    } finally {
      setStatus("idle");
    }
  }

  async function onRoleChange(user: AdminUser, role: "EMPLOYEE" | "ADMIN") {
    setStatus("saving");
    setError(null);
    setNotice(null);
    try {
      await updateAdminUser(user.id, { role });
      setUsers(await getAdminUsers());
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie można zaktualizować roli użytkownika."
            : "Unable to update user role"
      );
    } finally {
      setStatus("idle");
    }
  }

  async function onConfirmResetPassword() {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 8) {
      setError(
        locale === "pl"
          ? "Nowe hasło musi mieć co najmniej 8 znaków."
          : "Reset password must be at least 8 characters"
      );
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setError(
        locale === "pl"
          ? "Wprowadzone hasła muszą być identyczne."
          : "The password entries must match"
      );
      return;
    }

    setStatus("saving");
    setError(null);
    setNotice(null);
    try {
      await updateAdminUser(resetTarget.id, { password: resetPassword.trim() });
      setResetTarget(null);
      setResetPassword("");
      setResetPasswordConfirm("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie można zresetować hasła."
            : "Failed to reset password"
      );
    } finally {
      setStatus("idle");
    }
  }

  async function onConfirmDeleteUser() {
    if (!deleteTarget) return;

    setStatus("saving");
    setError(null);
    try {
      await deleteAdminUser(deleteTarget.id);
      setDeleteTarget(null);
      setUsers(await getAdminUsers());
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : locale === "pl"
            ? "Nie można usunąć użytkownika."
            : "Unable to delete user"
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
            ? "Zarządzaj kontami tłumaczy i integracjami usług zewnętrznych."
            : "Manage translator accounts and external service integrations."}
        </p>
      </header>

      {error ? (
        <p role="alert" className="border border-accent p-3 text-sm">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="border border-accent p-3 text-sm text-accent">
          {notice}
        </p>
      ) : null}

      <section className="space-y-5 border border-neutral-900 p-5">
        <header className="space-y-1 border-b border-neutral-900 pb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">
            {locale === "pl" ? "Administracja tłumaczy" : "Translator Administration"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {locale === "pl" ? "Użytkownicy i role" : "Users & Roles"}
          </h2>
        </header>

        <form className="grid items-end gap-4 md:grid-cols-4" onSubmit={onCreateUser}>
          <Field label={locale === "pl" ? "Imię i nazwisko" : "Full Name"} name="fullName" required />
          <Field label="Email" name="email" type="email" required />
          <SelectField
            label={locale === "pl" ? "Rola" : "Role"}
            name="role"
            options={[
              { value: "EMPLOYEE", label: locale === "pl" ? "Tłumacz (Pracownik)" : "Translator (Employee)" },
              { value: "ADMIN", label: "Admin" }
            ]}
          />
          <Field
            label={locale === "pl" ? "Hasło początkowe" : "Initial Password"}
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
                  ? "Utwórz użytkownika"
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
                          setResetPasswordConfirm("");
                        }}
                        className="underline underline-offset-4"
                      >
                        {locale === "pl" ? "Resetuj hasło" : "Reset Password"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(user);
                        }}
                        className="underline underline-offset-4 text-accent"
                      >
                        {locale === "pl" ? "Usun" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-5 border border-neutral-900 p-5">
        <header className="space-y-1 border-b border-neutral-900 pb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">
            {locale === "pl" ? "Plan pracy" : "Work Calendar"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {locale === "pl" ? "Kalendarz zespołu" : "Team Work Calendar"}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-neutral-800">
            {locale === "pl"
              ? "Otwórz osobną stronę kalendarza, aby przeglądać przypisane zlecenia i dzienny harmonogram pracy dla wybranego użytkownika."
              : "Open the dedicated calendar page to review assigned jobs and daily working hours for a selected user."}
          </p>
        </header>
        <div className="flex items-center justify-between gap-4 border border-neutral-300 p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {locale === "pl" ? "Widok kalendarza i godzin pracy" : "Calendar and Working Hours View"}
            </p>
            <p className="text-sm text-neutral-700">
              {locale === "pl"
                ? "Przejdź do dedykowanej strony, aby przeglądać harmonogram bez przeciążenia ustawień administracyjnych."
                : "Use the dedicated page for scheduling without crowding the admin settings screen."}
            </p>
          </div>
          <Link
            to="/admin/calendar"
            className="border border-neutral-900 bg-ink px-5 py-3 text-xs uppercase tracking-[0.16em] text-paper"
          >
            {locale === "pl" ? "Otwórz kalendarz" : "Open Calendar"}
          </Link>
        </div>
      </section>

      {settings ? (
        <form className="space-y-8" onSubmit={onSubmitIntegrations}>
          <section className="space-y-5 border border-neutral-900 p-5">
            <header className="space-y-1 border-b border-neutral-900 pb-3">
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">{locale === "pl" ? "Zewnętrzny LLM" : "External LLM"}</p>
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
              <p className="text-xs uppercase tracking-[0.18em] text-neutral-700">{locale === "pl" ? "Dostawca głosu" : "Voice Provider"}</p>
              <h2 className="text-2xl font-semibold tracking-tight">ElevenLabs</h2>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label={locale === "pl" ? "ElevenLabs Base URL" : "ElevenLabs Base URL"} name="elevenlabsBaseUrl" defaultValue={settings.elevenlabsBaseUrl} required />
              <Field label={locale === "pl" ? "Klucz API ElevenLabs" : "ElevenLabs API Key"} name="elevenlabsApiKey" placeholder={settings.elevenlabsApiKey || (locale === "pl" ? "Nie ustawiono" : "Not set")} type="password" />
              <Field label={locale === "pl" ? "ID agenta ElevenLabs" : "ElevenLabs Agent ID"} name="elevenlabsAgentId" defaultValue={settings.elevenlabsAgentId} />
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
        <p>{locale === "pl" ? "Ładowanie ustawień..." : "Loading settings..."}</p>
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
              {locale === "pl" ? "Reset hasła" : "Reset Password"}
            </h3>
            <p className="text-sm leading-6">
              {locale === "pl" ? "Ustaw nowe hasło dla " : "Set a new password for "}
              <span className="font-medium">{resetTarget.fullName}</span>.
            </p>
            <div className="space-y-2">
              <label htmlFor="resetPassword" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                {locale === "pl" ? "Nowe hasło" : "New Password"}
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
            <div className="space-y-2">
              <label htmlFor="resetPasswordConfirm" className="text-xs uppercase tracking-[0.16em] text-neutral-700">
                {locale === "pl" ? "Potwierdź hasło" : "Confirm Password"}
              </label>
              <input
                id="resetPasswordConfirm"
                type="password"
                value={resetPasswordConfirm}
                onChange={(event) => setResetPasswordConfirm(event.target.value)}
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
                  setResetPasswordConfirm("");
                }}
                className="border border-neutral-900 px-4 py-2 text-xs uppercase tracking-[0.16em]"
              >
                {locale === "pl" ? "Anuluj" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        >
          <div className="w-full max-w-md space-y-4 border border-neutral-900 bg-paper p-5">
            <h3 id="delete-user-title" className="text-xl font-semibold tracking-tight">
              {locale === "pl" ? "Usunięcie użytkownika" : "Delete User Account"}
            </h3>
            <p className="text-sm leading-6">
              {locale === "pl"
                ? "Ta operacja jest nieodwracalna. Przed usunięciem konta należy najpierw dezaktywować użytkownika."
                : "This action is permanent. The user account must be deactivated before it can be deleted."}
            </p>
            <div className="border border-neutral-300 px-3 py-3 text-sm leading-6">
              <p>
                <span className="font-medium">{locale === "pl" ? "Użytkownik:" : "User:"}</span>{" "}
                {deleteTarget.fullName}
              </p>
              <p>
                <span className="font-medium">Email:</span> {deleteTarget.email}
              </p>
              <p>
                <span className="font-medium">{locale === "pl" ? "Status:" : "Status:"}</span>{" "}
                {deleteTarget.isActive
                  ? locale === "pl"
                    ? "Aktywny"
                    : "Active"
                  : locale === "pl"
                    ? "Nieaktywny"
                    : "Inactive"}
              </p>
            </div>
            {deleteTarget.isActive ? (
              <p className="border border-accent p-3 text-sm leading-6 text-accent">
                {locale === "pl"
                  ? "Przed usunięciem konta najpierw dezaktywuj tego użytkownika na liście użytkowników. Aktywne konta nie mogą zostać usunięte."
                  : "Please deactivate this user from the users list before proceeding. Active accounts cannot be deleted."}
              </p>
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void onConfirmDeleteUser();
                }}
                disabled={status === "saving" || deleteTarget.isActive}
                className="border border-accent bg-paper px-4 py-2 text-xs uppercase tracking-[0.16em] text-accent disabled:opacity-60"
              >
                {status === "saving"
                  ? locale === "pl"
                    ? "Zapisywanie"
                    : "Saving"
                  : locale === "pl"
                    ? "Usuń konto"
                    : "Delete Account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
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
