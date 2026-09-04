import { createSearchJobAction } from "@/app/actions";

const MARKETS = ["ARAB_48", "ISRAELI_OTHER", "PALESTINIAN_TERRITORIES", "GULF", "JORDAN", "IRAQ", "OTHER", "UNKNOWN"];

export default function NewSearchJobPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Start a New Search</h1>
      <p className="text-sm text-[var(--text-muted)]">
        This creates and queues the job immediately. A background worker processes it independently — you can close
        this tab and come back later.
      </p>

      <form action={createSearchJobAction} className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-5">
        <Field label="Job name (optional)">
          <input name="name" placeholder="Israel — Arab 48 Cosmetic Dentists" className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Country">
            <input name="country" defaultValue="Israel" required className={inputClass} />
          </Field>
          <Field label="Target Market">
            <select name="targetMarket" defaultValue="ARAB_48" className={inputClass}>
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Cities / Locations (comma-separated)">
          <input name="cities" defaultValue="Nazareth, Umm al-Fahm" className={inputClass} />
        </Field>

        <Field label="Specialty">
          <input name="specialty" defaultValue="Cosmetic Dentistry" className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Minimum followers">
            <input type="number" name="minFollowers" defaultValue={1000} className={inputClass} />
          </Field>
          <Field label="Maximum followers">
            <input type="number" name="maxFollowers" className={inputClass} />
          </Field>
        </div>

        <Field label="Languages (comma-separated)">
          <input name="languages" defaultValue="ar, he" className={inputClass} />
        </Field>

        <Field label="Keywords (comma-separated, optional)">
          <input name="keywords" placeholder="veneers, smile makeover, crowns, E-max" className={inputClass} />
        </Field>

        <Field label="Minimum lead score (optional)">
          <input type="number" name="minLeadScore" className={inputClass} />
        </Field>

        <button
          type="submit"
          className="w-full rounded-md bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-black hover:bg-[var(--gold-dark)] hover:text-white"
        >
          START SEARCH
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
