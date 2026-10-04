'use client';

import {
  ProjectLocationSchema,
  type IntakeAnswer,
  type IntakeQuestion,
  type ProjectLocation,
} from '@permit-readiness/contracts';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { saveIntakeAction } from '../app/actions';
import type { BrowserMapConfiguration } from '../lib/maps';
import { Button } from './button';
import {
  LocationFields,
  type LocationFieldErrors,
  type LocationFieldState,
} from './location-fields';
import { QuestionFields } from './question-fields';

const steps = ['Project activities', 'General location', 'Review and save'];

function answerValue(answers: IntakeAnswer[], questionId: string) {
  return answers.find((answer) => answer.questionId === questionId);
}

interface IntakeWizardProps {
  projectId: string;
  expectedVersion: number;
  expectedProjectVersion: number;
  questions: IntakeQuestion[];
  initialAnswers: IntakeAnswer[];
  initialLocation?: ProjectLocation;
  mapConfiguration: BrowserMapConfiguration;
}

function emptyLocationState(): LocationFieldState {
  return {
    mode: 'coordinates',
    longitude: '',
    latitude: '',
    geojson: '',
    description: '',
    source: 'coordinates',
  };
}

function initialLocationState(location?: ProjectLocation): LocationFieldState {
  if (!location) return emptyLocationState();
  if (location.geometry.type === 'Point') {
    return {
      mode: 'coordinates',
      longitude: String(location.geometry.coordinates[0]),
      latitude: String(location.geometry.coordinates[1]),
      geojson: '',
      description: location.description ?? '',
      source: location.source,
    };
  }
  return {
    mode: 'geojson',
    longitude: '',
    latitude: '',
    geojson: JSON.stringify(location.geometry, null, 2),
    description: location.description ?? '',
    source: location.source,
  };
}

function validateLocation(
  state: LocationFieldState,
):
  | { location: ProjectLocation; errors: LocationFieldErrors }
  | { location?: undefined; errors: LocationFieldErrors } {
  const errors: LocationFieldErrors = {};
  let geometry: unknown;

  if (state.mode === 'coordinates') {
    const longitude = Number(state.longitude);
    const latitude = Number(state.latitude);
    if (!state.longitude.trim()) {
      errors.longitude = 'Enter a longitude.';
    } else if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      errors.longitude = 'Enter a longitude from -180 to 180.';
    }
    if (!state.latitude.trim()) {
      errors.latitude = 'Enter a latitude.';
    } else if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.latitude = 'Enter a latitude from -90 to 90.';
    }
    geometry = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
  } else {
    if (!state.geojson.trim()) {
      errors.geojson = 'Paste a GeoJSON Point or Polygon geometry.';
    } else {
      try {
        geometry = JSON.parse(state.geojson);
      } catch {
        errors.geojson = 'Enter valid JSON for a GeoJSON Point or Polygon.';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    errors.general =
      'Correct the highlighted location fields, then confirm again.';
    return { errors };
  }

  const result = ProjectLocationSchema.safeParse({
    geometry,
    source: state.source,
    description: state.description.trim() || undefined,
  });
  if (!result.success) {
    if (state.mode === 'geojson') {
      errors.geojson =
        'Enter a valid GeoJSON Point or Polygon with longitude and latitude coordinates.';
    }
    errors.general =
      'The location is outside the accepted format or coordinate range.';
    return { errors };
  }
  return { location: result.data, errors };
}

export function IntakeWizard({
  projectId,
  expectedVersion,
  expectedProjectVersion,
  questions,
  initialAnswers,
  initialLocation,
  mapConfiguration,
}: IntakeWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [location, setLocation] = useState<LocationFieldState>(() =>
    initialLocationState(initialLocation),
  );
  const [confirmedLocation, setConfirmedLocation] = useState<ProjectLocation>();
  const [locationErrors, setLocationErrors] = useState<LocationFieldErrors>({});
  const [locationStatus, setLocationStatus] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();
  const updateAnswer = useCallback((next: IntakeAnswer) => {
    setAnswers((current) => [
      ...current.filter((answer) => answer.questionId !== next.questionId),
      next,
    ]);
  }, []);
  const answeredRequired = useMemo(
    () =>
      questions.filter(
        (question) =>
          question.required &&
          answerValue(answers, question.id)?.state === 'answered',
      ).length,
    [answers, questions],
  );

  function submit() {
    setMessage(undefined);
    if (!confirmedLocation) {
      setStep(1);
      setLocationErrors({
        general: 'Confirm a point or polygon before saving the project.',
      });
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveIntakeAction(projectId, {
          expectedVersion,
          expectedProjectVersion,
          answers,
          location: confirmedLocation,
        });
        setMessage('Project information saved.');
        router.push(result.redirectTo);
      } catch {
        setMessage(
          'We could not save the project. Check the location and required answers, then try again.',
        );
      }
    });
  }

  const activityContent = (
    <section className="form-section" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Describe project activities</h2>
      <p className="measure">
        Choose “Unknown” when you cannot confirm an answer. The gap will remain
        visible rather than being guessed.
      </p>
      <QuestionFields
        questions={questions}
        answers={answers}
        onChange={updateAnswer}
      />
    </section>
  );
  const updateLocation = (next: Partial<LocationFieldState>) => {
    setLocation((current) => ({ ...current, ...next }));
    setConfirmedLocation(undefined);
    setLocationErrors({});
    setLocationStatus(undefined);
  };
  const confirmLocation = () => {
    const result = validateLocation(location);
    setLocationErrors(result.errors);
    if (!result.location) {
      setConfirmedLocation(undefined);
      setLocationStatus(undefined);
      return;
    }
    setConfirmedLocation(result.location);
    setLocationStatus(undefined);
  };
  const resetLocation = () => {
    setLocation(emptyLocationState());
    setConfirmedLocation(undefined);
    setLocationErrors({});
    setLocationStatus(
      'Location cleared. Enter or select a location to continue.',
    );
  };
  const locationContent = (
    <LocationFields
      state={location}
      configuration={mapConfiguration}
      confirmedLocation={confirmedLocation}
      errors={locationErrors}
      statusMessage={locationStatus}
      onChange={updateLocation}
      onConfirm={confirmLocation}
      onReset={resetLocation}
    />
  );
  const reviewContent = (
    <section className="form-section">
      <h2>Review before saving</h2>
      <p>{answeredRequired} required answers are complete.</p>
      {confirmedLocation ? (
        <div className="callout field">
          <h3>Confirmed location</h3>
          <p>
            Geometry: {confirmedLocation.geometry.type}. Source:{' '}
            {confirmedLocation.source === 'map'
              ? 'interactive map'
              : 'manual entry'}
            .
          </p>
          <Button type="button" variant="secondary" onClick={() => setStep(1)}>
            Edit confirmed location
          </Button>
        </div>
      ) : (
        <div className="notice notice--danger field" role="alert">
          Confirm a location before saving.
        </div>
      )}
    </section>
  );

  return (
    <div>
      <ol className="wizard-progress" aria-label="Intake progress">
        {steps.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {step === 0
        ? activityContent
        : step === 1
          ? locationContent
          : reviewContent}
      <div className="actions">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < 2 ? (
          <Button
            disabled={step === 1 && !confirmedLocation}
            aria-describedby={
              step === 1 && !confirmedLocation
                ? 'location-confirmation-hint'
                : undefined
            }
            onClick={() => setStep(step + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button disabled={isPending || !confirmedLocation} onClick={submit}>
            {isPending ? 'Saving project…' : 'Save and review project'}
          </Button>
        )}
      </div>
      {message ? (
        <p className="notice notice--info" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
