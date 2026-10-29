import { useState } from 'react';
import { AREAS } from '../data/areas';

const OTHER = '__other';

/**
 * The Area picker: a dropdown of the chosen county's neighbourhoods, with
 * "Other" for one that isn't listed, which opens a text box. A county with no
 * list gets the text box straight away. Give it key={county} so that changing
 * the county starts it afresh.
 * value/onChange hold the area name as text, the same as the old text box.
 */
export default function AreaField({ id, county, value, onChange }) {
  const areas = AREAS[county] ?? [];
  // An area saved before this list existed (or typed under "Other") opens in typing mode.
  const [typing, setTyping] = useState(value !== '' && !areas.includes(value));

  const textBox = (
    <input
      id={areas.length ? `${id}-other` : id}
      type="text"
      maxLength={100}
      placeholder="Type your area"
      aria-label={areas.length ? 'Area name' : undefined}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );

  if (!county) {
    return (
      <select id={id} disabled value="">
        <option value="">Choose a county first</option>
      </select>
    );
  }
  if (areas.length === 0) return textBox;

  function choose(e) {
    const picked = e.target.value;
    setTyping(picked === OTHER);
    onChange(picked === OTHER ? '' : picked);
  }

  return (
    <>
      <select id={id} value={typing ? OTHER : value} onChange={choose}>
        <option value="">Choose…</option>
        {areas.map(a => <option key={a} value={a}>{a}</option>)}
        <option value={OTHER}>Other (type it)</option>
      </select>
      {typing && textBox}
    </>
  );
}
