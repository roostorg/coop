import { App } from 'cdktf';

import { ScyllaStack } from './scylla/scylla';
import { StateBackendStack } from './state-backend';
import type { StackProps } from './types';

export type StateBackendStackProps = StackProps & {};

const app = new App();

export type EnvironmentProps = StackProps & {
  scylla: {
    clusterName: string;
    nodeType: string;
    scyllaVersion: string;
    nodeCount: number;
    nodeDiskSize: number;
  };
  sourceBranch: string;
  lifecycle: {
    preventDestroy: boolean;
  };
};

function deployEnvironment(props: EnvironmentProps) {
  new StateBackendStack(app, `${props.environment}-state-backends`, {
    ...props,
  });
  new ScyllaStack(app, `${props.environment}-scylla`, {
    ...props,
  });
}

deployEnvironment({
  region: 'us-east-2',
  environment: 'staging',
  sourceBranch: 'staging',
  lifecycle: {
    preventDestroy: false,
  },
  scylla: {
    clusterName: 'Coop Staging',
    nodeType: 't3.micro',
    nodeCount: 3,
    nodeDiskSize: 60,
    scyllaVersion: '2024.1.4',
  },
});

deployEnvironment({
  region: 'us-east-2',
  environment: 'production',
  sourceBranch: 'main',
  lifecycle: {
    preventDestroy: true,
  },
  scylla: {
    clusterName: 'Coop Prod',
    nodeType: 'i3en.large',
    scyllaVersion: '2024.1.4',
    nodeCount: 9,
    nodeDiskSize: 1250,
  },
});

app.synth();
