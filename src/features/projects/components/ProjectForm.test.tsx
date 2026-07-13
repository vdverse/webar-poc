import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectForm } from './ProjectForm';

afterEach(cleanup);

describe('ProjectForm', () => {
  it('shows a validation error instead of submitting when the name is empty', async () => {
    const onSubmit = vi.fn();
    render(<ProjectForm submitLabel="Create" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Give the project a name.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values with the default markerless mode', async () => {
    const onSubmit = vi.fn();
    render(<ProjectForm submitLabel="Create" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: '  Birthday cake  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: 'Birthday cake',
      mode: 'markerless_surface',
    });
  });

  it('pre-fills defaults when editing', () => {
    render(
      <ProjectForm
        defaultValues={{ name: 'Existing', description: 'Desc', mode: 'image_target' }}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('Existing');
    expect((screen.getByLabelText('AR mode') as HTMLSelectElement).value).toBe('image_target');
  });

  it('disables the submit button while busy', () => {
    render(<ProjectForm submitLabel="Create" busy onSubmit={vi.fn()} />);
    expect((screen.getByRole('button', { name: /Saving/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
