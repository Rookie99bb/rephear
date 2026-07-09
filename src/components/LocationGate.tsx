import { submitLocationAction } from "@/lib/actions/users";
import { LOCATIONS } from "@/lib/locations";

// Blocks the rest of the app until a logged-in user has chosen a
// location. Plain HTML form buttons (one per city) — no client JS needed.
export default function LocationGate() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Choose your location
      </h1>
      <p className="mt-2 text-sm text-subtle">
        Rankings are local — pick where you are so we can show you the
        right ones. You can change this anytime in Settings.
      </p>
      <form action={submitLocationAction} className="mt-8 flex flex-wrap justify-center gap-2">
        {LOCATIONS.map((location) => (
          <button
            key={location}
            type="submit"
            name="location"
            value={location}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-white"
          >
            {location}
          </button>
        ))}
      </form>
    </div>
  );
}
