import { GENERATION_CHECKLIST } from '../generationGates';

/** Honest quality checklist — never claims guaranteed reconstruction. */
export function GenerationChecklist({ multiView }: { multiView: boolean }) {
  const items = GENERATION_CHECKLIST.filter((i) => multiView || i.id !== 'angles');
  return (
    <div className="generation-checklist" aria-label="Photo quality checklist">
      <p className="dash-page-sub">
        Before generating: better photos usually produce better models. These tips do{' '}
        <strong>not</strong> guarantee 3D quality.
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
      <p className="dash-page-sub">
        Preferred formats: JPEG, PNG or WebP. Single image max 15 MB (shortest side ideally
        ≥ 1024 px). Multi-view: 2–12 photos, 10 MB each, consistent lighting, distinct angles.
      </p>
    </div>
  );
}
