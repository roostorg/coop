import '@adonisjs/core/types/http';

type ParamValue = string | number | bigint | boolean;

export type ScannedRoutes = {
  ALL: {
    'saml.login': { paramsTuple: [ParamValue]; params: { orgId: ParamValue } };
    'saml.callback': {
      paramsTuple: [ParamValue];
      params: { orgId: ParamValue };
    };
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
  GET: {
    'saml.login': { paramsTuple: [ParamValue]; params: { orgId: ParamValue } };
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
  HEAD: {
    'saml.login': { paramsTuple: [ParamValue]; params: { orgId: ParamValue } };
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
  POST: {
    'saml.callback': {
      paramsTuple: [ParamValue];
      params: { orgId: ParamValue };
    };
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
  OPTIONS: {
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
  PUT: {
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
  PATCH: {
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
  DELETE: {
    graphql: { paramsTuple?: []; params?: {} };
    'graphql.subpath': {
      paramsTuple: [...ParamValue[]];
      params: { '*': ParamValue[] };
    };
  };
};
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}
