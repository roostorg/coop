# Deployment

For historical reference, AWS infrastructure code (CDK, Helm charts, Pulumi, CDKTF) that was previously used for production deployments is available on the [`0.1` branch](https://github.com/roostorg/coop/tree/0.1/.devops). That infrastructure code may have drifted from the current application architecture and is no longer maintained, but can serve as a reference for your own deployment.

**IMPORTANT** When you run migrations, we create a sample org which contains users with default passwords. Make sure you clean up in a production environment.
