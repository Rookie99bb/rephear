import { redirect } from "next/navigation";
import { getCurrentFullUser } from "@/lib/session";
import { submitLocationAction } from "@/lib/actions/users";
import { LOCATIONS } from "@/lib/locations";

export default async function SettingsPage() {
  const user = await getCurrentFullUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Settings
      </h1>

      <div className="mt-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Location
        </h2>
        <p className="mb-3 text-sm text-subtle">
          Rankings and the homepage are filtered to your location by
          default.
          {user.location && (
            <>
              {" "}
              Currently: <span className="font-medium text-ink">{user.location}</span>.
            </>
          )}
        </p>
        <form
          action={submitLocationAction}
          className="flex flex-wrap gap-2"
        >
          {LOCATIONS.map((location) => (
            <button
              key={location}
              type="submit"
              name="location"
              value={location}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                user.location === location
                  ? "border-ink bg-ink text-white"
                  : "border-border text-ink hover:border-ink"
              }`}
            >
              {location}
            </button>
          ))}
        </form>
      </div>
    </div>
  );
}
