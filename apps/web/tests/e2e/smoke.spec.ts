import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function answerBoolean(
  page: Page,
  question: string,
  answer: 'Yes' | 'No' | 'Unknown',
) {
  await page
    .locator('fieldset')
    .filter({ hasText: question })
    .getByRole('radio', { name: answer, exact: true })
    .check();
}

test('local applicant completes the degraded readiness journey', async ({
  page,
}, testInfo) => {
  const captureAssets = process.env.PERMIT_CAPTURE_ASSETS === 'true';
  const startedAt = Date.now();
  const captions: { start: number; text: string }[] = [];
  const capture = async (name: string, text: string) => {
    if (!captureAssets) return;
    captions.push({ start: Date.now() - startedAt, text });
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await page.waitForTimeout(1500);
  };

  await page.goto('/');
  await expect(
    page.getByText('Demonstration — not an official government service'),
  ).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Approved Government of British Columbia mark required',
    }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Understand what your land-based project may need',
  );
  await capture(
    'landing',
    'Local demonstration, not an official government service. No live Azure integrations are shown.',
  );
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to main content' }),
  ).toBeFocused();
  await page
    .getByRole('link', { name: 'Start a demonstration project' })
    .click();
  await page
    .getByRole('button', { name: 'Continue as demo applicant' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Create a demonstration project' }),
  ).toBeVisible();
  await page
    .getByLabel('Project name')
    .fill(`Pine Ridge route ${testInfo.project.name}`);
  await page
    .getByLabel('Short description (optional)')
    .fill('Synthetic end-to-end validation project.');
  await page.getByTestId('project-type-community-connectivity').check();
  await page
    .getByRole('button', { name: 'Create and add project details' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Add project details' }),
  ).toBeVisible();
  await answerBoolean(
    page,
    'Could any part of the project use provincially managed land?',
    'Yes',
  );
  await answerBoolean(
    page,
    'Could work occur in or near a stream, wet area, or shoreline?',
    'Unknown',
  );
  await answerBoolean(
    page,
    'Could the project add, relocate, or materially change road access?',
    'No',
  );
  await answerBoolean(
    page,
    'Does the project include a linear utility or communications corridor?',
    'Yes',
  );
  await capture(
    'intake',
    'The fictional connectivity project keeps water information Unknown. Rules, not AI, decide trigger results.',
  );
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Interactive map unavailable.')).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Longitude', exact: true }),
  ).toHaveValue('');
  await expect(
    page.getByRole('spinbutton', { name: 'Latitude', exact: true }),
  ).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page
    .getByRole('spinbutton', { name: 'Longitude', exact: true })
    .fill('-123.3656');
  await page
    .getByRole('spinbutton', { name: 'Latitude', exact: true })
    .fill('48.4284');
  await page
    .getByLabel('General location description')
    .fill('Approximate synthetic corridor near Pine Ridge.');
  await page.getByRole('button', { name: 'Confirm this location' }).click();
  await expect(page.getByText('Location confirmed.')).toBeVisible();
  await capture(
    'location',
    'The non-map location fallback uses illustrative coordinates. This is not parcel or survey analysis.',
  );
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Save and review project' }).click();

  await expect(
    page.getByRole('heading', { name: 'Review the project summary' }),
  ).toBeVisible();
  await expect(
    page.getByText('Some required information is unknown.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate readiness report' }),
  ).toBeEnabled();

  await page.getByRole('link', { name: 'Ask the navigator' }).click();
  await page
    .getByLabel('Your question')
    .fill('What should I prepare about water and location?');
  await page.getByRole('button', { name: 'Ask the navigator' }).click();
  await expect(
    page.getByText(/cannot decide which permits legally apply/i),
  ).toBeVisible();
  await expect(
    page.getByText(/Answer what you know, or choose “Unknown”/i),
  ).toBeVisible();
  await capture(
    'navigator',
    'The local navigator explains saved facts. It cannot decide which permits legally apply.',
  );

  await page
    .getByRole('navigation', { name: 'Project sections' })
    .getByRole('link', { name: 'Summary' })
    .click();
  await page.getByRole('button', { name: 'Generate readiness report' }).click();
  await expect(
    page.getByRole('heading', { name: 'Readiness report' }),
  ).toBeVisible();
  await expect(
    page.getByText('Report completed with information gaps.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Illustrative guidance sources' }),
  ).toBeVisible();
  await expect(
    page.getByText(/not an application, approval, legal opinion/i),
  ).toBeVisible();
  await capture(
    'report',
    'The readiness report shows information gaps and illustrative sources. Confirm requirements with the authority.',
  );

  await page
    .getByRole('navigation', { name: 'Project sections' })
    .getByRole('link', { name: 'Tasks' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Tasks and project status' }),
  ).toBeVisible();
  const firstTask = page.locator('.task-list > li').first();
  await expect(firstTask).toBeVisible();
  await firstTask.getByRole('button', { name: 'Mark complete' }).click();
  await expect(firstTask.getByText('completed', { exact: true })).toBeVisible();
  await capture(
    'tasks',
    'Preparation tasks come from the accepted report. Completing a task does not mean a permit is approved.',
  );

  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    mainCount: document.querySelectorAll('main').length,
    h1Count: document.querySelectorAll('h1').length,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.mainCount).toBe(1);
  expect(layout.h1Count).toBe(1);
  const undersizedButtons = await page
    .locator('header button, main button, footer button')
    .evaluateAll((buttons) =>
      buttons
        .map((button) => ({
          name: button.textContent?.trim() ?? '',
          height: button.getBoundingClientRect().height,
        }))
        .filter((button) => button.height > 0 && button.height < 44),
    );
  expect(undersizedButtons).toEqual([]);
  if (captureAssets) {
    const timestamp = (milliseconds: number) =>
      new Date(milliseconds).toISOString().slice(11, 23);
    const endedAt = Date.now() - startedAt;
    const cues = captions.map(
      (caption, index) =>
        `${index + 1}\n${timestamp(caption.start)} --> ${timestamp(captions[index + 1]?.start ?? endedAt)}\n${caption.text}\n`,
    );
    await writeFile(
      testInfo.outputPath('walkthrough.vtt'),
      `WEBVTT\n\n${cues.join('\n')}`,
    );
    await writeFile(
      testInfo.outputPath('walkthrough.txt'),
      `Permit Readiness Navigator — automated local walkthrough\nSynthetic data only. No live Azure evidence.\n\n${captions.map((caption) => caption.text).join('\n\n')}\n`,
    );
  }
});
