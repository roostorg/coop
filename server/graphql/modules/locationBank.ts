import { AuthenticationError } from 'apollo-server-express';

import { type LocationBank as TLocationBank } from '../../models/banks/LocationBankModel.js';
import { isCoopErrorOfType } from '../../utils/errors.js';
import {
  type GQLMutationResolvers,
  type GQLQueryResolvers,
} from '../generated.js';
import { type ResolverMap } from '../resolvers.js';
import { gqlErrorResult, gqlSuccessResult } from '../utils/gqlResult.js';

const typeDefs = /* GraphQL */ `
  type Query {
    locationBank(id: ID!): LocationBank
  }

  type Mutation {
    createLocationBank(
      input: CreateLocationBankInput!
    ): MutateLocationBankResponse!
    updateLocationBank(
      input: UpdateLocationBankInput!
    ): MutateLocationBankResponse!
    deleteLocationBank(id: ID!): Boolean
  }

  type LocationBankNameExistsError implements Error {
    title: String!
    status: Int!
    type: [String!]!
    pointer: String
    detail: String
    requestId: String
  }

  union MutateLocationBankResponse =
      MutateLocationBankSuccessResponse
    | LocationBankNameExistsError

  type MutateLocationBankSuccessResponse {
    data: LocationBank!
  }

  type LatLng {
    lat: Float!
    lng: Float!
  }

  input LatLngInput {
    lat: Float!
    lng: Float!
  }

  type PlaceBounds {
    northeastCorner: LatLng!
    southwestCorner: LatLng!
  }

  input PlaceBoundsInput {
    northeastCorner: LatLngInput!
    southwestCorner: LatLngInput!
  }

  type LocationGeometry {
    center: LatLng!
    radius: Float!
  }

  # TODO: currently, radius is always provided by the frontend, but sometimes
  # the frontend sends 0 to indicate that it doesn't know the radius. Eventually,
  # we want it to just leave out the radius instead, but that'll require a
  # backend tweak first.
  input LocationGeometryInput {
    center: LatLngInput!
    radius: Float!
  }

  type LocationArea {
    id: ID!
    name: String
    geometry: LocationGeometry!
    bounds: PlaceBounds
    googlePlaceInfo: GooglePlaceLocationInfo
  }

  type GooglePlaceLocationInfo {
    id: ID!
  }

  input LocationAreaInput {
    name: String

    # todo, merge bounds + geometry into one input union-like field.
    bounds: PlaceBoundsInput
    geometry: LocationGeometryInput!

    # Optional googlePlaceId that will be echoed back in
    # LocationArea.googlePlaceInfo.id to track that this locationArea came
    # from a Google Place.
    googlePlaceId: String
  }

  type LocationBank {
    id: ID!
    name: String!
    description: String
    locations: [LocationArea!]!
  }

  input CreateLocationBankInput {
    name: String!
    description: String
    locations: [LocationAreaInput!]!
  }

  input UpdateLocationBankInput {
    id: ID!
    name: String
    description: String
    locationsToAdd: [LocationAreaInput!]
    locationsToDelete: [String!]
  }
`;

const LocationBank: ResolverMap<TLocationBank> = {
  async locations(locationBank, _, __) {
    return locationBank.getLocations();
  },
};

const Query: GQLQueryResolvers = {
  async locationBank(_, { id }, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.dataSources.locationBankAPI.getGraphQLLocationBankFromId({
      id,
      orgId: user.orgId,
    });
  },
};

const Mutation: GQLMutationResolvers = {
  async createLocationBank(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('User required.');
      }

      const bank = await context.dataSources.locationBankAPI.createLocationBank(
        params.input,
        user,
      );
      return gqlSuccessResult(
        { data: bank },
        'MutateLocationBankSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'LocationBankNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      throw e;
    }
  },
  async updateLocationBank(_, params, context) {
    try {
      const user = context.getUser();
      if (user == null) {
        throw new AuthenticationError('User required.');
      }

      const bank = context.dataSources.locationBankAPI.updateLocationBank(
        params.input,
        user.orgId,
      );
      return gqlSuccessResult(
        { data: bank },
        'MutateLocationBankSuccessResponse',
      );
    } catch (e: unknown) {
      if (isCoopErrorOfType(e, 'LocationBankNameExistsError')) {
        return gqlErrorResult(e, `/input/name`);
      }

      throw e;
    }
  },
  async deleteLocationBank(_, params, context) {
    const user = context.getUser();
    if (user == null) {
      throw new AuthenticationError('Authenticated user required');
    }

    return context.dataSources.locationBankAPI.deleteLocationBank({
      id: params.id,
      orgId: user.orgId,
    });
  },
};

const resolvers = {
  Query,
  Mutation,
  LocationBank,
};

export { typeDefs, resolvers };
