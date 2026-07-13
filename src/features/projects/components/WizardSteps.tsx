const STEPS = [
  { key: 'details', label: '1. Details' },
  { key: 'source_method', label: '2. Source' },
  { key: 'capture', label: '3. Photos' },
  { key: 'review', label: '4. Review' },
  { key: 'saved', label: '5. Save' },
] as const;

export type WizardStepKey = (typeof STEPS)[number]['key'];

export function WizardSteps({ current }: { current: WizardStepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="wizard-steps" aria-label="Wizard progress">
      {STEPS.map((step, i) => (
        <li
          key={step.key}
          className={
            step.key === current
              ? 'wizard-step wizard-step--current'
              : i < currentIndex
                ? 'wizard-step wizard-step--done'
                : 'wizard-step'
          }
          aria-current={step.key === current ? 'step' : undefined}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}
