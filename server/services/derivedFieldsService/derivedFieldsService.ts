import {
  ContainerTypes,
  getScalarType,
  ScalarTypes,
  type Field,
  type ScalarType,
} from '@roostorg/types';
import _ from 'lodash';

import { inject } from '../../iocContainer/index.js';
import { assertUnreachable } from '../../utils/misc.js';
import {
  CoopInput,
  type ItemSchema,
} from '../moderationConfigService/index.js';
import {
  type SignalInputType,
  type SignalOutputType,
} from '../signalsService/index.js';
import {
  derivedFieldRecipes,
  getDerivedFieldInputTypes,
  getDerivedFieldIsEnabled,
  getDerivedFieldOutputType,
  type DerivedFieldRecipe,
  type DerivedFieldSpec,
  type DerivedFieldType,
} from './helpers.js';

type AnnotatedDerivedFieldRecipe = {
  type: DerivedFieldType;
  recipe: DerivedFieldRecipe;
  outputType: SignalOutputType;
};

type DerivedField = Pick<Field, 'type' | 'container' | 'name'> & {
  spec: DerivedFieldSpec;
};

export const makeDerivedFieldsService = inject(
  ['SignalsService'],
  function (signalsService) {
    const getSignal = signalsService.getSignalOrThrow.bind(signalsService);
    const getSignalDisabled =
      signalsService.getSignalDisabledForOrg.bind(signalsService);

    const recipesByFieldTypeEntries = Object.entries(derivedFieldRecipes) as [
      DerivedFieldType,
      DerivedFieldRecipe,
    ][];

    const getAnnotatedDerivedFieldRecipesByInputType = async (
      orgId: string,
    ): Promise<{
      [K in SignalInputType]?: AnnotatedDerivedFieldRecipe[];
    }> => {
      const annotatedDerivedFieldRecipes = await Promise.all(
        recipesByFieldTypeEntries.map(async ([fieldType, recipe]) => {
          const enabled = await getDerivedFieldIsEnabled(
            getSignalDisabled,
            fieldType,
            orgId,
          );
          if (!enabled) {
            return [];
          }
          const inputTypes = await getDerivedFieldInputTypes(
            getSignal,
            fieldType,
            orgId,
          );
          return Promise.all(
            inputTypes.map(async (inputType) => ({
              type: fieldType,
              recipe,
              inputType,
              outputType: await getDerivedFieldOutputType(
                getSignal,
                fieldType,
                orgId,
              ),
            })),
          );
        }),
      ).then((it) => it.flat());

      return _.groupBy(annotatedDerivedFieldRecipes, (it) => {
        // _.groupBy will only work faithfully if the inputTypes ae strings,
        // as it's gonna use inputType as an object key. Flag that so we don't
        // forget if we expand the valid input types later.
        if (typeof it.inputType !== 'string') {
          throw new Error('Code expected inputType to be a string');
        }
        return it.inputType;
      });
    };

    const getAnnotatedRecipesForInputType = async (
      it: SignalInputType,
      orgId: string,
    ) => {
      return (
        (await getAnnotatedDerivedFieldRecipesByInputType(orgId))[it] ?? []
      );
    };

    const hasFieldOfScalarType = (schema: ItemSchema, type: ScalarType) =>
      schema.some((field) => getScalarType(field) === type);

    return {
      async getDerivedFields(
        contentTypeId: string,
        schema: ItemSchema,
        orgId: string,
      ): Promise<DerivedField[]> {
        const derivedFieldsFromIndividualFields = await Promise.all(
          schema.map(async (field) => {
            const fieldScalarType = getScalarType(field);
            const applicableRecipes = await getAnnotatedRecipesForInputType(
              fieldScalarType,
              orgId,
            );

            return applicableRecipes.map((it): DerivedField => {
              const spec = {
                derivationType: it.type,
                source: {
                  type: 'CONTENT_FIELD' as const,
                  name: field.name,
                  contentTypeId,
                },
              };
              return {
                type: it.outputType.scalarType,
                container: field.container,
                name: getNameForDerivedField(spec),
                spec,
              };
            });
          }),
        ).then((it) => it.flat());

        const derivedFieldsFromCoopInputs = await Promise.all(
          Object.values(CoopInput).map(
            async (it): Promise<DerivedField[]> => {
              // using a switch here is a good way to get exhaustiveness
              // checking for when we inevitably add new CoopInputs.
              switch (it) {
                case CoopInput.AUTHOR_USER:
                  return (
                    await getAnnotatedRecipesForInputType(
                      ScalarTypes.USER_ID,
                      orgId,
                    )
                  ).map((recipe) =>
                    makeCoopInputDerivedFieldSpec(
                      recipe,
                      CoopInput.AUTHOR_USER,
                    ),
                  );

                case CoopInput.ALL_TEXT:
                  return hasFieldOfScalarType(schema, ScalarTypes.STRING)
                    ? (
                        await getAnnotatedRecipesForInputType(
                          ScalarTypes.STRING,
                          orgId,
                        )
                      ).map((recipe) =>
                        makeCoopInputDerivedFieldSpec(
                          recipe,
                          CoopInput.ALL_TEXT,
                        ),
                      )
                    : [];

                case CoopInput.ANY_GEOHASH:
                  return hasFieldOfScalarType(schema, ScalarTypes.GEOHASH)
                    ? (
                        await getAnnotatedRecipesForInputType(
                          ScalarTypes.GEOHASH,
                          orgId,
                        )
                      ).map((recipe) =>
                        makeCoopInputDerivedFieldSpec(
                          recipe,
                          CoopInput.ANY_GEOHASH,
                        ),
                      )
                    : [];

                case CoopInput.ANY_IMAGE:
                  return hasFieldOfScalarType(schema, ScalarTypes.IMAGE)
                    ? (
                        await getAnnotatedRecipesForInputType(
                          ScalarTypes.IMAGE,
                          orgId,
                        )
                      ).map((recipe) =>
                        makeCoopInputDerivedFieldSpec(
                          recipe,
                          CoopInput.ANY_IMAGE,
                        ),
                      )
                    : [];

                case CoopInput.ANY_VIDEO:
                  return hasFieldOfScalarType(schema, ScalarTypes.VIDEO)
                    ? (
                        await getAnnotatedRecipesForInputType(
                          ScalarTypes.VIDEO,
                          orgId,
                        )
                      ).map((recipe) =>
                        makeCoopInputDerivedFieldSpec(
                          recipe,
                          CoopInput.ANY_VIDEO,
                        ),
                      )
                    : [];
                case CoopInput.POLICY_ID:
                case CoopInput.SOURCE:
                  return [];
                default:
                  assertUnreachable(it);
              }
            },
          ),
        ).then((it) => it.flat());

        return [
          ...derivedFieldsFromIndividualFields,
          ...derivedFieldsFromCoopInputs,
        ];
      },
    };
  },
);

export type DerivedFieldsService = ReturnType<typeof makeDerivedFieldsService>;

function getDisplayStringForDerivationType(derivationType: DerivedFieldType) {
  switch (derivationType) {
    case 'VIDEO_TRANSCRIPTION':
      return 'Transcription';
    case 'ENGLISH_TRANSLATION':
      return 'English Translation';
    default:
      assertUnreachable(derivationType);
  }
}

/**
 * This returns a human-readable name (which may eventually be localized) for
 * the field defined by a derived field's spec.
 */
export function getNameForDerivedField(spec: DerivedFieldSpec) {
  const { source, derivationType } = spec;
  const derivationTypeName = getDisplayStringForDerivationType(derivationType);

  switch (source.type) {
    case 'CONTENT_FIELD':
    case 'CONTENT_COOP_INPUT':
      return `${source.name}'s ${derivationTypeName}`;
    case 'FULL_ITEM':
      return "Content's " + derivationTypeName;
    default:
      assertUnreachable(source);
  }
}

function makeCoopInputDerivedFieldSpec(
  recipe: AnnotatedDerivedFieldRecipe,
  source: CoopInput,
): DerivedField {
  const isScalar = (() => {
    switch (source) {
      case CoopInput.ALL_TEXT:
      case CoopInput.AUTHOR_USER:
      case CoopInput.POLICY_ID:
      case CoopInput.SOURCE:
        return true;
      case CoopInput.ANY_GEOHASH:
      case CoopInput.ANY_VIDEO:
      case CoopInput.ANY_IMAGE:
        return false;
      default:
        assertUnreachable(source);
    }
  })();

  const spec = {
    derivationType: recipe.type,
    source: { type: 'CONTENT_COOP_INPUT' as const, name: source },
  };

  return {
    ...(isScalar
      ? { type: recipe.outputType.scalarType, container: null }
      : {
          type: ContainerTypes.ARRAY,
          container: {
            containerType: ContainerTypes.ARRAY,
            valueScalarType: recipe.outputType.scalarType,
            keyScalarType: null,
          },
        }),
    name: getNameForDerivedField(spec),
    spec,
  };
}
