import { DatePicker } from "../components/DatePicker.js";
import { ScrollPanel } from "../components/ScrollPanel.js";
import { useState } from "react";

/** The booking form — where the clipped date picker was first reported. */
export function BookingForm() {
  const [date, setDate] = useState("");
  return (
    <ScrollPanel>
      <h1>Book a room</h1>
      <DatePicker value={date} onChange={setDate} />
    </ScrollPanel>
  );
}
