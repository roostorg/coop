declare module 'json-to-pretty-yaml' {
  function jsonToYaml(json: any): string;
  export = { stringify: jsonToYaml };
}
