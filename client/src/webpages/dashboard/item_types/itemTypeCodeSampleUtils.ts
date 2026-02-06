import { ItemTypeKind } from '@roostorg/types';
import zipObject from 'lodash/zipObject';

import { GQLScalarType, type GQLItemType } from '../../../graphql/generated';
import { assertUnreachable } from '../../../utils/misc';
import {
  generateFakeContainerFieldValue,
  generateFakeScalarFieldValue,
} from './itemTypeUtils';

export const ApiRoutes = ['Items API', 'Reports API'] as const;
export const RequestLanguages = ['NodeJS', 'Python', 'PHP', 'Curl'] as const;

export type ApiRoute = (typeof ApiRoutes)[number];
export type RequestLanguage = (typeof RequestLanguages)[number];

type RequestParameters = {
  apiRoute: ApiRoute;
  requestLanguage: RequestLanguage;
  itemType?: GQLItemType;
  defaultUserItemTypeId?: string;
};

export function generateRequestCode(opts: RequestParameters) {
  const { apiRoute, requestLanguage, itemType, defaultUserItemTypeId } = opts;
  if (itemType == null) {
    return '';
  }

  switch (requestLanguage) {
    case 'Curl':
      return generateCurlRequest(apiRoute, itemType, defaultUserItemTypeId);
    case 'Python':
      return generatePythonRequest(apiRoute, itemType, defaultUserItemTypeId);
    case 'NodeJS':
      return generateNodeJsRequest(apiRoute, itemType, defaultUserItemTypeId);
    case 'PHP':
      return generatePhpRequest(apiRoute, itemType, defaultUserItemTypeId);
  }
}

export function generateItemData(
  apiRoute: ApiRoute,
  itemType: GQLItemType,
  defaultUserItemTypeId?: string,
): JsonValue {
  const itemData = zipObject(
    itemType.baseFields.map((field) => field.name),
    itemType.baseFields.map((field) => {
      if (field.container) {
        return generateFakeContainerFieldValue(field);
      } else {
        return generateFakeScalarFieldValue(field.type as GQLScalarType);
      }
    }),
  );

  switch (apiRoute) {
    case 'Items API':
      return {
        items: [
          {
            id: generateFakeScalarFieldValue('ID'),
            typeId: itemType.id ?? generateFakeScalarFieldValue('ID'),
            data: itemData,
          },
        ],
      };
    case 'Reports API':
      return {
        reporter: {
          kind: ItemTypeKind.USER,
          id: generateFakeScalarFieldValue('ID'),
          typeId: defaultUserItemTypeId ?? generateFakeScalarFieldValue('ID'),
        },
        reportedAt: generateFakeScalarFieldValue('DATETIME'),
        reportedItem: {
          id: generateFakeScalarFieldValue('ID'),
          typeId: itemType.id ?? generateFakeScalarFieldValue('ID'),
          data: itemData,
        },
        reportedForReason: {
          policyId: generateFakeScalarFieldValue('POLICY_ID'),
          reason: 'Lorem ipsum dolor...',
        },
        reportedItemThread: [
          {
            id: generateFakeScalarFieldValue('ID'),
            typeId: itemType.id ?? generateFakeScalarFieldValue('ID'),
            data: {
              text: "Hey what's up?",
            },
          },
          {
            id: generateFakeScalarFieldValue('ID'),
            typeId: itemType.id ?? generateFakeScalarFieldValue('ID'),
            data: {
              text: 'Not much, you?',
            },
          },
          {
            id: generateFakeScalarFieldValue('ID'),
            typeId: itemType.id ?? generateFakeScalarFieldValue('ID'),
            data: {
              text: "I'm good!",
            },
          },
        ],
      };
    default:
      assertUnreachable(apiRoute);
  }
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export function translateJSONObjectToPHP(json: JsonValue): string {
  function translateValue(value: JsonValue, indentLevel: number = 0): string {
    const indent = '    '; // 4 spaces for indentation
    const currentIndent = indent.repeat(indentLevel);
    const nextIndent = indent.repeat(indentLevel + 1);

    if (Array.isArray(value)) {
      const arrayElements = value.map(
        (element) => `${nextIndent}${translateValue(element, indentLevel + 1)}`,
      );
      return '[\n' + arrayElements.join(',\n') + `\n${currentIndent}]`;
    } else if (typeof value === 'object' && value !== null) {
      const objectElements = Object.keys(value).map(
        (key) =>
          `${nextIndent}'${key}' => ${translateValue(
            value[key],
            indentLevel + 1,
          )}`,
      );
      return '[\n' + objectElements.join(',\n') + `\n${currentIndent}]`;
    } else if (typeof value === 'string') {
      return `'${value.replace(/'/g, "\\'")}'`;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    } else if (value === null) {
      return 'null';
    }

    assertUnreachable(value);
  }

  return translateValue(json);
}

function generateCurlRequest(
  apiRoute: ApiRoute,
  itemType: GQLItemType,
  defaultUserItemTypeId?: string,
) {
  const data = generateItemData(apiRoute, itemType, defaultUserItemTypeId);

  switch (apiRoute) {
    case 'Items API':
      return `curl --request POST --url https://getcoop.com/api/v1/items/async --header 'x-api-key: APIKEY' --header 'Content-Type: application/json' --data '${JSON.stringify(
        data,
        null,
        4,
      )}'`;
    case 'Reports API':
      return `curl --request POST --url https://getcoop.com/api/v1/report --header 'x-api-key: APIKEY' --header 'Content-Type: application/json' --data '${JSON.stringify(
        data,
        null,
        4,
      )}'`;
  }
}

function generatePythonRequest(
  apiRoute: ApiRoute,
  itemType: GQLItemType,
  defaultUserItemTypeId?: string,
) {
  const data = generateItemData(apiRoute, itemType, defaultUserItemTypeId);

  switch (apiRoute) {
    case 'Items API': {
      return `import requests

headers = {
  'x-api-key': 'APIKEY',
  'Content-Type': 'application/json'
}
data = ${JSON.stringify(data, null, 4)
        .replace(/null/g, 'None')
        .replace(/true/g, 'True')
        .replace(/false/g, 'False')}
response = requests.post(
  'https://getcoop.com/api/v1/items/async',
  headers=headers,
  json=data
)
response_dict = response.json()`;
    }
    case 'Reports API': {
      return `import requests

headers = {
  'x-api-key': 'APIKEY',
  'Content-Type': 'application/json'
}

data = ${JSON.stringify(data, null, 4)}

response = requests.post(
  'https://getcoop.com/api/v1/report',
  headers=headers,
  json=data
)
response_dict = response.json()`;
    }
  }
}

function generateNodeJsRequest(
  apiRoute: ApiRoute,
  itemType: GQLItemType,
  defaultUserItemTypeId?: string,
) {
  const data = generateItemData(apiRoute, itemType, defaultUserItemTypeId);

  switch (apiRoute) {
    case 'Items API': {
      return `const body = 
  ${JSON.stringify(data, null, 4)};

const response = await fetch(
  "https://getcoop.com/api/v1/items/async",
  {
    method: 'post',
    body: JSON.stringify(body),
    headers: {
      "x-api-key": "APIKEY",
      "Content-Type": "application/json"
    },
  }
);
console.log(response.status);
      `;
    }
    case 'Reports API': {
      return `const body = ${JSON.stringify(data, null, 4)}

const response = await fetch(
  "https://getcoop.com/api/v1/report",
  {
    method: 'post',
    body: JSON.stringify(body),
    headers: {
      "x-api-key": "APIKEY",
      "Content-Type": "application/json"
    },
  }
);
console.log(response.status);`;
    }
  }
}

function generatePhpRequest(
  apiRoute: ApiRoute,
  itemType: GQLItemType,
  defaultUserItemTypeId?: string,
) {
  const data = translateJSONObjectToPHP(
    generateItemData(apiRoute, itemType, defaultUserItemTypeId),
  );

  switch (apiRoute) {
    case 'Items API': {
      return `<?php
require_once('vendor/autoload.php');

$client = new GuzzleHttpClient();

$headers = [
  'x-api-key' => 'APIKEY',
  'Content-Type' => 'application/json'
];

$body = ${data};

$response = $client->request('POST', 'https://getcoop.com/api/v1/items/async', [
  'headers' => $headers,
  'json' => $body,
]);

echo $response->getBody();`;
    }
    case 'Reports API': {
      return `<?php
require_once('vendor/autoload.php');

$client = new GuzzleHttpClient();

$headers = [
  'x-api-key' => 'APIKEY',
  'Content-Type' => 'application/json'
];

$body = ${data};
  

$response = $client->request('POST', 'https://getcoop.com/api/v1/report', [
  'headers' => $headers,
  'json' => $body,
]);

echo $response->getBody();`;
    }
  }
}
