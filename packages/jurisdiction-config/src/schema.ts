import {
  GeoJsonPolygonSchema,
  GuidanceSourceSchema,
  IntakeQuestionSetSchema,
  IsoDateSchema,
  PermitDependencySchema,
  PermitRuleSchema,
  PermitTypeSchema,
  ProjectTypeSchema,
  SlugSchema,
  VersionSchema,
  type PermitCondition,
} from '@permit-readiness/contracts';
import { validatePermitDependencies } from '@permit-readiness/domain';
import { z } from 'zod';

export const JURISDICTION_CONFIG_SCHEMA_VERSION = '1.0.0';

export const JurisdictionBrandReferenceSchema = z
  .object({
    themeId: SlugSchema,
    assetPath: z
      .string()
      .min(1)
      .max(500)
      .regex(/^\/[A-Za-z0-9_./-]+$/)
      .optional(),
    assetProvenance: z.string().min(10).max(1000).optional(),
    approved: z.boolean(),
  })
  .strict()
  .superRefine((brand, context) => {
    if (brand.assetPath && (!brand.assetProvenance || !brand.approved)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['assetPath'],
        message:
          'Brand assets require provenance and explicit approval metadata.',
      });
    }
  });

export const DemoZoneSchema = z
  .object({
    id: SlugSchema,
    name: z.string().min(2).max(200),
    description: z.string().min(10).max(1000),
    geometry: GeoJsonPolygonSchema,
    synthetic: z.literal(true),
  })
  .strict();

export const JurisdictionContentSchema = z
  .object({
    demonstrationNotice: z.string().min(20).max(2000),
    nonBindingDisclaimer: z.string().min(20).max(3000),
    privacyNotice: z.string().min(20).max(3000),
    accessibilityHelp: z.string().min(20).max(3000),
    escalationText: z.string().min(20).max(3000),
  })
  .strict();

export const JurisdictionFeatureFlagsSchema = z
  .object({
    agentEnabled: z.boolean(),
    mapEnabled: z.boolean(),
    localDemoIdentityEnabled: z.boolean(),
    taskTrackingEnabled: z.boolean(),
  })
  .strict();

export const JurisdictionConfigurationSchema = z
  .object({
    schemaVersion: z.literal(JURISDICTION_CONFIG_SCHEMA_VERSION),
    jurisdiction: z
      .object({
        id: SlugSchema,
        name: z.string().min(2).max(160),
        regionCode: z
          .string()
          .min(2)
          .max(16)
          .regex(/^[A-Z0-9-]+$/),
        locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
        serviceName: z.string().min(2).max(160),
        brand: JurisdictionBrandReferenceSchema,
      })
      .strict(),
    release: z
      .object({
        version: VersionSchema,
        state: z.enum(['draft', 'approved', 'retired']),
        effectiveDate: IsoDateSchema.optional(),
        contentVersion: VersionSchema,
        ruleVersion: VersionSchema,
        guidanceVersion: VersionSchema,
      })
      .strict(),
    projectTypes: z.array(ProjectTypeSchema).min(1).max(100),
    questionSets: z.array(IntakeQuestionSetSchema).min(1).max(100),
    permits: z.array(PermitTypeSchema).min(1).max(250),
    rules: z.array(PermitRuleSchema).min(1).max(1000),
    permitDependencies: z.array(PermitDependencySchema).max(1000),
    demoZones: z.array(DemoZoneSchema).max(250),
    guidanceSources: z.array(GuidanceSourceSchema).min(1).max(500),
    content: JurisdictionContentSchema,
    featureFlags: JurisdictionFeatureFlagsSchema,
    provenance: z
      .object({
        owner: z.string().min(2).max(200),
        reviewedBy: z.string().min(2).max(200),
        reviewedAt: IsoDateSchema,
        synthetic: z.boolean(),
        notes: z.string().min(10).max(2000),
      })
      .strict(),
  })
  .strict()
  .superRefine((configuration, context) => {
    if (
      configuration.release.state === 'approved' &&
      !configuration.release.effectiveDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['release', 'effectiveDate'],
        message: 'Approved releases require an effective date.',
      });
    }

    const ensureUnique = (
      values: readonly string[],
      path: readonly (string | number)[],
      label: string,
    ) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path],
          message: `${label} identifiers must be unique.`,
        });
      }
    };

    ensureUnique(
      configuration.projectTypes.map((item) => item.id),
      ['projectTypes'],
      'Project type',
    );
    ensureUnique(
      configuration.questionSets.map((item) => item.id),
      ['questionSets'],
      'Question set',
    );
    ensureUnique(
      configuration.permits.map((item) => item.id),
      ['permits'],
      'Permit',
    );
    ensureUnique(
      configuration.rules.map((item) => item.id),
      ['rules'],
      'Rule',
    );
    ensureUnique(
      configuration.demoZones.map((item) => item.id),
      ['demoZones'],
      'Demo zone',
    );
    ensureUnique(
      configuration.guidanceSources.map((item) => item.id),
      ['guidanceSources'],
      'Guidance source',
    );

    const projectTypeIds = new Set(
      configuration.projectTypes.map((item) => item.id),
    );
    const questionSetsById = new Map(
      configuration.questionSets.map((item) => [item.id, item] as const),
    );
    const questionIds = new Set(
      configuration.questionSets.flatMap((set) =>
        set.questions.map((question) => question.id),
      ),
    );
    const permitIds = new Set(configuration.permits.map((item) => item.id));
    const zoneIds = new Set(configuration.demoZones.map((item) => item.id));
    const sourceIds = new Set(
      configuration.guidanceSources.map((item) => item.id),
    );

    configuration.projectTypes.forEach((projectType, index) => {
      const questionSet = questionSetsById.get(projectType.intakeQuestionSetId);
      if (!questionSet) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['projectTypes', index, 'intakeQuestionSetId'],
          message: 'Project type references an unknown question set.',
        });
      } else if (!questionSet.projectTypeIds.includes(projectType.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['projectTypes', index, 'intakeQuestionSetId'],
          message: 'Question set does not include this project type.',
        });
      }
    });

    configuration.questionSets.forEach((set, setIndex) => {
      set.projectTypeIds.forEach((projectTypeId, projectTypeIndex) => {
        if (!projectTypeIds.has(projectTypeId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              'questionSets',
              setIndex,
              'projectTypeIds',
              projectTypeIndex,
            ],
            message: 'Question set references an unknown project type.',
          });
        }
      });
    });

    configuration.permits.forEach((permit, permitIndex) => {
      permit.guidanceSourceIds.forEach((sourceId, sourceIndex) => {
        if (!sourceIds.has(sourceId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['permits', permitIndex, 'guidanceSourceIds', sourceIndex],
            message: 'Permit references an unknown guidance source.',
          });
        }
      });
    });

    const validateConditionReferences = (
      condition: PermitCondition,
      path: (string | number)[],
    ): void => {
      switch (condition.type) {
        case 'project_type':
          condition.projectTypeIds.forEach((projectTypeId, index) => {
            if (!projectTypeIds.has(projectTypeId)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, 'projectTypeIds', index],
                message: 'Rule references an unknown project type.',
              });
            }
          });
          break;
        case 'answer':
          if (!questionIds.has(condition.questionId)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [...path, 'questionId'],
              message: 'Rule references an unknown intake question.',
            });
          }
          break;
        case 'location_intersects_zone':
          condition.zoneIds.forEach((zoneId, index) => {
            if (!zoneIds.has(zoneId)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, 'zoneIds', index],
                message: 'Rule references an unknown demo zone.',
              });
            }
          });
          break;
        case 'all':
        case 'any':
          condition.conditions.forEach((child, index) =>
            validateConditionReferences(child, [...path, 'conditions', index]),
          );
          break;
        case 'not':
          validateConditionReferences(condition.condition, [
            ...path,
            'condition',
          ]);
          break;
        case 'location_provided':
          break;
      }
    };

    configuration.rules.forEach((rule, index) => {
      if (!permitIds.has(rule.permitTypeId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rules', index, 'permitTypeId'],
          message: 'Rule references an unknown permit.',
        });
      }
      if (rule.version !== configuration.release.ruleVersion) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rules', index, 'version'],
          message: 'Rule version must match the release rule version.',
        });
      }
      rule.sourceIds?.forEach((sourceId, sourceIndex) => {
        if (!sourceIds.has(sourceId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rules', index, 'sourceIds', sourceIndex],
            message: 'Rule references an unknown guidance source.',
          });
        }
      });
      rule.followUpQuestionIds?.forEach((questionId, questionIndex) => {
        if (!questionIds.has(questionId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rules', index, 'followUpQuestionIds', questionIndex],
            message: 'Rule references an unknown follow-up question.',
          });
        }
      });
      validateConditionReferences(rule.condition, [
        'rules',
        index,
        'condition',
      ]);
    });

    configuration.guidanceSources.forEach((source, index) => {
      if (source.jurisdictionId !== configuration.jurisdiction.id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guidanceSources', index, 'jurisdictionId'],
          message: 'Guidance source jurisdiction must match the release.',
        });
      }
      if (source.version !== configuration.release.guidanceVersion) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guidanceSources', index, 'version'],
          message: 'Guidance source version must match the release.',
        });
      }
    });

    for (const issue of validatePermitDependencies(
      [...permitIds],
      configuration.permitDependencies,
    )) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['permitDependencies'],
        message: `Invalid permit dependency (${issue.code}) for ${issue.permitTypeId}.`,
      });
    }
  });

export type JurisdictionConfiguration = z.infer<
  typeof JurisdictionConfigurationSchema
>;

export function parseJurisdictionConfiguration(
  input: unknown,
): JurisdictionConfiguration {
  return JurisdictionConfigurationSchema.parse(input);
}

export function safeParseJurisdictionConfiguration(input: unknown) {
  return JurisdictionConfigurationSchema.safeParse(input);
}
