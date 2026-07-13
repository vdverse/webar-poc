import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import {
  projectFormSchema,
  type ProjectFormValues,
} from '../schemas/projectSchema';

interface Props {
  defaultValues?: Partial<ProjectFormValues>;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: ProjectFormValues) => void;
}

export function ProjectForm({ defaultValues, submitLabel, busy, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      mode: defaultValues?.mode ?? 'markerless_surface',
    },
  });

  return (
    <form className="dash-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="dash-field">
        <label htmlFor="project-name">Project name</label>
        <input id="project-name" type="text" {...register('name')} />
        {errors.name && <p className="dash-field-error">{errors.name.message}</p>}
      </div>

      <div className="dash-field">
        <label htmlFor="project-description">Description (optional)</label>
        <textarea id="project-description" rows={3} {...register('description')} />
        {errors.description && (
          <p className="dash-field-error">{errors.description.message}</p>
        )}
      </div>

      <div className="dash-field">
        <label htmlFor="project-mode">AR mode</label>
        <select id="project-mode" {...register('mode')}>
          <option value="markerless_surface">
            Markerless AR — place the object on a real surface
          </option>
          <option value="image_target">
            Image target AR — anchor to a printed image
          </option>
        </select>
        <p className="dash-field-hint">
          This workflow is built for markerless surface placement. The viewer
          scans a QR code and places your 3D model on a floor or table — no
          printed target needed.
        </p>
      </div>

      <button className="dash-button" type="submit" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
