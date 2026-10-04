import { expect, test, type Page } from '@playwright/test';

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
});
