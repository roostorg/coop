import { useGQLGetRelatedItemsQuery } from '@/graphql/generated';
import { ItemTypeFieldFieldData } from '@/webpages/dashboard/item_types/itemTypeUtils';
import { gql } from '@apollo/client';
import { ItemIdentifier } from '@roostorg/types';

import FieldsComponent from './ManualReviewJobFieldsComponent';

gql`
  query getRelatedItems($itemIdentifiers: [ItemIdentifierInput!]!) {
    latestItemSubmissions(itemIdentifiers: $itemIdentifiers) {
      ... on UserItem {
        id
        submissionId
        submissionTime
        data
        type {
          id
          name
          baseFields {
            name
            type
            required
            container {
              containerType
              keyScalarType
              valueScalarType
            }
          }
          schemaFieldRoles {
            displayName
            createdAt
            profileIcon
            backgroundImage
          }
        }
      }
      ... on ContentItem {
        id
        submissionId
        submissionTime
        data
        type {
          id
          name
          baseFields {
            name
            type
            required
            container {
              containerType
              keyScalarType
              valueScalarType
            }
          }
        }
      }
      ... on ThreadItem {
        id
        submissionId
        submissionTime
        data
        type {
          id
          name
          baseFields {
            name
            type
            required
            container {
              containerType
              keyScalarType
              valueScalarType
            }
          }
        }
      }
    }
  }
`;
export default function ContentRelatedItemComponent(props: {
  relatedItem: ItemIdentifier;
  unblurAllMedia: boolean;
  title: string;
}) {
  const { relatedItem, unblurAllMedia } = props;
  const { data, error } = useGQLGetRelatedItemsQuery({
    variables: {
      itemIdentifiers: [relatedItem],
    },
  });
  if (!data || error) {
    return null;
  }
  const item = data.latestItemSubmissions[0];

  const fieldData = item.type.baseFields.map(
    (
      itemTypeField, // itemTypeField comes back as a GQLBaseField, and the GQL types
    ) =>
      ({
        ...itemTypeField,
        value: item.data[itemTypeField.name],
      }) as ItemTypeFieldFieldData,
  );
  return (
    <div className="flex flex-col items-start justify-start w-full py-4 mt-8 space-y-2 bg-white border border-gray-200 border-solid rounded-lg">
      <div className="flex flex-col w-full mx-4">
        <div className="text-lg font-semibold text-start">
          {/* TODO: make this title org-agnostic  */}
          {props.title}
        </div>
      </div>

      <div className="max-w-full min-w-[50%] grow mx-4">
        <FieldsComponent
          fields={fieldData}
          itemTypeId={item.type.id}
          options={{
            unblurAllMedia,
            maxHeightImage: 300,
            maxHeightVideo: 300,
          }}
        />
      </div>
    </div>
  );
}
