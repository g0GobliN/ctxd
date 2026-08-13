import { useEffect, useRef, useState } from "react";
import "./DatePicker.css";

/**
 * Date picker.
 *
 * The popup is positioned against the input rather than the viewport, which is
 * why it clips inside a scrolling container — the container establishes a new
 * containing block and the absolute offsets are computed against the wrong one.
 */
export function DatePicker(props: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || anchor.current === null) return;
    const rect = anchor.current.getBoundingClientRect();
    anchor.current.style.setProperty("--popup-top", `${rect.bottom}px`);
    anchor.current.style.setProperty("--popup-left", `${rect.left}px`);
  }, [open]);

  return (
    <div className="date-picker" ref={anchor}>
      <input
        className="date-picker__input"
        value={props.value}
        onFocus={() => setOpen(true)}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {open && <div className="date-picker__popup" role="dialog" />}
    </div>
  );
}
