# AWS Infrastructure (Reference Only)

> **Note:** This directory contains the AWS CDK infrastructure code that was used for production deployments. It is kept here as **reference documentation** to help contributors understand the infrastructure architecture, but is **no longer actively deployed**.
>
> All cloud deployment workflows have been removed as this project is now open source and does not maintain production or staging environments.

## About This Infrastructure

This CDK application defined the complete AWS infrastructure for the application, including:

- **VPC and Networking**: Multi-AZ VPC setup with public/private subnets
- **Kubernetes (EKS)**: Managed Kubernetes clusters for running the API and workers
- **Databases**: RDS PostgreSQL, Redis, ScyllaDB, and Snowflake integrations
- **API Gateway**: REST API with rate limiting and usage plans
- **CloudFront**: CDN for static assets and API caching
- **Monitoring**: Datadog integration and CloudWatch alarms
- **CI/CD**: GitHub Actions runner infrastructure

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## Architecture Overview

The infrastructure was organized into three environments:
- **Production** (`PipelineStack/Prod/*`): Full production environment on the `main` branch
- **Staging** (`StagingPipelineStack/Staging/*`): Testing environment on the `staging` branch
- **Demo** (`Demo`): Demo/development environment

## Reference Commands

These commands are for reference only and will not work without AWS credentials and infrastructure:

- `npm run build` - compile typescript to js
- `npm run watch` - watch for changes and compile
- `npm run test` - perform the jest unit tests
- `npx cdk deploy` - deploy this stack to your default AWS account/region
- `npx cdk diff` - compare deployed stack with current state
- `npx cdk synth` - emits the synthesized CloudFormation template

## Local Development

For local development, see the Docker Compose setup in the repository root.
