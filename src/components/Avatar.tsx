import { colorForName, initialsForName } from "@/lib/avatar";

export default function Avatar({
  name,
  size = 40,
}: {
  name: string;
  size?: number;
}) {
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
