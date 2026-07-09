// The circular interlocking-rings logo mark (citadel_ui_spec.md) — sixteen
// overlapping thin circles arranged on a ring, drawn in currentColor so each
// screen sizes and tints it with utility classes.
const COUNT = 16;
const CENTER = 80;
const ORBIT = 58;
const RADIUS = 21;

export default function RingMark({ className }) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {Array.from({ length: COUNT }, (_, i) => {
        const angle = (i * 2 * Math.PI) / COUNT;
        return (
          <circle
            key={i}
            cx={(CENTER + ORBIT * Math.cos(angle)).toFixed(2)}
            cy={(CENTER + ORBIT * Math.sin(angle)).toFixed(2)}
            r={RADIUS}
            stroke="currentColor"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}
