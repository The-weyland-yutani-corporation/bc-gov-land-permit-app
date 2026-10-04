import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntakeWizard } from '../src/components/intake-wizard';

const { pushMock, saveIntakeActionMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  saveIntakeActionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('../src/app/actions', () => ({
  saveIntakeAction: saveIntakeActionMock,
}));

const unavailableMap = {
  available: false,
  mode: 'unavailable' as const,
  message: 'Azure Maps is not configured. Use coordinates or GeoJSON instead.',
};

function renderWizard() {
  render(
    <IntakeWizard
      projectId="33333333-3333-4333-8333-333333333333"
      expectedVersion={1}
      expectedProjectVersion={1}
      questions={[]}
      initialAnswers={[]}
      mapConfiguration={unavailableMap}
    />,
  );
}

async function openLocationStep() {
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Interactive map unavailable.')).toBeVisible();
}

describe('IntakeWizard location confirmation', () => {
  afterEach(cleanup);

  beforeEach(() => {
    pushMock.mockReset();
    saveIntakeActionMock.mockReset();
    saveIntakeActionMock.mockResolvedValue({
      ok: true,
      isComplete: true,
      redirectTo: '/projects/33333333-3333-4333-8333-333333333333/summary',
    });
  });

  it('keeps a missing location empty and blocks progress until confirmation', async () => {
    renderWizard();
    await openLocationStep();

    const longitude = screen.getByRole('spinbutton', {
      name: /^Longitude$/,
    });
    const latitude = screen.getByRole('spinbutton', {
      name: /^Latitude$/,
    });
    expect(longitude).toHaveValue(null);
    expect(latitude).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm this location' }),
    );
    expect(screen.getByText('Enter a longitude.')).toBeVisible();
    expect(screen.getByText('Enter a latitude.')).toBeVisible();
    expect(longitude).toHaveAttribute('aria-invalid', 'true');
    expect(latitude).toHaveAttribute('aria-invalid', 'true');
  });

  it('requires reconfirmation after coordinate edits and supports reset', async () => {
    renderWizard();
    await openLocationStep();

    const longitude = screen.getByRole('spinbutton', {
      name: /^Longitude$/,
    });
    const latitude = screen.getByRole('spinbutton', {
      name: /^Latitude$/,
    });
    await userEvent.type(longitude, '-123.3656');
    await userEvent.type(latitude, '48.4284');
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm this location' }),
    );
    expect(screen.getByText('Location confirmed.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();

    await userEvent.clear(longitude);
    expect(screen.queryByText('Location confirmed.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await userEvent.type(longitude, '-123.1');
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm this location' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset location' }),
    );
    expect(longitude).toHaveValue(null);
    expect(latitude).toHaveValue(null);
    expect(
      screen.getByText(
        'Location cleared. Enter or select a location to continue.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('saves a deliberately confirmed coordinate point', async () => {
    renderWizard();
    await openLocationStep();

    await userEvent.type(
      screen.getByRole('spinbutton', { name: /^Longitude$/ }),
      '-123.3656',
    );
    await userEvent.type(
      screen.getByRole('spinbutton', { name: /^Latitude$/ }),
      '48.4284',
    );
    await userEvent.type(
      screen.getByLabelText('General location description'),
      'Approximate synthetic corridor.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm this location' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Geometry: Point/)).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Save and review project' }),
    );

    await waitFor(() =>
      expect(saveIntakeActionMock).toHaveBeenCalledWith(
        '33333333-3333-4333-8333-333333333333',
        {
          expectedVersion: 1,
          expectedProjectVersion: 1,
          answers: [],
          location: {
            geometry: {
              type: 'Point',
              coordinates: [-123.3656, 48.4284],
            },
            source: 'coordinates',
            description: 'Approximate synthetic corridor.',
          },
        },
      ),
    );
  });

  it('validates, confirms, edits, and saves polygon GeoJSON', async () => {
    renderWizard();
    await openLocationStep();

    await userEvent.click(
      screen.getByRole('radio', {
        name: 'Paste Point or Polygon GeoJSON',
      }),
    );
    const geojson = screen.getByLabelText('GeoJSON geometry');
    fireEvent.change(geojson, { target: { value: '{not valid json' } });
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm this location' }),
    );
    expect(
      screen.getByText('Enter valid JSON for a GeoJSON Point or Polygon.'),
    ).toBeVisible();

    const polygon = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [-123.4, 48.4],
          [-123.3, 48.4],
          [-123.3, 48.5],
          [-123.4, 48.4],
        ],
      ],
    });
    fireEvent.change(geojson, { target: { value: polygon } });
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm this location' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/Geometry: Polygon/)).toBeVisible();

    await userEvent.click(
      screen.getByRole('button', { name: 'Edit confirmed location' }),
    );
    fireEvent.change(screen.getByLabelText('GeoJSON geometry'), {
      target: { value: `${polygon} ` },
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm this location' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Save and review project' }),
    );

    await waitFor(() => {
      const payload = saveIntakeActionMock.mock.calls[0]?.[1];
      expect(payload.location.geometry.type).toBe('Polygon');
      expect(payload.location.source).toBe('coordinates');
    });
  });
});
