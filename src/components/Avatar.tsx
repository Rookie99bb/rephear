import { colorForName, initialsForName } from "@/lib/avatar";

export default function Avatar({
  name,
  photoUrl,
  size = 40,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: colorForName(name),
        fontSize: size * 0.38,
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    >
      {initialsForName(name)}
    </div>
  );
}
