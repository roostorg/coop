import { ApiObject, GroupVersionKind } from 'cdk8s';
import { Construct } from 'constructs';

/**
 * MutatingWebhookConfiguration describes the configuration of and admission webhook that accept or reject and may change the object.
 *
 * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfiguration
 */
export declare class KubeMutatingWebhookConfiguration extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.admissionregistration.v1.MutatingWebhookConfiguration"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.admissionregistration.v1.MutatingWebhookConfiguration".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeMutatingWebhookConfigurationProps): any;
  /**
   * Defines a "io.k8s.api.admissionregistration.v1.MutatingWebhookConfiguration" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubeMutatingWebhookConfigurationProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * MutatingWebhookConfigurationList is a list of MutatingWebhookConfiguration.
 *
 * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfigurationList
 */
export declare class KubeMutatingWebhookConfigurationList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.admissionregistration.v1.MutatingWebhookConfigurationList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.admissionregistration.v1.MutatingWebhookConfigurationList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeMutatingWebhookConfigurationListProps): any;
  /**
   * Defines a "io.k8s.api.admissionregistration.v1.MutatingWebhookConfigurationList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeMutatingWebhookConfigurationListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ValidatingWebhookConfiguration describes the configuration of and admission webhook that accept or reject and object without changing it.
 *
 * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfiguration
 */
export declare class KubeValidatingWebhookConfiguration extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.admissionregistration.v1.ValidatingWebhookConfiguration"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.admissionregistration.v1.ValidatingWebhookConfiguration".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeValidatingWebhookConfigurationProps): any;
  /**
   * Defines a "io.k8s.api.admissionregistration.v1.ValidatingWebhookConfiguration" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubeValidatingWebhookConfigurationProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ValidatingWebhookConfigurationList is a list of ValidatingWebhookConfiguration.
 *
 * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfigurationList
 */
export declare class KubeValidatingWebhookConfigurationList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.admissionregistration.v1.ValidatingWebhookConfigurationList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.admissionregistration.v1.ValidatingWebhookConfigurationList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeValidatingWebhookConfigurationListProps): any;
  /**
   * Defines a "io.k8s.api.admissionregistration.v1.ValidatingWebhookConfigurationList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeValidatingWebhookConfigurationListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 *
 Storage version of a specific resource.
 *
 * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersion
 */
export declare class KubeStorageVersionV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apiserverinternal.v1alpha1.StorageVersion"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apiserverinternal.v1alpha1.StorageVersion".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeStorageVersionV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.apiserverinternal.v1alpha1.StorageVersion" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeStorageVersionV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * A list of StorageVersions.
 *
 * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersionList
 */
export declare class KubeStorageVersionListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apiserverinternal.v1alpha1.StorageVersionList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apiserverinternal.v1alpha1.StorageVersionList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeStorageVersionListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.apiserverinternal.v1alpha1.StorageVersionList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeStorageVersionListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ControllerRevision implements an immutable snapshot of state data. Clients are responsible for serializing and deserializing the objects that contain their internal state. Once a ControllerRevision has been successfully created, it can not be updated. The API Server will fail validation of all requests that attempt to mutate the Data field. ControllerRevisions may, however, be deleted. Note that, due to its use by both the DaemonSet and StatefulSet controllers for update and rollback, this object is beta. However, it may be subject to name and representation changes in future releases, and clients should not depend on its stability. It is primarily for internal use by controllers.
 *
 * @schema io.k8s.api.apps.v1.ControllerRevision
 */
export declare class KubeControllerRevision extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.ControllerRevision"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.ControllerRevision".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeControllerRevisionProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.ControllerRevision" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeControllerRevisionProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ControllerRevisionList is a resource containing a list of ControllerRevision objects.
 *
 * @schema io.k8s.api.apps.v1.ControllerRevisionList
 */
export declare class KubeControllerRevisionList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.ControllerRevisionList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.ControllerRevisionList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeControllerRevisionListProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.ControllerRevisionList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeControllerRevisionListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * DaemonSet represents the configuration of a daemon set.
 *
 * @schema io.k8s.api.apps.v1.DaemonSet
 */
export declare class KubeDaemonSet extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.DaemonSet"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.DaemonSet".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeDaemonSetProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.DaemonSet" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeDaemonSetProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * DaemonSetList is a collection of daemon sets.
 *
 * @schema io.k8s.api.apps.v1.DaemonSetList
 */
export declare class KubeDaemonSetList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.DaemonSetList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.DaemonSetList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeDaemonSetListProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.DaemonSetList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeDaemonSetListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Deployment enables declarative updates for Pods and ReplicaSets.
 *
 * @schema io.k8s.api.apps.v1.Deployment
 */
export declare class KubeDeployment extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.Deployment"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.Deployment".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeDeploymentProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.Deployment" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeDeploymentProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * DeploymentList is a list of Deployments.
 *
 * @schema io.k8s.api.apps.v1.DeploymentList
 */
export declare class KubeDeploymentList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.DeploymentList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.DeploymentList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeDeploymentListProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.DeploymentList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeDeploymentListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ReplicaSet ensures that a specified number of pod replicas are running at any given time.
 *
 * @schema io.k8s.api.apps.v1.ReplicaSet
 */
export declare class KubeReplicaSet extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.ReplicaSet"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.ReplicaSet".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeReplicaSetProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.ReplicaSet" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeReplicaSetProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ReplicaSetList is a collection of ReplicaSets.
 *
 * @schema io.k8s.api.apps.v1.ReplicaSetList
 */
export declare class KubeReplicaSetList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.ReplicaSetList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.ReplicaSetList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeReplicaSetListProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.ReplicaSetList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeReplicaSetListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * StatefulSet represents a set of pods with consistent identities. Identities are defined as:
 - Network: A single stable DNS and hostname.
 - Storage: As many VolumeClaims as requested.
The StatefulSet guarantees that a given network identity will always map to the same storage identity.
 *
 * @schema io.k8s.api.apps.v1.StatefulSet
 */
export declare class KubeStatefulSet extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.StatefulSet"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.StatefulSet".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeStatefulSetProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.StatefulSet" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeStatefulSetProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * StatefulSetList is a collection of StatefulSets.
 *
 * @schema io.k8s.api.apps.v1.StatefulSetList
 */
export declare class KubeStatefulSetList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.apps.v1.StatefulSetList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.apps.v1.StatefulSetList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeStatefulSetListProps): any;
  /**
   * Defines a "io.k8s.api.apps.v1.StatefulSetList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeStatefulSetListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * TokenRequest requests a token for a given service account.
 *
 * @schema io.k8s.api.authentication.v1.TokenRequest
 */
export declare class KubeTokenRequest extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.authentication.v1.TokenRequest"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.authentication.v1.TokenRequest".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeTokenRequestProps): any;
  /**
   * Defines a "io.k8s.api.authentication.v1.TokenRequest" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeTokenRequestProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * TokenReview attempts to authenticate a token to a known user. Note: TokenReview requests may be cached by the webhook token authenticator plugin in the kube-apiserver.
 *
 * @schema io.k8s.api.authentication.v1.TokenReview
 */
export declare class KubeTokenReview extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.authentication.v1.TokenReview"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.authentication.v1.TokenReview".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeTokenReviewProps): any;
  /**
   * Defines a "io.k8s.api.authentication.v1.TokenReview" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeTokenReviewProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * LocalSubjectAccessReview checks whether or not a user or group can perform an action in a given namespace. Having a namespace scoped resource makes it much easier to grant namespace scoped policy that includes permissions checking.
 *
 * @schema io.k8s.api.authorization.v1.LocalSubjectAccessReview
 */
export declare class KubeLocalSubjectAccessReview extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.authorization.v1.LocalSubjectAccessReview"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.authorization.v1.LocalSubjectAccessReview".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeLocalSubjectAccessReviewProps): any;
  /**
   * Defines a "io.k8s.api.authorization.v1.LocalSubjectAccessReview" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeLocalSubjectAccessReviewProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * SelfSubjectAccessReview checks whether or the current user can perform an action.  Not filling in a spec.namespace means "in all namespaces".  Self is a special case, because users should always be able to check whether they can perform an action
 *
 * @schema io.k8s.api.authorization.v1.SelfSubjectAccessReview
 */
export declare class KubeSelfSubjectAccessReview extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.authorization.v1.SelfSubjectAccessReview"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.authorization.v1.SelfSubjectAccessReview".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeSelfSubjectAccessReviewProps): any;
  /**
   * Defines a "io.k8s.api.authorization.v1.SelfSubjectAccessReview" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeSelfSubjectAccessReviewProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * SelfSubjectRulesReview enumerates the set of actions the current user can perform within a namespace. The returned list of actions may be incomplete depending on the server's authorization mode, and any errors experienced during the evaluation. SelfSubjectRulesReview should be used by UIs to show/hide actions, or to quickly let an end user reason about their permissions. It should NOT Be used by external systems to drive authorization decisions as this raises confused deputy, cache lifetime/revocation, and correctness concerns. SubjectAccessReview, and LocalAccessReview are the correct way to defer authorization decisions to the API server.
 *
 * @schema io.k8s.api.authorization.v1.SelfSubjectRulesReview
 */
export declare class KubeSelfSubjectRulesReview extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.authorization.v1.SelfSubjectRulesReview"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.authorization.v1.SelfSubjectRulesReview".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeSelfSubjectRulesReviewProps): any;
  /**
   * Defines a "io.k8s.api.authorization.v1.SelfSubjectRulesReview" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeSelfSubjectRulesReviewProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * SubjectAccessReview checks whether or not a user or group can perform an action.
 *
 * @schema io.k8s.api.authorization.v1.SubjectAccessReview
 */
export declare class KubeSubjectAccessReview extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.authorization.v1.SubjectAccessReview"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.authorization.v1.SubjectAccessReview".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeSubjectAccessReviewProps): any;
  /**
   * Defines a "io.k8s.api.authorization.v1.SubjectAccessReview" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeSubjectAccessReviewProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * configuration of a horizontal pod autoscaler.
 *
 * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscaler
 */
export declare class KubeHorizontalPodAutoscaler extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.autoscaling.v1.HorizontalPodAutoscaler"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.autoscaling.v1.HorizontalPodAutoscaler".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeHorizontalPodAutoscalerProps): any;
  /**
   * Defines a "io.k8s.api.autoscaling.v1.HorizontalPodAutoscaler" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubeHorizontalPodAutoscalerProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * list of horizontal pod autoscaler objects.
 *
 * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerList
 */
export declare class KubeHorizontalPodAutoscalerList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeHorizontalPodAutoscalerListProps): any;
  /**
   * Defines a "io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeHorizontalPodAutoscalerListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Scale represents a scaling request for a resource.
 *
 * @schema io.k8s.api.autoscaling.v1.Scale
 */
export declare class KubeScale extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.autoscaling.v1.Scale"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.autoscaling.v1.Scale".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeScaleProps): any;
  /**
   * Defines a "io.k8s.api.autoscaling.v1.Scale" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeScaleProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * HorizontalPodAutoscaler is the configuration for a horizontal pod autoscaler, which automatically manages the replica count of any resource implementing the scale subresource based on the metrics specified.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscaler
 */
export declare class KubeHorizontalPodAutoscalerV2Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscaler"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscaler".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeHorizontalPodAutoscalerV2Beta1Props): any;
  /**
   * Defines a "io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscaler" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubeHorizontalPodAutoscalerV2Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * HorizontalPodAutoscaler is a list of horizontal pod autoscaler objects.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerList
 */
export declare class KubeHorizontalPodAutoscalerListV2Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeHorizontalPodAutoscalerListV2Beta1Props): any;
  /**
   * Defines a "io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeHorizontalPodAutoscalerListV2Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * HorizontalPodAutoscaler is the configuration for a horizontal pod autoscaler, which automatically manages the replica count of any resource implementing the scale subresource based on the metrics specified.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscaler
 */
export declare class KubeHorizontalPodAutoscalerV2Beta2 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscaler"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscaler".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeHorizontalPodAutoscalerV2Beta2Props): any;
  /**
   * Defines a "io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscaler" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubeHorizontalPodAutoscalerV2Beta2Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * HorizontalPodAutoscalerList is a list of horizontal pod autoscaler objects.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerList
 */
export declare class KubeHorizontalPodAutoscalerListV2Beta2 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeHorizontalPodAutoscalerListV2Beta2Props): any;
  /**
   * Defines a "io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeHorizontalPodAutoscalerListV2Beta2Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CronJob represents the configuration of a single cron job.
 *
 * @schema io.k8s.api.batch.v1.CronJob
 */
export declare class KubeCronJob extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.batch.v1.CronJob"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.batch.v1.CronJob".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeCronJobProps): any;
  /**
   * Defines a "io.k8s.api.batch.v1.CronJob" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeCronJobProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CronJobList is a collection of cron jobs.
 *
 * @schema io.k8s.api.batch.v1.CronJobList
 */
export declare class KubeCronJobList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.batch.v1.CronJobList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.batch.v1.CronJobList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCronJobListProps): any;
  /**
   * Defines a "io.k8s.api.batch.v1.CronJobList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeCronJobListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Job represents the configuration of a single job.
 *
 * @schema io.k8s.api.batch.v1.Job
 */
export declare class KubeJob extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.batch.v1.Job"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.batch.v1.Job".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeJobProps): any;
  /**
   * Defines a "io.k8s.api.batch.v1.Job" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeJobProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * JobList is a collection of jobs.
 *
 * @schema io.k8s.api.batch.v1.JobList
 */
export declare class KubeJobList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.batch.v1.JobList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.batch.v1.JobList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeJobListProps): any;
  /**
   * Defines a "io.k8s.api.batch.v1.JobList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeJobListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CronJob represents the configuration of a single cron job.
 *
 * @schema io.k8s.api.batch.v1beta1.CronJob
 */
export declare class KubeCronJobV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.batch.v1beta1.CronJob"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.batch.v1beta1.CronJob".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeCronJobV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.batch.v1beta1.CronJob" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeCronJobV1Beta1Props);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CronJobList is a collection of cron jobs.
 *
 * @schema io.k8s.api.batch.v1beta1.CronJobList
 */
export declare class KubeCronJobListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.batch.v1beta1.CronJobList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.batch.v1beta1.CronJobList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCronJobListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.batch.v1beta1.CronJobList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeCronJobListV1Beta1Props);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CertificateSigningRequest objects provide a mechanism to obtain x509 certificates by submitting a certificate signing request, and having it asynchronously approved and issued.

Kubelets use this API to obtain:
 1. client certificates to authenticate to kube-apiserver (with the "kubernetes.io/kube-apiserver-client-kubelet" signerName).
 2. serving certificates for TLS endpoints kube-apiserver can connect to securely (with the "kubernetes.io/kubelet-serving" signerName).

This API can be used to request client certificates to authenticate to kube-apiserver (with the "kubernetes.io/kube-apiserver-client" signerName), or to obtain certificates from custom non-Kubernetes signers.
 *
 * @schema io.k8s.api.certificates.v1.CertificateSigningRequest
 */
export declare class KubeCertificateSigningRequest extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.certificates.v1.CertificateSigningRequest"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.certificates.v1.CertificateSigningRequest".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCertificateSigningRequestProps): any;
  /**
   * Defines a "io.k8s.api.certificates.v1.CertificateSigningRequest" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCertificateSigningRequestProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CertificateSigningRequestList is a collection of CertificateSigningRequest objects
 *
 * @schema io.k8s.api.certificates.v1.CertificateSigningRequestList
 */
export declare class KubeCertificateSigningRequestList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.certificates.v1.CertificateSigningRequestList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.certificates.v1.CertificateSigningRequestList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCertificateSigningRequestListProps): any;
  /**
   * Defines a "io.k8s.api.certificates.v1.CertificateSigningRequestList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCertificateSigningRequestListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Lease defines a lease concept.
 *
 * @schema io.k8s.api.coordination.v1.Lease
 */
export declare class KubeLease extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.coordination.v1.Lease"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.coordination.v1.Lease".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeLeaseProps): any;
  /**
   * Defines a "io.k8s.api.coordination.v1.Lease" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeLeaseProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * LeaseList is a list of Lease objects.
 *
 * @schema io.k8s.api.coordination.v1.LeaseList
 */
export declare class KubeLeaseList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.coordination.v1.LeaseList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.coordination.v1.LeaseList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeLeaseListProps): any;
  /**
   * Defines a "io.k8s.api.coordination.v1.LeaseList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeLeaseListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Binding ties one object to another; for example, a pod is bound to a node by a scheduler. Deprecated in 1.7, please use the bindings subresource of pods instead.
 *
 * @schema io.k8s.api.core.v1.Binding
 */
export declare class KubeBinding extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.Binding"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.Binding".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeBindingProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.Binding" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeBindingProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ComponentStatus (and ComponentStatusList) holds the cluster validation info. Deprecated: This API is deprecated in v1.19+
 *
 * @schema io.k8s.api.core.v1.ComponentStatus
 */
export declare class KubeComponentStatus extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ComponentStatus"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ComponentStatus".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeComponentStatusProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ComponentStatus" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeComponentStatusProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Status of all the conditions for the component as a list of ComponentStatus objects. Deprecated: This API is deprecated in v1.19+
 *
 * @schema io.k8s.api.core.v1.ComponentStatusList
 */
export declare class KubeComponentStatusList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ComponentStatusList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ComponentStatusList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeComponentStatusListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ComponentStatusList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeComponentStatusListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ConfigMap holds configuration data for pods to consume.
 *
 * @schema io.k8s.api.core.v1.ConfigMap
 */
export declare class KubeConfigMap extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ConfigMap"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ConfigMap".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeConfigMapProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ConfigMap" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeConfigMapProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ConfigMapList is a resource containing a list of ConfigMap objects.
 *
 * @schema io.k8s.api.core.v1.ConfigMapList
 */
export declare class KubeConfigMapList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ConfigMapList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ConfigMapList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeConfigMapListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ConfigMapList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeConfigMapListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Endpoints is a collection of endpoints that implement the actual service. Example:
  Name: "mysvc",
  Subsets: [
    {
      Addresses: [{"ip": "10.10.1.1"}, {"ip": "10.10.2.2"}],
      Ports: [{"name": "a", "port": 8675}, {"name": "b", "port": 309}]
    },
    {
      Addresses: [{"ip": "10.10.3.3"}],
      Ports: [{"name": "a", "port": 93}, {"name": "b", "port": 76}]
    },
 ]
 *
 * @schema io.k8s.api.core.v1.Endpoints
 */
export declare class KubeEndpoints extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.Endpoints"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.Endpoints".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeEndpointsProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.Endpoints" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeEndpointsProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * EndpointsList is a list of endpoints.
 *
 * @schema io.k8s.api.core.v1.EndpointsList
 */
export declare class KubeEndpointsList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.EndpointsList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.EndpointsList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEndpointsListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.EndpointsList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeEndpointsListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Event is a report of an event somewhere in the cluster. It generally denotes some state change in the system. Events have a limited retention time and triggers and messages may evolve with time.  Event consumers should not rely on the timing of an event with a given Reason reflecting a consistent underlying trigger, or the continued existence of events with that Reason.  Events should be treated as informative, best-effort, supplemental data.
 *
 * @schema io.k8s.api.events.v1.Event
 */
export declare class KubeEvent extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.events.v1.Event"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.events.v1.Event".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEventProps): any;
  /**
   * Defines a "io.k8s.api.events.v1.Event" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeEventProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * EventList is a list of Event objects.
 *
 * @schema io.k8s.api.events.v1.EventList
 */
export declare class KubeEventList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.events.v1.EventList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.events.v1.EventList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEventListProps): any;
  /**
   * Defines a "io.k8s.api.events.v1.EventList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeEventListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * LimitRange sets resource usage limits for each kind of resource in a Namespace.
 *
 * @schema io.k8s.api.core.v1.LimitRange
 */
export declare class KubeLimitRange extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.LimitRange"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.LimitRange".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeLimitRangeProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.LimitRange" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeLimitRangeProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * LimitRangeList is a list of LimitRange items.
 *
 * @schema io.k8s.api.core.v1.LimitRangeList
 */
export declare class KubeLimitRangeList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.LimitRangeList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.LimitRangeList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeLimitRangeListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.LimitRangeList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeLimitRangeListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Namespace provides a scope for Names. Use of multiple namespaces is optional.
 *
 * @schema io.k8s.api.core.v1.Namespace
 */
export declare class KubeNamespace extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.Namespace"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.Namespace".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeNamespaceProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.Namespace" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeNamespaceProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * NamespaceList is a list of Namespaces.
 *
 * @schema io.k8s.api.core.v1.NamespaceList
 */
export declare class KubeNamespaceList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.NamespaceList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.NamespaceList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeNamespaceListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.NamespaceList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeNamespaceListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Node is a worker node in Kubernetes. Each node will have a unique identifier in the cache (i.e. in etcd).
 *
 * @schema io.k8s.api.core.v1.Node
 */
export declare class KubeNode extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.Node"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.Node".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeNodeProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.Node" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeNodeProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * NodeList is the whole list of all Nodes which have been registered with master.
 *
 * @schema io.k8s.api.core.v1.NodeList
 */
export declare class KubeNodeList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.NodeList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.NodeList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeNodeListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.NodeList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeNodeListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PersistentVolume (PV) is a storage resource provisioned by an administrator. It is analogous to a node. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes
 *
 * @schema io.k8s.api.core.v1.PersistentVolume
 */
export declare class KubePersistentVolume extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.PersistentVolume"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.PersistentVolume".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePersistentVolumeProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.PersistentVolume" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubePersistentVolumeProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PersistentVolumeClaim is a user's request for and claim to a persistent volume
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeClaim
 */
export declare class KubePersistentVolumeClaim extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.PersistentVolumeClaim"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.PersistentVolumeClaim".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePersistentVolumeClaimProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.PersistentVolumeClaim" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubePersistentVolumeClaimProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PersistentVolumeClaimList is a list of PersistentVolumeClaim items.
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeClaimList
 */
export declare class KubePersistentVolumeClaimList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.PersistentVolumeClaimList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.PersistentVolumeClaimList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePersistentVolumeClaimListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.PersistentVolumeClaimList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePersistentVolumeClaimListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PersistentVolumeList is a list of PersistentVolume items.
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeList
 */
export declare class KubePersistentVolumeList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.PersistentVolumeList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.PersistentVolumeList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePersistentVolumeListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.PersistentVolumeList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePersistentVolumeListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Pod is a collection of containers that can run on a host. This resource is created by clients and scheduled onto hosts.
 *
 * @schema io.k8s.api.core.v1.Pod
 */
export declare class KubePod extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.Pod"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.Pod".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePodProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.Pod" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubePodProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodList is a list of Pods.
 *
 * @schema io.k8s.api.core.v1.PodList
 */
export declare class KubePodList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.PodList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.PodList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePodListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.PodList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubePodListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodTemplate describes a template for creating copies of a predefined pod.
 *
 * @schema io.k8s.api.core.v1.PodTemplate
 */
export declare class KubePodTemplate extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.PodTemplate"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.PodTemplate".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePodTemplateProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.PodTemplate" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubePodTemplateProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodTemplateList is a list of PodTemplates.
 *
 * @schema io.k8s.api.core.v1.PodTemplateList
 */
export declare class KubePodTemplateList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.PodTemplateList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.PodTemplateList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePodTemplateListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.PodTemplateList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubePodTemplateListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ReplicationController represents the configuration of a replication controller.
 *
 * @schema io.k8s.api.core.v1.ReplicationController
 */
export declare class KubeReplicationController extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ReplicationController"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ReplicationController".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeReplicationControllerProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ReplicationController" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubeReplicationControllerProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ReplicationControllerList is a collection of replication controllers.
 *
 * @schema io.k8s.api.core.v1.ReplicationControllerList
 */
export declare class KubeReplicationControllerList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ReplicationControllerList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ReplicationControllerList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeReplicationControllerListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ReplicationControllerList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeReplicationControllerListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ResourceQuota sets aggregate quota restrictions enforced per namespace
 *
 * @schema io.k8s.api.core.v1.ResourceQuota
 */
export declare class KubeResourceQuota extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ResourceQuota"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ResourceQuota".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeResourceQuotaProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ResourceQuota" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeResourceQuotaProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ResourceQuotaList is a list of ResourceQuota items.
 *
 * @schema io.k8s.api.core.v1.ResourceQuotaList
 */
export declare class KubeResourceQuotaList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ResourceQuotaList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ResourceQuotaList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeResourceQuotaListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ResourceQuotaList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeResourceQuotaListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Secret holds secret data of a certain type. The total bytes of the values in the Data field must be less than MaxSecretSize bytes.
 *
 * @schema io.k8s.api.core.v1.Secret
 */
export declare class KubeSecret extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.Secret"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.Secret".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeSecretProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.Secret" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeSecretProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * SecretList is a list of Secret.
 *
 * @schema io.k8s.api.core.v1.SecretList
 */
export declare class KubeSecretList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.SecretList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.SecretList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeSecretListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.SecretList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeSecretListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Service is a named abstraction of software service (for example, mysql) consisting of local port (for example 3306) that the proxy listens on, and the selector that determines which pods will answer requests sent through the proxy.
 *
 * @schema io.k8s.api.core.v1.Service
 */
export declare class KubeService extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.Service"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.Service".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeServiceProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.Service" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeServiceProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ServiceAccount binds together: * a name, understood by users, and perhaps by peripheral systems, for an identity * a principal that can be authenticated and authorized * a set of secrets
 *
 * @schema io.k8s.api.core.v1.ServiceAccount
 */
export declare class KubeServiceAccount extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ServiceAccount"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ServiceAccount".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeServiceAccountProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ServiceAccount" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeServiceAccountProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ServiceAccountList is a list of ServiceAccount objects
 *
 * @schema io.k8s.api.core.v1.ServiceAccountList
 */
export declare class KubeServiceAccountList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ServiceAccountList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ServiceAccountList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeServiceAccountListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ServiceAccountList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeServiceAccountListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ServiceList holds a list of services.
 *
 * @schema io.k8s.api.core.v1.ServiceList
 */
export declare class KubeServiceList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.core.v1.ServiceList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.core.v1.ServiceList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeServiceListProps): any;
  /**
   * Defines a "io.k8s.api.core.v1.ServiceList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeServiceListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * EndpointSlice represents a subset of the endpoints that implement a service. For a given service there may be multiple EndpointSlice objects, selected by labels, which must be joined to produce the full set of endpoints.
 *
 * @schema io.k8s.api.discovery.v1.EndpointSlice
 */
export declare class KubeEndpointSlice extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.discovery.v1.EndpointSlice"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.discovery.v1.EndpointSlice".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEndpointSliceProps): any;
  /**
   * Defines a "io.k8s.api.discovery.v1.EndpointSlice" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeEndpointSliceProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * EndpointSliceList represents a list of endpoint slices
 *
 * @schema io.k8s.api.discovery.v1.EndpointSliceList
 */
export declare class KubeEndpointSliceList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.discovery.v1.EndpointSliceList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.discovery.v1.EndpointSliceList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEndpointSliceListProps): any;
  /**
   * Defines a "io.k8s.api.discovery.v1.EndpointSliceList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeEndpointSliceListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * EndpointSlice represents a subset of the endpoints that implement a service. For a given service there may be multiple EndpointSlice objects, selected by labels, which must be joined to produce the full set of endpoints.
 *
 * @schema io.k8s.api.discovery.v1beta1.EndpointSlice
 */
export declare class KubeEndpointSliceV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.discovery.v1beta1.EndpointSlice"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.discovery.v1beta1.EndpointSlice".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEndpointSliceV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.discovery.v1beta1.EndpointSlice" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeEndpointSliceV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * EndpointSliceList represents a list of endpoint slices
 *
 * @schema io.k8s.api.discovery.v1beta1.EndpointSliceList
 */
export declare class KubeEndpointSliceListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.discovery.v1beta1.EndpointSliceList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.discovery.v1beta1.EndpointSliceList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEndpointSliceListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.discovery.v1beta1.EndpointSliceList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeEndpointSliceListV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Event is a report of an event somewhere in the cluster. It generally denotes some state change in the system. Events have a limited retention time and triggers and messages may evolve with time.  Event consumers should not rely on the timing of an event with a given Reason reflecting a consistent underlying trigger, or the continued existence of events with that Reason.  Events should be treated as informative, best-effort, supplemental data.
 *
 * @schema io.k8s.api.events.v1beta1.Event
 */
export declare class KubeEventV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.events.v1beta1.Event"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.events.v1beta1.Event".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEventV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.events.v1beta1.Event" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeEventV1Beta1Props);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * EventList is a list of Event objects.
 *
 * @schema io.k8s.api.events.v1beta1.EventList
 */
export declare class KubeEventListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.events.v1beta1.EventList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.events.v1beta1.EventList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeEventListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.events.v1beta1.EventList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeEventListV1Beta1Props);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * FlowSchema defines the schema of a group of flows. Note that a flow is made up of a set of inbound API requests with similar attributes and is identified by a pair of strings: the name of the FlowSchema and a "flow distinguisher".
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchema
 */
export declare class KubeFlowSchemaV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.flowcontrol.v1beta1.FlowSchema"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.flowcontrol.v1beta1.FlowSchema".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeFlowSchemaV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.flowcontrol.v1beta1.FlowSchema" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeFlowSchemaV1Beta1Props);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * FlowSchemaList is a list of FlowSchema objects.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaList
 */
export declare class KubeFlowSchemaListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.flowcontrol.v1beta1.FlowSchemaList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.flowcontrol.v1beta1.FlowSchemaList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeFlowSchemaListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.flowcontrol.v1beta1.FlowSchemaList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeFlowSchemaListV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PriorityLevelConfiguration represents the configuration of a priority level.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfiguration
 */
export declare class KubePriorityLevelConfigurationV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfiguration"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfiguration".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePriorityLevelConfigurationV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfiguration" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubePriorityLevelConfigurationV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PriorityLevelConfigurationList is a list of PriorityLevelConfiguration objects.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationList
 */
export declare class KubePriorityLevelConfigurationListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePriorityLevelConfigurationListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePriorityLevelConfigurationListV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Ingress is a collection of rules that allow inbound connections to reach the endpoints defined by a backend. An Ingress can be configured to give services externally-reachable urls, load balance traffic, terminate SSL, offer name based virtual hosting etc.
 *
 * @schema io.k8s.api.networking.v1.Ingress
 */
export declare class KubeIngress extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.networking.v1.Ingress"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.networking.v1.Ingress".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeIngressProps): any;
  /**
   * Defines a "io.k8s.api.networking.v1.Ingress" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeIngressProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * IngressClass represents the class of the Ingress, referenced by the Ingress Spec. The `ingressclass.kubernetes.io/is-default-class` annotation can be used to indicate that an IngressClass should be considered default. When a single IngressClass resource has this annotation set to true, new Ingress resources without a class specified will be assigned this default class.
 *
 * @schema io.k8s.api.networking.v1.IngressClass
 */
export declare class KubeIngressClass extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.networking.v1.IngressClass"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.networking.v1.IngressClass".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeIngressClassProps): any;
  /**
   * Defines a "io.k8s.api.networking.v1.IngressClass" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeIngressClassProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * IngressClassList is a collection of IngressClasses.
 *
 * @schema io.k8s.api.networking.v1.IngressClassList
 */
export declare class KubeIngressClassList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.networking.v1.IngressClassList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.networking.v1.IngressClassList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeIngressClassListProps): any;
  /**
   * Defines a "io.k8s.api.networking.v1.IngressClassList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeIngressClassListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * IngressList is a collection of Ingress.
 *
 * @schema io.k8s.api.networking.v1.IngressList
 */
export declare class KubeIngressList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.networking.v1.IngressList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.networking.v1.IngressList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeIngressListProps): any;
  /**
   * Defines a "io.k8s.api.networking.v1.IngressList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeIngressListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * NetworkPolicy describes what network traffic is allowed for a set of Pods
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicy
 */
export declare class KubeNetworkPolicy extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.networking.v1.NetworkPolicy"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.networking.v1.NetworkPolicy".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeNetworkPolicyProps): any;
  /**
   * Defines a "io.k8s.api.networking.v1.NetworkPolicy" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeNetworkPolicyProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * NetworkPolicyList is a list of NetworkPolicy objects.
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicyList
 */
export declare class KubeNetworkPolicyList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.networking.v1.NetworkPolicyList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.networking.v1.NetworkPolicyList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeNetworkPolicyListProps): any;
  /**
   * Defines a "io.k8s.api.networking.v1.NetworkPolicyList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeNetworkPolicyListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RuntimeClass defines a class of container runtime supported in the cluster. The RuntimeClass is used to determine which container runtime is used to run all containers in a pod. RuntimeClasses are manually defined by a user or cluster provisioner, and referenced in the PodSpec. The Kubelet is responsible for resolving the RuntimeClassName reference before running the pod.  For more details, see https://kubernetes.io/docs/concepts/containers/runtime-class/
 *
 * @schema io.k8s.api.node.v1.RuntimeClass
 */
export declare class KubeRuntimeClass extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.node.v1.RuntimeClass"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.node.v1.RuntimeClass".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRuntimeClassProps): any;
  /**
   * Defines a "io.k8s.api.node.v1.RuntimeClass" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeRuntimeClassProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RuntimeClassList is a list of RuntimeClass objects.
 *
 * @schema io.k8s.api.node.v1.RuntimeClassList
 */
export declare class KubeRuntimeClassList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.node.v1.RuntimeClassList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.node.v1.RuntimeClassList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRuntimeClassListProps): any;
  /**
   * Defines a "io.k8s.api.node.v1.RuntimeClassList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeRuntimeClassListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RuntimeClass defines a class of container runtime supported in the cluster. The RuntimeClass is used to determine which container runtime is used to run all containers in a pod. RuntimeClasses are (currently) manually defined by a user or cluster provisioner, and referenced in the PodSpec. The Kubelet is responsible for resolving the RuntimeClassName reference before running the pod.  For more details, see https://git.k8s.io/enhancements/keps/sig-node/585-runtime-class
 *
 * @schema io.k8s.api.node.v1alpha1.RuntimeClass
 */
export declare class KubeRuntimeClassV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.node.v1alpha1.RuntimeClass"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.node.v1alpha1.RuntimeClass".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRuntimeClassV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.node.v1alpha1.RuntimeClass" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeRuntimeClassV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RuntimeClassList is a list of RuntimeClass objects.
 *
 * @schema io.k8s.api.node.v1alpha1.RuntimeClassList
 */
export declare class KubeRuntimeClassListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.node.v1alpha1.RuntimeClassList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.node.v1alpha1.RuntimeClassList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRuntimeClassListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.node.v1alpha1.RuntimeClassList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeRuntimeClassListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RuntimeClass defines a class of container runtime supported in the cluster. The RuntimeClass is used to determine which container runtime is used to run all containers in a pod. RuntimeClasses are (currently) manually defined by a user or cluster provisioner, and referenced in the PodSpec. The Kubelet is responsible for resolving the RuntimeClassName reference before running the pod.  For more details, see https://git.k8s.io/enhancements/keps/sig-node/585-runtime-class
 *
 * @schema io.k8s.api.node.v1beta1.RuntimeClass
 */
export declare class KubeRuntimeClassV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.node.v1beta1.RuntimeClass"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.node.v1beta1.RuntimeClass".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRuntimeClassV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.node.v1beta1.RuntimeClass" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeRuntimeClassV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RuntimeClassList is a list of RuntimeClass objects.
 *
 * @schema io.k8s.api.node.v1beta1.RuntimeClassList
 */
export declare class KubeRuntimeClassListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.node.v1beta1.RuntimeClassList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.node.v1beta1.RuntimeClassList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRuntimeClassListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.node.v1beta1.RuntimeClassList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeRuntimeClassListV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Eviction evicts a pod from its node subject to certain policies and safety constraints. This is a subresource of Pod.  A request to cause such an eviction is created by POSTing to .../pods/<pod name>/evictions.
 *
 * @schema io.k8s.api.policy.v1.Eviction
 */
export declare class KubeEviction extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.policy.v1.Eviction"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.policy.v1.Eviction".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeEvictionProps): any;
  /**
   * Defines a "io.k8s.api.policy.v1.Eviction" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeEvictionProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodDisruptionBudget is an object to define the max disruption that can be caused to a collection of pods
 *
 * @schema io.k8s.api.policy.v1.PodDisruptionBudget
 */
export declare class KubePodDisruptionBudget extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.policy.v1.PodDisruptionBudget"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.policy.v1.PodDisruptionBudget".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePodDisruptionBudgetProps): any;
  /**
   * Defines a "io.k8s.api.policy.v1.PodDisruptionBudget" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubePodDisruptionBudgetProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodDisruptionBudgetList is a collection of PodDisruptionBudgets.
 *
 * @schema io.k8s.api.policy.v1.PodDisruptionBudgetList
 */
export declare class KubePodDisruptionBudgetList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.policy.v1.PodDisruptionBudgetList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.policy.v1.PodDisruptionBudgetList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePodDisruptionBudgetListProps): any;
  /**
   * Defines a "io.k8s.api.policy.v1.PodDisruptionBudgetList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePodDisruptionBudgetListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodDisruptionBudget is an object to define the max disruption that can be caused to a collection of pods
 *
 * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudget
 */
export declare class KubePodDisruptionBudgetV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.policy.v1beta1.PodDisruptionBudget"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.policy.v1beta1.PodDisruptionBudget".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePodDisruptionBudgetV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.policy.v1beta1.PodDisruptionBudget" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubePodDisruptionBudgetV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodDisruptionBudgetList is a collection of PodDisruptionBudgets.
 *
 * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetList
 */
export declare class KubePodDisruptionBudgetListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.policy.v1beta1.PodDisruptionBudgetList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.policy.v1beta1.PodDisruptionBudgetList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePodDisruptionBudgetListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.policy.v1beta1.PodDisruptionBudgetList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePodDisruptionBudgetListV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodSecurityPolicy governs the ability to make requests that affect the Security Context that will be applied to a pod and container. Deprecated in 1.21.
 *
 * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicy
 */
export declare class KubePodSecurityPolicyV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.policy.v1beta1.PodSecurityPolicy"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.policy.v1beta1.PodSecurityPolicy".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubePodSecurityPolicyV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.policy.v1beta1.PodSecurityPolicy" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubePodSecurityPolicyV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PodSecurityPolicyList is a list of PodSecurityPolicy objects.
 *
 * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicyList
 */
export declare class KubePodSecurityPolicyListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.policy.v1beta1.PodSecurityPolicyList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.policy.v1beta1.PodSecurityPolicyList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePodSecurityPolicyListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.policy.v1beta1.PodSecurityPolicyList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePodSecurityPolicyListV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRole is a cluster level, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding or ClusterRoleBinding.
 *
 * @schema io.k8s.api.rbac.v1.ClusterRole
 */
export declare class KubeClusterRole extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.ClusterRole"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.ClusterRole".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeClusterRoleProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.ClusterRole" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeClusterRoleProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRoleBinding references a ClusterRole, but not contain it.  It can reference a ClusterRole in the global namespace, and adds who information via Subject.
 *
 * @schema io.k8s.api.rbac.v1.ClusterRoleBinding
 */
export declare class KubeClusterRoleBinding extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.ClusterRoleBinding"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.ClusterRoleBinding".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeClusterRoleBindingProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.ClusterRoleBinding" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeClusterRoleBindingProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRoleBindingList is a collection of ClusterRoleBindings
 *
 * @schema io.k8s.api.rbac.v1.ClusterRoleBindingList
 */
export declare class KubeClusterRoleBindingList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.ClusterRoleBindingList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.ClusterRoleBindingList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeClusterRoleBindingListProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.ClusterRoleBindingList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeClusterRoleBindingListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRoleList is a collection of ClusterRoles
 *
 * @schema io.k8s.api.rbac.v1.ClusterRoleList
 */
export declare class KubeClusterRoleList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.ClusterRoleList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.ClusterRoleList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeClusterRoleListProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.ClusterRoleList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeClusterRoleListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Role is a namespaced, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding.
 *
 * @schema io.k8s.api.rbac.v1.Role
 */
export declare class KubeRole extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.Role"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.Role".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeRoleProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.Role" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeRoleProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RoleBinding references a role, but does not contain it.  It can reference a Role in the same namespace or a ClusterRole in the global namespace. It adds who information via Subjects and namespace information by which namespace it exists in.  RoleBindings in a given namespace only have effect in that namespace.
 *
 * @schema io.k8s.api.rbac.v1.RoleBinding
 */
export declare class KubeRoleBinding extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.RoleBinding"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.RoleBinding".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRoleBindingProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.RoleBinding" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeRoleBindingProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RoleBindingList is a collection of RoleBindings
 *
 * @schema io.k8s.api.rbac.v1.RoleBindingList
 */
export declare class KubeRoleBindingList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.RoleBindingList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.RoleBindingList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRoleBindingListProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.RoleBindingList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeRoleBindingListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RoleList is a collection of Roles
 *
 * @schema io.k8s.api.rbac.v1.RoleList
 */
export declare class KubeRoleList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1.RoleList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1.RoleList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRoleListProps): any;
  /**
   * Defines a "io.k8s.api.rbac.v1.RoleList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeRoleListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRole is a cluster level, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding or ClusterRoleBinding. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRole, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRole
 */
export declare class KubeClusterRoleV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.ClusterRole"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.ClusterRole".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeClusterRoleV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.ClusterRole" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props?: KubeClusterRoleV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRoleBinding references a ClusterRole, but not contain it.  It can reference a ClusterRole in the global namespace, and adds who information via Subject. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRoleBinding, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBinding
 */
export declare class KubeClusterRoleBindingV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.ClusterRoleBinding"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.ClusterRoleBinding".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeClusterRoleBindingV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.ClusterRoleBinding" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeClusterRoleBindingV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRoleBindingList is a collection of ClusterRoleBindings. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRoleBindings, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBindingList
 */
export declare class KubeClusterRoleBindingListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.ClusterRoleBindingList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.ClusterRoleBindingList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeClusterRoleBindingListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.ClusterRoleBindingList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeClusterRoleBindingListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * ClusterRoleList is a collection of ClusterRoles. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRoles, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleList
 */
export declare class KubeClusterRoleListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.ClusterRoleList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.ClusterRoleList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeClusterRoleListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.ClusterRoleList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeClusterRoleListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Role is a namespaced, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 Role, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.Role
 */
export declare class KubeRoleV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.Role"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.Role".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeRoleV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.Role" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeRoleV1Alpha1Props);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RoleBinding references a role, but does not contain it.  It can reference a Role in the same namespace or a ClusterRole in the global namespace. It adds who information via Subjects and namespace information by which namespace it exists in.  RoleBindings in a given namespace only have effect in that namespace. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 RoleBinding, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.RoleBinding
 */
export declare class KubeRoleBindingV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.RoleBinding"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.RoleBinding".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRoleBindingV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.RoleBinding" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeRoleBindingV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RoleBindingList is a collection of RoleBindings Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 RoleBindingList, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.RoleBindingList
 */
export declare class KubeRoleBindingListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.RoleBindingList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.RoleBindingList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRoleBindingListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.RoleBindingList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeRoleBindingListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * RoleList is a collection of Roles. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 RoleList, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.RoleList
 */
export declare class KubeRoleListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.rbac.v1alpha1.RoleList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.rbac.v1alpha1.RoleList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeRoleListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.rbac.v1alpha1.RoleList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeRoleListV1Alpha1Props);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PriorityClass defines mapping from a priority class name to the priority integer value. The value can be any valid integer.
 *
 * @schema io.k8s.api.scheduling.v1.PriorityClass
 */
export declare class KubePriorityClass extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.scheduling.v1.PriorityClass"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.scheduling.v1.PriorityClass".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePriorityClassProps): any;
  /**
   * Defines a "io.k8s.api.scheduling.v1.PriorityClass" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubePriorityClassProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PriorityClassList is a collection of priority classes.
 *
 * @schema io.k8s.api.scheduling.v1.PriorityClassList
 */
export declare class KubePriorityClassList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.scheduling.v1.PriorityClassList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.scheduling.v1.PriorityClassList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePriorityClassListProps): any;
  /**
   * Defines a "io.k8s.api.scheduling.v1.PriorityClassList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubePriorityClassListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * DEPRECATED - This group version of PriorityClass is deprecated by scheduling.k8s.io/v1/PriorityClass. PriorityClass defines mapping from a priority class name to the priority integer value. The value can be any valid integer.
 *
 * @schema io.k8s.api.scheduling.v1alpha1.PriorityClass
 */
export declare class KubePriorityClassV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.scheduling.v1alpha1.PriorityClass"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.scheduling.v1alpha1.PriorityClass".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePriorityClassV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.scheduling.v1alpha1.PriorityClass" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePriorityClassV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * PriorityClassList is a collection of priority classes.
 *
 * @schema io.k8s.api.scheduling.v1alpha1.PriorityClassList
 */
export declare class KubePriorityClassListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.scheduling.v1alpha1.PriorityClassList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.scheduling.v1alpha1.PriorityClassList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubePriorityClassListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.scheduling.v1alpha1.PriorityClassList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubePriorityClassListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSIDriver captures information about a Container Storage Interface (CSI) volume driver deployed on the cluster. Kubernetes attach detach controller uses this object to determine whether attach is required. Kubelet uses this object to determine whether pod information needs to be passed on mount. CSIDriver objects are non-namespaced.
 *
 * @schema io.k8s.api.storage.v1.CSIDriver
 */
export declare class KubeCsiDriver extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.CSIDriver"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.CSIDriver".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiDriverProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.CSIDriver" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeCsiDriverProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSIDriverList is a collection of CSIDriver objects.
 *
 * @schema io.k8s.api.storage.v1.CSIDriverList
 */
export declare class KubeCsiDriverList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.CSIDriverList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.CSIDriverList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiDriverListProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.CSIDriverList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeCsiDriverListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSINode holds information about all CSI drivers installed on a node. CSI drivers do not need to create the CSINode object directly. As long as they use the node-driver-registrar sidecar container, the kubelet will automatically populate the CSINode object for the CSI driver as part of kubelet plugin registration. CSINode has the same name as a node. If the object is missing, it means either there are no CSI Drivers available on the node, or the Kubelet version is low enough that it doesn't create this object. CSINode has an OwnerReference that points to the corresponding node object.
 *
 * @schema io.k8s.api.storage.v1.CSINode
 */
export declare class KubeCsiNode extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.CSINode"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.CSINode".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiNodeProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.CSINode" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeCsiNodeProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSINodeList is a collection of CSINode objects.
 *
 * @schema io.k8s.api.storage.v1.CSINodeList
 */
export declare class KubeCsiNodeList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.CSINodeList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.CSINodeList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiNodeListProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.CSINodeList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeCsiNodeListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * StorageClass describes the parameters for a class of storage for which PersistentVolumes can be dynamically provisioned.

StorageClasses are non-namespaced; the name of the storage class according to etcd is in ObjectMeta.Name.
 *
 * @schema io.k8s.api.storage.v1.StorageClass
 */
export declare class KubeStorageClass extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.StorageClass"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.StorageClass".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeStorageClassProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.StorageClass" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeStorageClassProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * StorageClassList is a collection of storage classes.
 *
 * @schema io.k8s.api.storage.v1.StorageClassList
 */
export declare class KubeStorageClassList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.StorageClassList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.StorageClassList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeStorageClassListProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.StorageClassList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeStorageClassListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * VolumeAttachment captures the intent to attach or detach the specified volume to/from the specified node.

VolumeAttachment objects are non-namespaced.
 *
 * @schema io.k8s.api.storage.v1.VolumeAttachment
 */
export declare class KubeVolumeAttachment extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.VolumeAttachment"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.VolumeAttachment".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeVolumeAttachmentProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.VolumeAttachment" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeVolumeAttachmentProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * VolumeAttachmentList is a collection of VolumeAttachment objects.
 *
 * @schema io.k8s.api.storage.v1.VolumeAttachmentList
 */
export declare class KubeVolumeAttachmentList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1.VolumeAttachmentList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1.VolumeAttachmentList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeVolumeAttachmentListProps): any;
  /**
   * Defines a "io.k8s.api.storage.v1.VolumeAttachmentList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeVolumeAttachmentListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSIStorageCapacity stores the result of one CSI GetCapacity call. For a given StorageClass, this describes the available capacity in a particular topology segment.  This can be used when considering where to instantiate new PersistentVolumes.

For example this can express things like: - StorageClass "standard" has "1234 GiB" available in "topology.kubernetes.io/zone=us-east1" - StorageClass "localssd" has "10 GiB" available in "kubernetes.io/hostname=knode-abc123"

The following three cases all imply that no capacity is available for a certain combination: - no object exists with suitable topology and storage class name - such an object exists, but the capacity is unset - such an object exists, but the capacity is zero

The producer of these objects can decide which approach is more suitable.

They are consumed by the kube-scheduler if the CSIStorageCapacity beta feature gate is enabled there and a CSI driver opts into capacity-aware scheduling with CSIDriver.StorageCapacity.
 *
 * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacity
 */
export declare class KubeCsiStorageCapacityV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1alpha1.CSIStorageCapacity"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1alpha1.CSIStorageCapacity".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiStorageCapacityV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.storage.v1alpha1.CSIStorageCapacity" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCsiStorageCapacityV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSIStorageCapacityList is a collection of CSIStorageCapacity objects.
 *
 * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacityList
 */
export declare class KubeCsiStorageCapacityListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1alpha1.CSIStorageCapacityList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1alpha1.CSIStorageCapacityList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiStorageCapacityListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.storage.v1alpha1.CSIStorageCapacityList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCsiStorageCapacityListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * VolumeAttachment captures the intent to attach or detach the specified volume to/from the specified node.

VolumeAttachment objects are non-namespaced.
 *
 * @schema io.k8s.api.storage.v1alpha1.VolumeAttachment
 */
export declare class KubeVolumeAttachmentV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1alpha1.VolumeAttachment"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1alpha1.VolumeAttachment".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeVolumeAttachmentV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.storage.v1alpha1.VolumeAttachment" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeVolumeAttachmentV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * VolumeAttachmentList is a collection of VolumeAttachment objects.
 *
 * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentList
 */
export declare class KubeVolumeAttachmentListV1Alpha1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1alpha1.VolumeAttachmentList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1alpha1.VolumeAttachmentList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeVolumeAttachmentListV1Alpha1Props): any;
  /**
   * Defines a "io.k8s.api.storage.v1alpha1.VolumeAttachmentList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeVolumeAttachmentListV1Alpha1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSIStorageCapacity stores the result of one CSI GetCapacity call. For a given StorageClass, this describes the available capacity in a particular topology segment.  This can be used when considering where to instantiate new PersistentVolumes.

For example this can express things like: - StorageClass "standard" has "1234 GiB" available in "topology.kubernetes.io/zone=us-east1" - StorageClass "localssd" has "10 GiB" available in "kubernetes.io/hostname=knode-abc123"

The following three cases all imply that no capacity is available for a certain combination: - no object exists with suitable topology and storage class name - such an object exists, but the capacity is unset - such an object exists, but the capacity is zero

The producer of these objects can decide which approach is more suitable.

They are consumed by the kube-scheduler if the CSIStorageCapacity beta feature gate is enabled there and a CSI driver opts into capacity-aware scheduling with CSIDriver.StorageCapacity.
 *
 * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacity
 */
export declare class KubeCsiStorageCapacityV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1beta1.CSIStorageCapacity"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1beta1.CSIStorageCapacity".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiStorageCapacityV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.storage.v1beta1.CSIStorageCapacity" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCsiStorageCapacityV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CSIStorageCapacityList is a collection of CSIStorageCapacity objects.
 *
 * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacityList
 */
export declare class KubeCsiStorageCapacityListV1Beta1 extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.api.storage.v1beta1.CSIStorageCapacityList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.api.storage.v1beta1.CSIStorageCapacityList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCsiStorageCapacityListV1Beta1Props): any;
  /**
   * Defines a "io.k8s.api.storage.v1beta1.CSIStorageCapacityList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCsiStorageCapacityListV1Beta1Props,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CustomResourceDefinition represents a resource that should be exposed on the API server.  Its name MUST be in the format <.spec.name>.<.spec.group>.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition
 */
export declare class KubeCustomResourceDefinition extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCustomResourceDefinitionProps): any;
  /**
   * Defines a "io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCustomResourceDefinitionProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * CustomResourceDefinitionList is a list of CustomResourceDefinition objects.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionList
 */
export declare class KubeCustomResourceDefinitionList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeCustomResourceDefinitionListProps): any;
  /**
   * Defines a "io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(
    scope: Construct,
    id: string,
    props: KubeCustomResourceDefinitionListProps,
  );
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * Status is a return value for calls that don't return other objects.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Status
 */
export declare class KubeStatus extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.apimachinery.pkg.apis.meta.v1.Status"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.apimachinery.pkg.apis.meta.v1.Status".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeStatusProps): any;
  /**
   * Defines a "io.k8s.apimachinery.pkg.apis.meta.v1.Status" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeStatusProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * APIService represents a server for a particular GroupVersion. Name must be "version.group".
 *
 * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIService
 */
export declare class KubeApiService extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIService"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIService".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props?: KubeApiServiceProps): any;
  /**
   * Defines a "io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIService" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props?: KubeApiServiceProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * APIServiceList is a list of APIService objects.
 *
 * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceList
 */
export declare class KubeApiServiceList extends ApiObject {
  /**
   * Returns the apiVersion and kind for "io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceList"
   */
  static readonly GVK: GroupVersionKind;
  /**
   * Renders a Kubernetes manifest for "io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceList".
   *
   * This can be used to inline resource manifests inside other objects (e.g. as templates).
   *
   * @param props initialization props
   */
  static manifest(props: KubeApiServiceListProps): any;
  /**
   * Defines a "io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceList" API object
   * @param scope the scope in which to define this object
   * @param id a scope-local name for the object
   * @param props initialization props
   */
  constructor(scope: Construct, id: string, props: KubeApiServiceListProps);
  /**
   * Renders the object to Kubernetes JSON.
   */
  toJson(): any;
}
/**
 * MutatingWebhookConfiguration describes the configuration of and admission webhook that accept or reject and may change the object.
 *
 * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfiguration
 */
export interface KubeMutatingWebhookConfigurationProps {
  /**
   * Standard object metadata; More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata.
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfiguration#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Webhooks is a list of webhooks and the affected resources and operations.
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfiguration#webhooks
   */
  readonly webhooks?: MutatingWebhook[];
}
/**
 * Converts an object of type 'KubeMutatingWebhookConfigurationProps' to JSON representation.
 */
export declare function toJson_KubeMutatingWebhookConfigurationProps(
  obj: KubeMutatingWebhookConfigurationProps | undefined,
): Record<string, any> | undefined;
/**
 * MutatingWebhookConfigurationList is a list of MutatingWebhookConfiguration.
 *
 * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfigurationList
 */
export interface KubeMutatingWebhookConfigurationListProps {
  /**
   * List of MutatingWebhookConfiguration.
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfigurationList#items
   */
  readonly items: KubeMutatingWebhookConfigurationProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhookConfigurationList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeMutatingWebhookConfigurationListProps' to JSON representation.
 */
export declare function toJson_KubeMutatingWebhookConfigurationListProps(
  obj: KubeMutatingWebhookConfigurationListProps | undefined,
): Record<string, any> | undefined;
/**
 * ValidatingWebhookConfiguration describes the configuration of and admission webhook that accept or reject and object without changing it.
 *
 * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfiguration
 */
export interface KubeValidatingWebhookConfigurationProps {
  /**
   * Standard object metadata; More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata.
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfiguration#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Webhooks is a list of webhooks and the affected resources and operations.
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfiguration#webhooks
   */
  readonly webhooks?: ValidatingWebhook[];
}
/**
 * Converts an object of type 'KubeValidatingWebhookConfigurationProps' to JSON representation.
 */
export declare function toJson_KubeValidatingWebhookConfigurationProps(
  obj: KubeValidatingWebhookConfigurationProps | undefined,
): Record<string, any> | undefined;
/**
 * ValidatingWebhookConfigurationList is a list of ValidatingWebhookConfiguration.
 *
 * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfigurationList
 */
export interface KubeValidatingWebhookConfigurationListProps {
  /**
   * List of ValidatingWebhookConfiguration.
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfigurationList#items
   */
  readonly items: KubeValidatingWebhookConfigurationProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhookConfigurationList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeValidatingWebhookConfigurationListProps' to JSON representation.
 */
export declare function toJson_KubeValidatingWebhookConfigurationListProps(
  obj: KubeValidatingWebhookConfigurationListProps | undefined,
): Record<string, any> | undefined;
/**
 *
 * Storage version of a specific resource.
 *
 * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersion
 */
export interface KubeStorageVersionV1Alpha1Props {
  /**
   * The name is <group>.<resource>.
   *
   * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersion#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec is an empty spec. It is here to comply with Kubernetes API style.
   *
   * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersion#spec
   */
  readonly spec: any;
}
/**
 * Converts an object of type 'KubeStorageVersionV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeStorageVersionV1Alpha1Props(
  obj: KubeStorageVersionV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * A list of StorageVersions.
 *
 * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersionList
 */
export interface KubeStorageVersionListV1Alpha1Props {
  /**
   * Items holds a list of StorageVersion
   *
   * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersionList#items
   */
  readonly items: KubeStorageVersionV1Alpha1Props[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apiserverinternal.v1alpha1.StorageVersionList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeStorageVersionListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeStorageVersionListV1Alpha1Props(
  obj: KubeStorageVersionListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * ControllerRevision implements an immutable snapshot of state data. Clients are responsible for serializing and deserializing the objects that contain their internal state. Once a ControllerRevision has been successfully created, it can not be updated. The API Server will fail validation of all requests that attempt to mutate the Data field. ControllerRevisions may, however, be deleted. Note that, due to its use by both the DaemonSet and StatefulSet controllers for update and rollback, this object is beta. However, it may be subject to name and representation changes in future releases, and clients should not depend on its stability. It is primarily for internal use by controllers.
 *
 * @schema io.k8s.api.apps.v1.ControllerRevision
 */
export interface KubeControllerRevisionProps {
  /**
   * Data is the serialized representation of the state.
   *
   * @schema io.k8s.api.apps.v1.ControllerRevision#data
   */
  readonly data?: any;
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.ControllerRevision#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Revision indicates the revision of the state represented by Data.
   *
   * @schema io.k8s.api.apps.v1.ControllerRevision#revision
   */
  readonly revision: number;
}
/**
 * Converts an object of type 'KubeControllerRevisionProps' to JSON representation.
 */
export declare function toJson_KubeControllerRevisionProps(
  obj: KubeControllerRevisionProps | undefined,
): Record<string, any> | undefined;
/**
 * ControllerRevisionList is a resource containing a list of ControllerRevision objects.
 *
 * @schema io.k8s.api.apps.v1.ControllerRevisionList
 */
export interface KubeControllerRevisionListProps {
  /**
   * Items is the list of ControllerRevisions
   *
   * @schema io.k8s.api.apps.v1.ControllerRevisionList#items
   */
  readonly items: KubeControllerRevisionProps[];
  /**
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.ControllerRevisionList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeControllerRevisionListProps' to JSON representation.
 */
export declare function toJson_KubeControllerRevisionListProps(
  obj: KubeControllerRevisionListProps | undefined,
): Record<string, any> | undefined;
/**
 * DaemonSet represents the configuration of a daemon set.
 *
 * @schema io.k8s.api.apps.v1.DaemonSet
 */
export interface KubeDaemonSetProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.DaemonSet#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * The desired behavior of this daemon set. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.apps.v1.DaemonSet#spec
   */
  readonly spec?: DaemonSetSpec;
}
/**
 * Converts an object of type 'KubeDaemonSetProps' to JSON representation.
 */
export declare function toJson_KubeDaemonSetProps(
  obj: KubeDaemonSetProps | undefined,
): Record<string, any> | undefined;
/**
 * DaemonSetList is a collection of daemon sets.
 *
 * @schema io.k8s.api.apps.v1.DaemonSetList
 */
export interface KubeDaemonSetListProps {
  /**
   * A list of daemon sets.
   *
   * @schema io.k8s.api.apps.v1.DaemonSetList#items
   */
  readonly items: KubeDaemonSetProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.DaemonSetList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeDaemonSetListProps' to JSON representation.
 */
export declare function toJson_KubeDaemonSetListProps(
  obj: KubeDaemonSetListProps | undefined,
): Record<string, any> | undefined;
/**
 * Deployment enables declarative updates for Pods and ReplicaSets.
 *
 * @schema io.k8s.api.apps.v1.Deployment
 */
export interface KubeDeploymentProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.Deployment#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of the Deployment.
   *
   * @schema io.k8s.api.apps.v1.Deployment#spec
   */
  readonly spec?: DeploymentSpec;
}
/**
 * Converts an object of type 'KubeDeploymentProps' to JSON representation.
 */
export declare function toJson_KubeDeploymentProps(
  obj: KubeDeploymentProps | undefined,
): Record<string, any> | undefined;
/**
 * DeploymentList is a list of Deployments.
 *
 * @schema io.k8s.api.apps.v1.DeploymentList
 */
export interface KubeDeploymentListProps {
  /**
   * Items is the list of Deployments.
   *
   * @schema io.k8s.api.apps.v1.DeploymentList#items
   */
  readonly items: KubeDeploymentProps[];
  /**
   * Standard list metadata.
   *
   * @schema io.k8s.api.apps.v1.DeploymentList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeDeploymentListProps' to JSON representation.
 */
export declare function toJson_KubeDeploymentListProps(
  obj: KubeDeploymentListProps | undefined,
): Record<string, any> | undefined;
/**
 * ReplicaSet ensures that a specified number of pod replicas are running at any given time.
 *
 * @schema io.k8s.api.apps.v1.ReplicaSet
 */
export interface KubeReplicaSetProps {
  /**
   * If the Labels of a ReplicaSet are empty, they are defaulted to be the same as the Pod(s) that the ReplicaSet manages. Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.ReplicaSet#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the specification of the desired behavior of the ReplicaSet. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.apps.v1.ReplicaSet#spec
   */
  readonly spec?: ReplicaSetSpec;
}
/**
 * Converts an object of type 'KubeReplicaSetProps' to JSON representation.
 */
export declare function toJson_KubeReplicaSetProps(
  obj: KubeReplicaSetProps | undefined,
): Record<string, any> | undefined;
/**
 * ReplicaSetList is a collection of ReplicaSets.
 *
 * @schema io.k8s.api.apps.v1.ReplicaSetList
 */
export interface KubeReplicaSetListProps {
  /**
   * List of ReplicaSets. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller
   *
   * @schema io.k8s.api.apps.v1.ReplicaSetList#items
   */
  readonly items: KubeReplicaSetProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.apps.v1.ReplicaSetList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeReplicaSetListProps' to JSON representation.
 */
export declare function toJson_KubeReplicaSetListProps(
  obj: KubeReplicaSetListProps | undefined,
): Record<string, any> | undefined;
/**
 * StatefulSet represents a set of pods with consistent identities. Identities are defined as:
 * - Network: A single stable DNS and hostname.
 * - Storage: As many VolumeClaims as requested.
 * The StatefulSet guarantees that a given network identity will always map to the same storage identity.
 *
 * @schema io.k8s.api.apps.v1.StatefulSet
 */
export interface KubeStatefulSetProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.StatefulSet#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the desired identities of pods in this set.
   *
   * @schema io.k8s.api.apps.v1.StatefulSet#spec
   */
  readonly spec?: StatefulSetSpec;
}
/**
 * Converts an object of type 'KubeStatefulSetProps' to JSON representation.
 */
export declare function toJson_KubeStatefulSetProps(
  obj: KubeStatefulSetProps | undefined,
): Record<string, any> | undefined;
/**
 * StatefulSetList is a collection of StatefulSets.
 *
 * @schema io.k8s.api.apps.v1.StatefulSetList
 */
export interface KubeStatefulSetListProps {
  /**
   * Items is the list of stateful sets.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetList#items
   */
  readonly items: KubeStatefulSetProps[];
  /**
   * Standard list's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.apps.v1.StatefulSetList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeStatefulSetListProps' to JSON representation.
 */
export declare function toJson_KubeStatefulSetListProps(
  obj: KubeStatefulSetListProps | undefined,
): Record<string, any> | undefined;
/**
 * TokenRequest requests a token for a given service account.
 *
 * @schema io.k8s.api.authentication.v1.TokenRequest
 */
export interface KubeTokenRequestProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.authentication.v1.TokenRequest#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec holds information about the request being evaluated
   *
   * @schema io.k8s.api.authentication.v1.TokenRequest#spec
   */
  readonly spec: TokenRequestSpec;
}
/**
 * Converts an object of type 'KubeTokenRequestProps' to JSON representation.
 */
export declare function toJson_KubeTokenRequestProps(
  obj: KubeTokenRequestProps | undefined,
): Record<string, any> | undefined;
/**
 * TokenReview attempts to authenticate a token to a known user. Note: TokenReview requests may be cached by the webhook token authenticator plugin in the kube-apiserver.
 *
 * @schema io.k8s.api.authentication.v1.TokenReview
 */
export interface KubeTokenReviewProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.authentication.v1.TokenReview#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec holds information about the request being evaluated
   *
   * @schema io.k8s.api.authentication.v1.TokenReview#spec
   */
  readonly spec: TokenReviewSpec;
}
/**
 * Converts an object of type 'KubeTokenReviewProps' to JSON representation.
 */
export declare function toJson_KubeTokenReviewProps(
  obj: KubeTokenReviewProps | undefined,
): Record<string, any> | undefined;
/**
 * LocalSubjectAccessReview checks whether or not a user or group can perform an action in a given namespace. Having a namespace scoped resource makes it much easier to grant namespace scoped policy that includes permissions checking.
 *
 * @schema io.k8s.api.authorization.v1.LocalSubjectAccessReview
 */
export interface KubeLocalSubjectAccessReviewProps {
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.authorization.v1.LocalSubjectAccessReview#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec holds information about the request being evaluated.  spec.namespace must be equal to the namespace you made the request against.  If empty, it is defaulted.
   *
   * @schema io.k8s.api.authorization.v1.LocalSubjectAccessReview#spec
   */
  readonly spec: SubjectAccessReviewSpec;
}
/**
 * Converts an object of type 'KubeLocalSubjectAccessReviewProps' to JSON representation.
 */
export declare function toJson_KubeLocalSubjectAccessReviewProps(
  obj: KubeLocalSubjectAccessReviewProps | undefined,
): Record<string, any> | undefined;
/**
 * SelfSubjectAccessReview checks whether or the current user can perform an action.  Not filling in a spec.namespace means "in all namespaces".  Self is a special case, because users should always be able to check whether they can perform an action
 *
 * @schema io.k8s.api.authorization.v1.SelfSubjectAccessReview
 */
export interface KubeSelfSubjectAccessReviewProps {
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.authorization.v1.SelfSubjectAccessReview#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec holds information about the request being evaluated.  user and groups must be empty
   *
   * @schema io.k8s.api.authorization.v1.SelfSubjectAccessReview#spec
   */
  readonly spec: SelfSubjectAccessReviewSpec;
}
/**
 * Converts an object of type 'KubeSelfSubjectAccessReviewProps' to JSON representation.
 */
export declare function toJson_KubeSelfSubjectAccessReviewProps(
  obj: KubeSelfSubjectAccessReviewProps | undefined,
): Record<string, any> | undefined;
/**
 * SelfSubjectRulesReview enumerates the set of actions the current user can perform within a namespace. The returned list of actions may be incomplete depending on the server's authorization mode, and any errors experienced during the evaluation. SelfSubjectRulesReview should be used by UIs to show/hide actions, or to quickly let an end user reason about their permissions. It should NOT Be used by external systems to drive authorization decisions as this raises confused deputy, cache lifetime/revocation, and correctness concerns. SubjectAccessReview, and LocalAccessReview are the correct way to defer authorization decisions to the API server.
 *
 * @schema io.k8s.api.authorization.v1.SelfSubjectRulesReview
 */
export interface KubeSelfSubjectRulesReviewProps {
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.authorization.v1.SelfSubjectRulesReview#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec holds information about the request being evaluated.
   *
   * @schema io.k8s.api.authorization.v1.SelfSubjectRulesReview#spec
   */
  readonly spec: SelfSubjectRulesReviewSpec;
}
/**
 * Converts an object of type 'KubeSelfSubjectRulesReviewProps' to JSON representation.
 */
export declare function toJson_KubeSelfSubjectRulesReviewProps(
  obj: KubeSelfSubjectRulesReviewProps | undefined,
): Record<string, any> | undefined;
/**
 * SubjectAccessReview checks whether or not a user or group can perform an action.
 *
 * @schema io.k8s.api.authorization.v1.SubjectAccessReview
 */
export interface KubeSubjectAccessReviewProps {
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReview#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec holds information about the request being evaluated
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReview#spec
   */
  readonly spec: SubjectAccessReviewSpec;
}
/**
 * Converts an object of type 'KubeSubjectAccessReviewProps' to JSON representation.
 */
export declare function toJson_KubeSubjectAccessReviewProps(
  obj: KubeSubjectAccessReviewProps | undefined,
): Record<string, any> | undefined;
/**
 * configuration of a horizontal pod autoscaler.
 *
 * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscaler
 */
export interface KubeHorizontalPodAutoscalerProps {
  /**
   * Standard object metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscaler#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * behaviour of autoscaler. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status.
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscaler#spec
   */
  readonly spec?: HorizontalPodAutoscalerSpec;
}
/**
 * Converts an object of type 'KubeHorizontalPodAutoscalerProps' to JSON representation.
 */
export declare function toJson_KubeHorizontalPodAutoscalerProps(
  obj: KubeHorizontalPodAutoscalerProps | undefined,
): Record<string, any> | undefined;
/**
 * list of horizontal pod autoscaler objects.
 *
 * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerList
 */
export interface KubeHorizontalPodAutoscalerListProps {
  /**
   * list of horizontal pod autoscaler objects.
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerList#items
   */
  readonly items: KubeHorizontalPodAutoscalerProps[];
  /**
   * Standard list metadata.
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeHorizontalPodAutoscalerListProps' to JSON representation.
 */
export declare function toJson_KubeHorizontalPodAutoscalerListProps(
  obj: KubeHorizontalPodAutoscalerListProps | undefined,
): Record<string, any> | undefined;
/**
 * Scale represents a scaling request for a resource.
 *
 * @schema io.k8s.api.autoscaling.v1.Scale
 */
export interface KubeScaleProps {
  /**
   * Standard object metadata; More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata.
   *
   * @schema io.k8s.api.autoscaling.v1.Scale#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * defines the behavior of the scale. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status.
   *
   * @schema io.k8s.api.autoscaling.v1.Scale#spec
   */
  readonly spec?: ScaleSpec;
}
/**
 * Converts an object of type 'KubeScaleProps' to JSON representation.
 */
export declare function toJson_KubeScaleProps(
  obj: KubeScaleProps | undefined,
): Record<string, any> | undefined;
/**
 * HorizontalPodAutoscaler is the configuration for a horizontal pod autoscaler, which automatically manages the replica count of any resource implementing the scale subresource based on the metrics specified.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscaler
 */
export interface KubeHorizontalPodAutoscalerV2Beta1Props {
  /**
   * metadata is the standard object metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscaler#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * spec is the specification for the behaviour of the autoscaler. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscaler#spec
   */
  readonly spec?: HorizontalPodAutoscalerSpecV2Beta1;
}
/**
 * Converts an object of type 'KubeHorizontalPodAutoscalerV2Beta1Props' to JSON representation.
 */
export declare function toJson_KubeHorizontalPodAutoscalerV2Beta1Props(
  obj: KubeHorizontalPodAutoscalerV2Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * HorizontalPodAutoscaler is a list of horizontal pod autoscaler objects.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerList
 */
export interface KubeHorizontalPodAutoscalerListV2Beta1Props {
  /**
   * items is the list of horizontal pod autoscaler objects.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerList#items
   */
  readonly items: KubeHorizontalPodAutoscalerV2Beta1Props[];
  /**
   * metadata is the standard list metadata.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeHorizontalPodAutoscalerListV2Beta1Props' to JSON representation.
 */
export declare function toJson_KubeHorizontalPodAutoscalerListV2Beta1Props(
  obj: KubeHorizontalPodAutoscalerListV2Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * HorizontalPodAutoscaler is the configuration for a horizontal pod autoscaler, which automatically manages the replica count of any resource implementing the scale subresource based on the metrics specified.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscaler
 */
export interface KubeHorizontalPodAutoscalerV2Beta2Props {
  /**
   * metadata is the standard object metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscaler#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * spec is the specification for the behaviour of the autoscaler. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscaler#spec
   */
  readonly spec?: HorizontalPodAutoscalerSpecV2Beta2;
}
/**
 * Converts an object of type 'KubeHorizontalPodAutoscalerV2Beta2Props' to JSON representation.
 */
export declare function toJson_KubeHorizontalPodAutoscalerV2Beta2Props(
  obj: KubeHorizontalPodAutoscalerV2Beta2Props | undefined,
): Record<string, any> | undefined;
/**
 * HorizontalPodAutoscalerList is a list of horizontal pod autoscaler objects.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerList
 */
export interface KubeHorizontalPodAutoscalerListV2Beta2Props {
  /**
   * items is the list of horizontal pod autoscaler objects.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerList#items
   */
  readonly items: KubeHorizontalPodAutoscalerV2Beta2Props[];
  /**
   * metadata is the standard list metadata.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeHorizontalPodAutoscalerListV2Beta2Props' to JSON representation.
 */
export declare function toJson_KubeHorizontalPodAutoscalerListV2Beta2Props(
  obj: KubeHorizontalPodAutoscalerListV2Beta2Props | undefined,
): Record<string, any> | undefined;
/**
 * CronJob represents the configuration of a single cron job.
 *
 * @schema io.k8s.api.batch.v1.CronJob
 */
export interface KubeCronJobProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1.CronJob#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of a cron job, including the schedule. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.batch.v1.CronJob#spec
   */
  readonly spec?: CronJobSpec;
}
/**
 * Converts an object of type 'KubeCronJobProps' to JSON representation.
 */
export declare function toJson_KubeCronJobProps(
  obj: KubeCronJobProps | undefined,
): Record<string, any> | undefined;
/**
 * CronJobList is a collection of cron jobs.
 *
 * @schema io.k8s.api.batch.v1.CronJobList
 */
export interface KubeCronJobListProps {
  /**
   * items is the list of CronJobs.
   *
   * @schema io.k8s.api.batch.v1.CronJobList#items
   */
  readonly items: KubeCronJobProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1.CronJobList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCronJobListProps' to JSON representation.
 */
export declare function toJson_KubeCronJobListProps(
  obj: KubeCronJobListProps | undefined,
): Record<string, any> | undefined;
/**
 * Job represents the configuration of a single job.
 *
 * @schema io.k8s.api.batch.v1.Job
 */
export interface KubeJobProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1.Job#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of a job. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.batch.v1.Job#spec
   */
  readonly spec?: JobSpec;
}
/**
 * Converts an object of type 'KubeJobProps' to JSON representation.
 */
export declare function toJson_KubeJobProps(
  obj: KubeJobProps | undefined,
): Record<string, any> | undefined;
/**
 * JobList is a collection of jobs.
 *
 * @schema io.k8s.api.batch.v1.JobList
 */
export interface KubeJobListProps {
  /**
   * items is the list of Jobs.
   *
   * @schema io.k8s.api.batch.v1.JobList#items
   */
  readonly items: KubeJobProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1.JobList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeJobListProps' to JSON representation.
 */
export declare function toJson_KubeJobListProps(
  obj: KubeJobListProps | undefined,
): Record<string, any> | undefined;
/**
 * CronJob represents the configuration of a single cron job.
 *
 * @schema io.k8s.api.batch.v1beta1.CronJob
 */
export interface KubeCronJobV1Beta1Props {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1beta1.CronJob#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of a cron job, including the schedule. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.batch.v1beta1.CronJob#spec
   */
  readonly spec?: CronJobSpecV1Beta1;
}
/**
 * Converts an object of type 'KubeCronJobV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeCronJobV1Beta1Props(
  obj: KubeCronJobV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * CronJobList is a collection of cron jobs.
 *
 * @schema io.k8s.api.batch.v1beta1.CronJobList
 */
export interface KubeCronJobListV1Beta1Props {
  /**
   * items is the list of CronJobs.
   *
   * @schema io.k8s.api.batch.v1beta1.CronJobList#items
   */
  readonly items: KubeCronJobV1Beta1Props[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1beta1.CronJobList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCronJobListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeCronJobListV1Beta1Props(
  obj: KubeCronJobListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * CertificateSigningRequest objects provide a mechanism to obtain x509 certificates by submitting a certificate signing request, and having it asynchronously approved and issued.
 *
 * Kubelets use this API to obtain:
 * 1. client certificates to authenticate to kube-apiserver (with the "kubernetes.io/kube-apiserver-client-kubelet" signerName).
 * 2. serving certificates for TLS endpoints kube-apiserver can connect to securely (with the "kubernetes.io/kubelet-serving" signerName).
 *
 * This API can be used to request client certificates to authenticate to kube-apiserver (with the "kubernetes.io/kube-apiserver-client" signerName), or to obtain certificates from custom non-Kubernetes signers.
 *
 * @schema io.k8s.api.certificates.v1.CertificateSigningRequest
 */
export interface KubeCertificateSigningRequestProps {
  /**
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequest#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * spec contains the certificate request, and is immutable after creation. Only the request, signerName, expirationSeconds, and usages fields can be set on creation. Other fields are derived by Kubernetes and cannot be modified by users.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequest#spec
   */
  readonly spec: CertificateSigningRequestSpec;
}
/**
 * Converts an object of type 'KubeCertificateSigningRequestProps' to JSON representation.
 */
export declare function toJson_KubeCertificateSigningRequestProps(
  obj: KubeCertificateSigningRequestProps | undefined,
): Record<string, any> | undefined;
/**
 * CertificateSigningRequestList is a collection of CertificateSigningRequest objects
 *
 * @schema io.k8s.api.certificates.v1.CertificateSigningRequestList
 */
export interface KubeCertificateSigningRequestListProps {
  /**
   * items is a collection of CertificateSigningRequest objects
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestList#items
   */
  readonly items: KubeCertificateSigningRequestProps[];
  /**
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCertificateSigningRequestListProps' to JSON representation.
 */
export declare function toJson_KubeCertificateSigningRequestListProps(
  obj: KubeCertificateSigningRequestListProps | undefined,
): Record<string, any> | undefined;
/**
 * Lease defines a lease concept.
 *
 * @schema io.k8s.api.coordination.v1.Lease
 */
export interface KubeLeaseProps {
  /**
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.coordination.v1.Lease#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the Lease. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.coordination.v1.Lease#spec
   */
  readonly spec?: LeaseSpec;
}
/**
 * Converts an object of type 'KubeLeaseProps' to JSON representation.
 */
export declare function toJson_KubeLeaseProps(
  obj: KubeLeaseProps | undefined,
): Record<string, any> | undefined;
/**
 * LeaseList is a list of Lease objects.
 *
 * @schema io.k8s.api.coordination.v1.LeaseList
 */
export interface KubeLeaseListProps {
  /**
   * Items is a list of schema objects.
   *
   * @schema io.k8s.api.coordination.v1.LeaseList#items
   */
  readonly items: KubeLeaseProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.coordination.v1.LeaseList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeLeaseListProps' to JSON representation.
 */
export declare function toJson_KubeLeaseListProps(
  obj: KubeLeaseListProps | undefined,
): Record<string, any> | undefined;
/**
 * Binding ties one object to another; for example, a pod is bound to a node by a scheduler. Deprecated in 1.7, please use the bindings subresource of pods instead.
 *
 * @schema io.k8s.api.core.v1.Binding
 */
export interface KubeBindingProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.Binding#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * The target object that you want to bind to the standard object.
   *
   * @schema io.k8s.api.core.v1.Binding#target
   */
  readonly target: ObjectReference;
}
/**
 * Converts an object of type 'KubeBindingProps' to JSON representation.
 */
export declare function toJson_KubeBindingProps(
  obj: KubeBindingProps | undefined,
): Record<string, any> | undefined;
/**
 * ComponentStatus (and ComponentStatusList) holds the cluster validation info. Deprecated: This API is deprecated in v1.19+
 *
 * @schema io.k8s.api.core.v1.ComponentStatus
 */
export interface KubeComponentStatusProps {
  /**
   * List of component conditions observed
   *
   * @schema io.k8s.api.core.v1.ComponentStatus#conditions
   */
  readonly conditions?: ComponentCondition[];
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.ComponentStatus#metadata
   */
  readonly metadata?: ObjectMeta;
}
/**
 * Converts an object of type 'KubeComponentStatusProps' to JSON representation.
 */
export declare function toJson_KubeComponentStatusProps(
  obj: KubeComponentStatusProps | undefined,
): Record<string, any> | undefined;
/**
 * Status of all the conditions for the component as a list of ComponentStatus objects. Deprecated: This API is deprecated in v1.19+
 *
 * @schema io.k8s.api.core.v1.ComponentStatusList
 */
export interface KubeComponentStatusListProps {
  /**
   * List of ComponentStatus objects.
   *
   * @schema io.k8s.api.core.v1.ComponentStatusList#items
   */
  readonly items: KubeComponentStatusProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.ComponentStatusList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeComponentStatusListProps' to JSON representation.
 */
export declare function toJson_KubeComponentStatusListProps(
  obj: KubeComponentStatusListProps | undefined,
): Record<string, any> | undefined;
/**
 * ConfigMap holds configuration data for pods to consume.
 *
 * @schema io.k8s.api.core.v1.ConfigMap
 */
export interface KubeConfigMapProps {
  /**
   * BinaryData contains the binary data. Each key must consist of alphanumeric characters, '-', '_' or '.'. BinaryData can contain byte sequences that are not in the UTF-8 range. The keys stored in BinaryData must not overlap with the ones in the Data field, this is enforced during validation process. Using this field will require 1.10+ apiserver and kubelet.
   *
   * @schema io.k8s.api.core.v1.ConfigMap#binaryData
   */
  readonly binaryData?: {
    [key: string]: string;
  };
  /**
   * Data contains the configuration data. Each key must consist of alphanumeric characters, '-', '_' or '.'. Values with non-UTF-8 byte sequences must use the BinaryData field. The keys stored in Data must not overlap with the keys in the BinaryData field, this is enforced during validation process.
   *
   * @schema io.k8s.api.core.v1.ConfigMap#data
   */
  readonly data?: {
    [key: string]: string;
  };
  /**
   * Immutable, if set to true, ensures that data stored in the ConfigMap cannot be updated (only object metadata can be modified). If not set to true, the field can be modified at any time. Defaulted to nil.
   *
   * @schema io.k8s.api.core.v1.ConfigMap#immutable
   */
  readonly immutable?: boolean;
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.ConfigMap#metadata
   */
  readonly metadata?: ObjectMeta;
}
/**
 * Converts an object of type 'KubeConfigMapProps' to JSON representation.
 */
export declare function toJson_KubeConfigMapProps(
  obj: KubeConfigMapProps | undefined,
): Record<string, any> | undefined;
/**
 * ConfigMapList is a resource containing a list of ConfigMap objects.
 *
 * @schema io.k8s.api.core.v1.ConfigMapList
 */
export interface KubeConfigMapListProps {
  /**
   * Items is the list of ConfigMaps.
   *
   * @schema io.k8s.api.core.v1.ConfigMapList#items
   */
  readonly items: KubeConfigMapProps[];
  /**
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.ConfigMapList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeConfigMapListProps' to JSON representation.
 */
export declare function toJson_KubeConfigMapListProps(
  obj: KubeConfigMapListProps | undefined,
): Record<string, any> | undefined;
/**
 * Endpoints is a collection of endpoints that implement the actual service. Example:
 * Name: "mysvc",
 * Subsets: [
 * {
 * Addresses: [{"ip": "10.10.1.1"}, {"ip": "10.10.2.2"}],
 * Ports: [{"name": "a", "port": 8675}, {"name": "b", "port": 309}]
 * },
 * {
 * Addresses: [{"ip": "10.10.3.3"}],
 * Ports: [{"name": "a", "port": 93}, {"name": "b", "port": 76}]
 * },
 * ]
 *
 * @schema io.k8s.api.core.v1.Endpoints
 */
export interface KubeEndpointsProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.Endpoints#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * The set of all endpoints is the union of all subsets. Addresses are placed into subsets according to the IPs they share. A single address with multiple ports, some of which are ready and some of which are not (because they come from different containers) will result in the address being displayed in different subsets for the different ports. No address will appear in both Addresses and NotReadyAddresses in the same subset. Sets of addresses and ports that comprise a service.
   *
   * @schema io.k8s.api.core.v1.Endpoints#subsets
   */
  readonly subsets?: EndpointSubset[];
}
/**
 * Converts an object of type 'KubeEndpointsProps' to JSON representation.
 */
export declare function toJson_KubeEndpointsProps(
  obj: KubeEndpointsProps | undefined,
): Record<string, any> | undefined;
/**
 * EndpointsList is a list of endpoints.
 *
 * @schema io.k8s.api.core.v1.EndpointsList
 */
export interface KubeEndpointsListProps {
  /**
   * List of endpoints.
   *
   * @schema io.k8s.api.core.v1.EndpointsList#items
   */
  readonly items: KubeEndpointsProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.EndpointsList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeEndpointsListProps' to JSON representation.
 */
export declare function toJson_KubeEndpointsListProps(
  obj: KubeEndpointsListProps | undefined,
): Record<string, any> | undefined;
/**
 * Event is a report of an event somewhere in the cluster. It generally denotes some state change in the system. Events have a limited retention time and triggers and messages may evolve with time.  Event consumers should not rely on the timing of an event with a given Reason reflecting a consistent underlying trigger, or the continued existence of events with that Reason.  Events should be treated as informative, best-effort, supplemental data.
 *
 * @schema io.k8s.api.events.v1.Event
 */
export interface KubeEventProps {
  /**
   * action is what action was taken/failed regarding to the regarding object. It is machine-readable. This field cannot be empty for new Events and it can have at most 128 characters.
   *
   * @schema io.k8s.api.events.v1.Event#action
   */
  readonly action?: string;
  /**
   * deprecatedCount is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1.Event#deprecatedCount
   */
  readonly deprecatedCount?: number;
  /**
   * deprecatedFirstTimestamp is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1.Event#deprecatedFirstTimestamp
   */
  readonly deprecatedFirstTimestamp?: Date;
  /**
   * deprecatedLastTimestamp is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1.Event#deprecatedLastTimestamp
   */
  readonly deprecatedLastTimestamp?: Date;
  /**
   * deprecatedSource is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1.Event#deprecatedSource
   */
  readonly deprecatedSource?: EventSource;
  /**
   * eventTime is the time when this Event was first observed. It is required.
   *
   * @schema io.k8s.api.events.v1.Event#eventTime
   */
  readonly eventTime: Date;
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.events.v1.Event#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * note is a human-readable description of the status of this operation. Maximal length of the note is 1kB, but libraries should be prepared to handle values up to 64kB.
   *
   * @schema io.k8s.api.events.v1.Event#note
   */
  readonly note?: string;
  /**
   * reason is why the action was taken. It is human-readable. This field cannot be empty for new Events and it can have at most 128 characters.
   *
   * @schema io.k8s.api.events.v1.Event#reason
   */
  readonly reason?: string;
  /**
   * regarding contains the object this Event is about. In most cases it's an Object reporting controller implements, e.g. ReplicaSetController implements ReplicaSets and this event is emitted because it acts on some changes in a ReplicaSet object.
   *
   * @schema io.k8s.api.events.v1.Event#regarding
   */
  readonly regarding?: ObjectReference;
  /**
   * related is the optional secondary object for more complex actions. E.g. when regarding object triggers a creation or deletion of related object.
   *
   * @schema io.k8s.api.events.v1.Event#related
   */
  readonly related?: ObjectReference;
  /**
   * reportingController is the name of the controller that emitted this Event, e.g. `kubernetes.io/kubelet`. This field cannot be empty for new Events.
   *
   * @schema io.k8s.api.events.v1.Event#reportingController
   */
  readonly reportingController?: string;
  /**
   * reportingInstance is the ID of the controller instance, e.g. `kubelet-xyzf`. This field cannot be empty for new Events and it can have at most 128 characters.
   *
   * @schema io.k8s.api.events.v1.Event#reportingInstance
   */
  readonly reportingInstance?: string;
  /**
   * series is data about the Event series this event represents or nil if it's a singleton Event.
   *
   * @schema io.k8s.api.events.v1.Event#series
   */
  readonly series?: EventSeries;
  /**
   * type is the type of this event (Normal, Warning), new types could be added in the future. It is machine-readable. This field cannot be empty for new Events.
   *
   * @schema io.k8s.api.events.v1.Event#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'KubeEventProps' to JSON representation.
 */
export declare function toJson_KubeEventProps(
  obj: KubeEventProps | undefined,
): Record<string, any> | undefined;
/**
 * EventList is a list of Event objects.
 *
 * @schema io.k8s.api.events.v1.EventList
 */
export interface KubeEventListProps {
  /**
   * items is a list of schema objects.
   *
   * @schema io.k8s.api.events.v1.EventList#items
   */
  readonly items: KubeEventProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.events.v1.EventList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeEventListProps' to JSON representation.
 */
export declare function toJson_KubeEventListProps(
  obj: KubeEventListProps | undefined,
): Record<string, any> | undefined;
/**
 * LimitRange sets resource usage limits for each kind of resource in a Namespace.
 *
 * @schema io.k8s.api.core.v1.LimitRange
 */
export interface KubeLimitRangeProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.LimitRange#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the limits enforced. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.LimitRange#spec
   */
  readonly spec?: LimitRangeSpec;
}
/**
 * Converts an object of type 'KubeLimitRangeProps' to JSON representation.
 */
export declare function toJson_KubeLimitRangeProps(
  obj: KubeLimitRangeProps | undefined,
): Record<string, any> | undefined;
/**
 * LimitRangeList is a list of LimitRange items.
 *
 * @schema io.k8s.api.core.v1.LimitRangeList
 */
export interface KubeLimitRangeListProps {
  /**
   * Items is a list of LimitRange objects. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
   *
   * @schema io.k8s.api.core.v1.LimitRangeList#items
   */
  readonly items: KubeLimitRangeProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.LimitRangeList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeLimitRangeListProps' to JSON representation.
 */
export declare function toJson_KubeLimitRangeListProps(
  obj: KubeLimitRangeListProps | undefined,
): Record<string, any> | undefined;
/**
 * Namespace provides a scope for Names. Use of multiple namespaces is optional.
 *
 * @schema io.k8s.api.core.v1.Namespace
 */
export interface KubeNamespaceProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.Namespace#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the behavior of the Namespace. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.Namespace#spec
   */
  readonly spec?: NamespaceSpec;
}
/**
 * Converts an object of type 'KubeNamespaceProps' to JSON representation.
 */
export declare function toJson_KubeNamespaceProps(
  obj: KubeNamespaceProps | undefined,
): Record<string, any> | undefined;
/**
 * NamespaceList is a list of Namespaces.
 *
 * @schema io.k8s.api.core.v1.NamespaceList
 */
export interface KubeNamespaceListProps {
  /**
   * Items is the list of Namespace objects in the list. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
   *
   * @schema io.k8s.api.core.v1.NamespaceList#items
   */
  readonly items: KubeNamespaceProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.NamespaceList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeNamespaceListProps' to JSON representation.
 */
export declare function toJson_KubeNamespaceListProps(
  obj: KubeNamespaceListProps | undefined,
): Record<string, any> | undefined;
/**
 * Node is a worker node in Kubernetes. Each node will have a unique identifier in the cache (i.e. in etcd).
 *
 * @schema io.k8s.api.core.v1.Node
 */
export interface KubeNodeProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.Node#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the behavior of a node. https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.Node#spec
   */
  readonly spec?: NodeSpec;
}
/**
 * Converts an object of type 'KubeNodeProps' to JSON representation.
 */
export declare function toJson_KubeNodeProps(
  obj: KubeNodeProps | undefined,
): Record<string, any> | undefined;
/**
 * NodeList is the whole list of all Nodes which have been registered with master.
 *
 * @schema io.k8s.api.core.v1.NodeList
 */
export interface KubeNodeListProps {
  /**
   * List of nodes
   *
   * @schema io.k8s.api.core.v1.NodeList#items
   */
  readonly items: KubeNodeProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.NodeList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeNodeListProps' to JSON representation.
 */
export declare function toJson_KubeNodeListProps(
  obj: KubeNodeListProps | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolume (PV) is a storage resource provisioned by an administrator. It is analogous to a node. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes
 *
 * @schema io.k8s.api.core.v1.PersistentVolume
 */
export interface KubePersistentVolumeProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.PersistentVolume#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines a specification of a persistent volume owned by the cluster. Provisioned by an administrator. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistent-volumes
   *
   * @schema io.k8s.api.core.v1.PersistentVolume#spec
   */
  readonly spec?: PersistentVolumeSpec;
}
/**
 * Converts an object of type 'KubePersistentVolumeProps' to JSON representation.
 */
export declare function toJson_KubePersistentVolumeProps(
  obj: KubePersistentVolumeProps | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolumeClaim is a user's request for and claim to a persistent volume
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeClaim
 */
export interface KubePersistentVolumeClaimProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaim#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the desired characteristics of a volume requested by a pod author. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaim#spec
   */
  readonly spec?: PersistentVolumeClaimSpec;
}
/**
 * Converts an object of type 'KubePersistentVolumeClaimProps' to JSON representation.
 */
export declare function toJson_KubePersistentVolumeClaimProps(
  obj: KubePersistentVolumeClaimProps | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolumeClaimList is a list of PersistentVolumeClaim items.
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeClaimList
 */
export interface KubePersistentVolumeClaimListProps {
  /**
   * A list of persistent volume claims. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimList#items
   */
  readonly items: KubePersistentVolumeClaimProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePersistentVolumeClaimListProps' to JSON representation.
 */
export declare function toJson_KubePersistentVolumeClaimListProps(
  obj: KubePersistentVolumeClaimListProps | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolumeList is a list of PersistentVolume items.
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeList
 */
export interface KubePersistentVolumeListProps {
  /**
   * List of persistent volumes. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeList#items
   */
  readonly items: KubePersistentVolumeProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePersistentVolumeListProps' to JSON representation.
 */
export declare function toJson_KubePersistentVolumeListProps(
  obj: KubePersistentVolumeListProps | undefined,
): Record<string, any> | undefined;
/**
 * Pod is a collection of containers that can run on a host. This resource is created by clients and scheduled onto hosts.
 *
 * @schema io.k8s.api.core.v1.Pod
 */
export interface KubePodProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.Pod#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of the pod. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.Pod#spec
   */
  readonly spec?: PodSpec;
}
/**
 * Converts an object of type 'KubePodProps' to JSON representation.
 */
export declare function toJson_KubePodProps(
  obj: KubePodProps | undefined,
): Record<string, any> | undefined;
/**
 * PodList is a list of Pods.
 *
 * @schema io.k8s.api.core.v1.PodList
 */
export interface KubePodListProps {
  /**
   * List of pods. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md
   *
   * @schema io.k8s.api.core.v1.PodList#items
   */
  readonly items: KubePodProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.PodList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePodListProps' to JSON representation.
 */
export declare function toJson_KubePodListProps(
  obj: KubePodListProps | undefined,
): Record<string, any> | undefined;
/**
 * PodTemplate describes a template for creating copies of a predefined pod.
 *
 * @schema io.k8s.api.core.v1.PodTemplate
 */
export interface KubePodTemplateProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.PodTemplate#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Template defines the pods that will be created from this pod template. https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.PodTemplate#template
   */
  readonly template?: PodTemplateSpec;
}
/**
 * Converts an object of type 'KubePodTemplateProps' to JSON representation.
 */
export declare function toJson_KubePodTemplateProps(
  obj: KubePodTemplateProps | undefined,
): Record<string, any> | undefined;
/**
 * PodTemplateList is a list of PodTemplates.
 *
 * @schema io.k8s.api.core.v1.PodTemplateList
 */
export interface KubePodTemplateListProps {
  /**
   * List of pod templates
   *
   * @schema io.k8s.api.core.v1.PodTemplateList#items
   */
  readonly items: KubePodTemplateProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.PodTemplateList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePodTemplateListProps' to JSON representation.
 */
export declare function toJson_KubePodTemplateListProps(
  obj: KubePodTemplateListProps | undefined,
): Record<string, any> | undefined;
/**
 * ReplicationController represents the configuration of a replication controller.
 *
 * @schema io.k8s.api.core.v1.ReplicationController
 */
export interface KubeReplicationControllerProps {
  /**
   * If the Labels of a ReplicationController are empty, they are defaulted to be the same as the Pod(s) that the replication controller manages. Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.ReplicationController#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the specification of the desired behavior of the replication controller. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.ReplicationController#spec
   */
  readonly spec?: ReplicationControllerSpec;
}
/**
 * Converts an object of type 'KubeReplicationControllerProps' to JSON representation.
 */
export declare function toJson_KubeReplicationControllerProps(
  obj: KubeReplicationControllerProps | undefined,
): Record<string, any> | undefined;
/**
 * ReplicationControllerList is a collection of replication controllers.
 *
 * @schema io.k8s.api.core.v1.ReplicationControllerList
 */
export interface KubeReplicationControllerListProps {
  /**
   * List of replication controllers. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller
   *
   * @schema io.k8s.api.core.v1.ReplicationControllerList#items
   */
  readonly items: KubeReplicationControllerProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.ReplicationControllerList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeReplicationControllerListProps' to JSON representation.
 */
export declare function toJson_KubeReplicationControllerListProps(
  obj: KubeReplicationControllerListProps | undefined,
): Record<string, any> | undefined;
/**
 * ResourceQuota sets aggregate quota restrictions enforced per namespace
 *
 * @schema io.k8s.api.core.v1.ResourceQuota
 */
export interface KubeResourceQuotaProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.ResourceQuota#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the desired quota. https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.ResourceQuota#spec
   */
  readonly spec?: ResourceQuotaSpec;
}
/**
 * Converts an object of type 'KubeResourceQuotaProps' to JSON representation.
 */
export declare function toJson_KubeResourceQuotaProps(
  obj: KubeResourceQuotaProps | undefined,
): Record<string, any> | undefined;
/**
 * ResourceQuotaList is a list of ResourceQuota items.
 *
 * @schema io.k8s.api.core.v1.ResourceQuotaList
 */
export interface KubeResourceQuotaListProps {
  /**
   * Items is a list of ResourceQuota objects. More info: https://kubernetes.io/docs/concepts/policy/resource-quotas/
   *
   * @schema io.k8s.api.core.v1.ResourceQuotaList#items
   */
  readonly items: KubeResourceQuotaProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.ResourceQuotaList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeResourceQuotaListProps' to JSON representation.
 */
export declare function toJson_KubeResourceQuotaListProps(
  obj: KubeResourceQuotaListProps | undefined,
): Record<string, any> | undefined;
/**
 * Secret holds secret data of a certain type. The total bytes of the values in the Data field must be less than MaxSecretSize bytes.
 *
 * @schema io.k8s.api.core.v1.Secret
 */
export interface KubeSecretProps {
  /**
   * Data contains the secret data. Each key must consist of alphanumeric characters, '-', '_' or '.'. The serialized form of the secret data is a base64 encoded string, representing the arbitrary (possibly non-string) data value here. Described in https://tools.ietf.org/html/rfc4648#section-4
   *
   * @schema io.k8s.api.core.v1.Secret#data
   */
  readonly data?: {
    [key: string]: string;
  };
  /**
   * Immutable, if set to true, ensures that data stored in the Secret cannot be updated (only object metadata can be modified). If not set to true, the field can be modified at any time. Defaulted to nil.
   *
   * @schema io.k8s.api.core.v1.Secret#immutable
   */
  readonly immutable?: boolean;
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.Secret#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * stringData allows specifying non-binary secret data in string form. It is provided as a write-only input field for convenience. All keys and values are merged into the data field on write, overwriting any existing values. The stringData field is never output when reading from the API.
   *
   * @schema io.k8s.api.core.v1.Secret#stringData
   */
  readonly stringData?: {
    [key: string]: string;
  };
  /**
   * Used to facilitate programmatic handling of secret data.
   *
   * @schema io.k8s.api.core.v1.Secret#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'KubeSecretProps' to JSON representation.
 */
export declare function toJson_KubeSecretProps(
  obj: KubeSecretProps | undefined,
): Record<string, any> | undefined;
/**
 * SecretList is a list of Secret.
 *
 * @schema io.k8s.api.core.v1.SecretList
 */
export interface KubeSecretListProps {
  /**
   * Items is a list of secret objects. More info: https://kubernetes.io/docs/concepts/configuration/secret
   *
   * @schema io.k8s.api.core.v1.SecretList#items
   */
  readonly items: KubeSecretProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.SecretList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeSecretListProps' to JSON representation.
 */
export declare function toJson_KubeSecretListProps(
  obj: KubeSecretListProps | undefined,
): Record<string, any> | undefined;
/**
 * Service is a named abstraction of software service (for example, mysql) consisting of local port (for example 3306) that the proxy listens on, and the selector that determines which pods will answer requests sent through the proxy.
 *
 * @schema io.k8s.api.core.v1.Service
 */
export interface KubeServiceProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.Service#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec defines the behavior of a service. https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.Service#spec
   */
  readonly spec?: ServiceSpec;
}
/**
 * Converts an object of type 'KubeServiceProps' to JSON representation.
 */
export declare function toJson_KubeServiceProps(
  obj: KubeServiceProps | undefined,
): Record<string, any> | undefined;
/**
 * ServiceAccount binds together: * a name, understood by users, and perhaps by peripheral systems, for an identity * a principal that can be authenticated and authorized * a set of secrets
 *
 * @schema io.k8s.api.core.v1.ServiceAccount
 */
export interface KubeServiceAccountProps {
  /**
   * AutomountServiceAccountToken indicates whether pods running as this service account should have an API token automatically mounted. Can be overridden at the pod level.
   *
   * @schema io.k8s.api.core.v1.ServiceAccount#automountServiceAccountToken
   */
  readonly automountServiceAccountToken?: boolean;
  /**
   * ImagePullSecrets is a list of references to secrets in the same namespace to use for pulling any images in pods that reference this ServiceAccount. ImagePullSecrets are distinct from Secrets because Secrets can be mounted in the pod, but ImagePullSecrets are only accessed by the kubelet. More info: https://kubernetes.io/docs/concepts/containers/images/#specifying-imagepullsecrets-on-a-pod
   *
   * @schema io.k8s.api.core.v1.ServiceAccount#imagePullSecrets
   */
  readonly imagePullSecrets?: LocalObjectReference[];
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.ServiceAccount#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Secrets is the list of secrets allowed to be used by pods running using this ServiceAccount. More info: https://kubernetes.io/docs/concepts/configuration/secret
   *
   * @schema io.k8s.api.core.v1.ServiceAccount#secrets
   */
  readonly secrets?: ObjectReference[];
}
/**
 * Converts an object of type 'KubeServiceAccountProps' to JSON representation.
 */
export declare function toJson_KubeServiceAccountProps(
  obj: KubeServiceAccountProps | undefined,
): Record<string, any> | undefined;
/**
 * ServiceAccountList is a list of ServiceAccount objects
 *
 * @schema io.k8s.api.core.v1.ServiceAccountList
 */
export interface KubeServiceAccountListProps {
  /**
   * List of ServiceAccounts. More info: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/
   *
   * @schema io.k8s.api.core.v1.ServiceAccountList#items
   */
  readonly items: KubeServiceAccountProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.ServiceAccountList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeServiceAccountListProps' to JSON representation.
 */
export declare function toJson_KubeServiceAccountListProps(
  obj: KubeServiceAccountListProps | undefined,
): Record<string, any> | undefined;
/**
 * ServiceList holds a list of services.
 *
 * @schema io.k8s.api.core.v1.ServiceList
 */
export interface KubeServiceListProps {
  /**
   * List of services
   *
   * @schema io.k8s.api.core.v1.ServiceList#items
   */
  readonly items: KubeServiceProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.ServiceList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeServiceListProps' to JSON representation.
 */
export declare function toJson_KubeServiceListProps(
  obj: KubeServiceListProps | undefined,
): Record<string, any> | undefined;
/**
 * EndpointSlice represents a subset of the endpoints that implement a service. For a given service there may be multiple EndpointSlice objects, selected by labels, which must be joined to produce the full set of endpoints.
 *
 * @schema io.k8s.api.discovery.v1.EndpointSlice
 */
export interface KubeEndpointSliceProps {
  /**
   * addressType specifies the type of address carried by this EndpointSlice. All addresses in this slice must be the same type. This field is immutable after creation. The following address types are currently supported: * IPv4: Represents an IPv4 Address. * IPv6: Represents an IPv6 Address. * FQDN: Represents a Fully Qualified Domain Name.
   *
   * @schema io.k8s.api.discovery.v1.EndpointSlice#addressType
   */
  readonly addressType: string;
  /**
   * endpoints is a list of unique endpoints in this slice. Each slice may include a maximum of 1000 endpoints.
   *
   * @schema io.k8s.api.discovery.v1.EndpointSlice#endpoints
   */
  readonly endpoints: Endpoint[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.discovery.v1.EndpointSlice#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * ports specifies the list of network ports exposed by each endpoint in this slice. Each port must have a unique name. When ports is empty, it indicates that there are no defined ports. When a port is defined with a nil port value, it indicates "all ports". Each slice may include a maximum of 100 ports.
   *
   * @schema io.k8s.api.discovery.v1.EndpointSlice#ports
   */
  readonly ports?: EndpointPort[];
}
/**
 * Converts an object of type 'KubeEndpointSliceProps' to JSON representation.
 */
export declare function toJson_KubeEndpointSliceProps(
  obj: KubeEndpointSliceProps | undefined,
): Record<string, any> | undefined;
/**
 * EndpointSliceList represents a list of endpoint slices
 *
 * @schema io.k8s.api.discovery.v1.EndpointSliceList
 */
export interface KubeEndpointSliceListProps {
  /**
   * List of endpoint slices
   *
   * @schema io.k8s.api.discovery.v1.EndpointSliceList#items
   */
  readonly items: KubeEndpointSliceProps[];
  /**
   * Standard list metadata.
   *
   * @schema io.k8s.api.discovery.v1.EndpointSliceList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeEndpointSliceListProps' to JSON representation.
 */
export declare function toJson_KubeEndpointSliceListProps(
  obj: KubeEndpointSliceListProps | undefined,
): Record<string, any> | undefined;
/**
 * EndpointSlice represents a subset of the endpoints that implement a service. For a given service there may be multiple EndpointSlice objects, selected by labels, which must be joined to produce the full set of endpoints.
 *
 * @schema io.k8s.api.discovery.v1beta1.EndpointSlice
 */
export interface KubeEndpointSliceV1Beta1Props {
  /**
   * addressType specifies the type of address carried by this EndpointSlice. All addresses in this slice must be the same type. This field is immutable after creation. The following address types are currently supported: * IPv4: Represents an IPv4 Address. * IPv6: Represents an IPv6 Address. * FQDN: Represents a Fully Qualified Domain Name.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointSlice#addressType
   */
  readonly addressType: string;
  /**
   * endpoints is a list of unique endpoints in this slice. Each slice may include a maximum of 1000 endpoints.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointSlice#endpoints
   */
  readonly endpoints: EndpointV1Beta1[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointSlice#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * ports specifies the list of network ports exposed by each endpoint in this slice. Each port must have a unique name. When ports is empty, it indicates that there are no defined ports. When a port is defined with a nil port value, it indicates "all ports". Each slice may include a maximum of 100 ports.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointSlice#ports
   */
  readonly ports?: EndpointPortV1Beta1[];
}
/**
 * Converts an object of type 'KubeEndpointSliceV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeEndpointSliceV1Beta1Props(
  obj: KubeEndpointSliceV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * EndpointSliceList represents a list of endpoint slices
 *
 * @schema io.k8s.api.discovery.v1beta1.EndpointSliceList
 */
export interface KubeEndpointSliceListV1Beta1Props {
  /**
   * List of endpoint slices
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointSliceList#items
   */
  readonly items: KubeEndpointSliceV1Beta1Props[];
  /**
   * Standard list metadata.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointSliceList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeEndpointSliceListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeEndpointSliceListV1Beta1Props(
  obj: KubeEndpointSliceListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * Event is a report of an event somewhere in the cluster. It generally denotes some state change in the system. Events have a limited retention time and triggers and messages may evolve with time.  Event consumers should not rely on the timing of an event with a given Reason reflecting a consistent underlying trigger, or the continued existence of events with that Reason.  Events should be treated as informative, best-effort, supplemental data.
 *
 * @schema io.k8s.api.events.v1beta1.Event
 */
export interface KubeEventV1Beta1Props {
  /**
   * action is what action was taken/failed regarding to the regarding object. It is machine-readable. This field can have at most 128 characters.
   *
   * @schema io.k8s.api.events.v1beta1.Event#action
   */
  readonly action?: string;
  /**
   * deprecatedCount is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1beta1.Event#deprecatedCount
   */
  readonly deprecatedCount?: number;
  /**
   * deprecatedFirstTimestamp is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1beta1.Event#deprecatedFirstTimestamp
   */
  readonly deprecatedFirstTimestamp?: Date;
  /**
   * deprecatedLastTimestamp is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1beta1.Event#deprecatedLastTimestamp
   */
  readonly deprecatedLastTimestamp?: Date;
  /**
   * deprecatedSource is the deprecated field assuring backward compatibility with core.v1 Event type.
   *
   * @schema io.k8s.api.events.v1beta1.Event#deprecatedSource
   */
  readonly deprecatedSource?: EventSource;
  /**
   * eventTime is the time when this Event was first observed. It is required.
   *
   * @schema io.k8s.api.events.v1beta1.Event#eventTime
   */
  readonly eventTime: Date;
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.events.v1beta1.Event#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * note is a human-readable description of the status of this operation. Maximal length of the note is 1kB, but libraries should be prepared to handle values up to 64kB.
   *
   * @schema io.k8s.api.events.v1beta1.Event#note
   */
  readonly note?: string;
  /**
   * reason is why the action was taken. It is human-readable. This field can have at most 128 characters.
   *
   * @schema io.k8s.api.events.v1beta1.Event#reason
   */
  readonly reason?: string;
  /**
   * regarding contains the object this Event is about. In most cases it's an Object reporting controller implements, e.g. ReplicaSetController implements ReplicaSets and this event is emitted because it acts on some changes in a ReplicaSet object.
   *
   * @schema io.k8s.api.events.v1beta1.Event#regarding
   */
  readonly regarding?: ObjectReference;
  /**
   * related is the optional secondary object for more complex actions. E.g. when regarding object triggers a creation or deletion of related object.
   *
   * @schema io.k8s.api.events.v1beta1.Event#related
   */
  readonly related?: ObjectReference;
  /**
   * reportingController is the name of the controller that emitted this Event, e.g. `kubernetes.io/kubelet`. This field cannot be empty for new Events.
   *
   * @schema io.k8s.api.events.v1beta1.Event#reportingController
   */
  readonly reportingController?: string;
  /**
   * reportingInstance is the ID of the controller instance, e.g. `kubelet-xyzf`. This field cannot be empty for new Events and it can have at most 128 characters.
   *
   * @schema io.k8s.api.events.v1beta1.Event#reportingInstance
   */
  readonly reportingInstance?: string;
  /**
   * series is data about the Event series this event represents or nil if it's a singleton Event.
   *
   * @schema io.k8s.api.events.v1beta1.Event#series
   */
  readonly series?: EventSeriesV1Beta1;
  /**
   * type is the type of this event (Normal, Warning), new types could be added in the future. It is machine-readable.
   *
   * @schema io.k8s.api.events.v1beta1.Event#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'KubeEventV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeEventV1Beta1Props(
  obj: KubeEventV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * EventList is a list of Event objects.
 *
 * @schema io.k8s.api.events.v1beta1.EventList
 */
export interface KubeEventListV1Beta1Props {
  /**
   * items is a list of schema objects.
   *
   * @schema io.k8s.api.events.v1beta1.EventList#items
   */
  readonly items: KubeEventV1Beta1Props[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.events.v1beta1.EventList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeEventListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeEventListV1Beta1Props(
  obj: KubeEventListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * FlowSchema defines the schema of a group of flows. Note that a flow is made up of a set of inbound API requests with similar attributes and is identified by a pair of strings: the name of the FlowSchema and a "flow distinguisher".
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchema
 */
export interface KubeFlowSchemaV1Beta1Props {
  /**
   * `metadata` is the standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchema#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * `spec` is the specification of the desired behavior of a FlowSchema. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchema#spec
   */
  readonly spec?: FlowSchemaSpecV1Beta1;
}
/**
 * Converts an object of type 'KubeFlowSchemaV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeFlowSchemaV1Beta1Props(
  obj: KubeFlowSchemaV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * FlowSchemaList is a list of FlowSchema objects.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaList
 */
export interface KubeFlowSchemaListV1Beta1Props {
  /**
   * `items` is a list of FlowSchemas.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaList#items
   */
  readonly items: KubeFlowSchemaV1Beta1Props[];
  /**
   * `metadata` is the standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeFlowSchemaListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeFlowSchemaListV1Beta1Props(
  obj: KubeFlowSchemaListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * PriorityLevelConfiguration represents the configuration of a priority level.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfiguration
 */
export interface KubePriorityLevelConfigurationV1Beta1Props {
  /**
   * `metadata` is the standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfiguration#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * `spec` is the specification of the desired behavior of a "request-priority". More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfiguration#spec
   */
  readonly spec?: PriorityLevelConfigurationSpecV1Beta1;
}
/**
 * Converts an object of type 'KubePriorityLevelConfigurationV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubePriorityLevelConfigurationV1Beta1Props(
  obj: KubePriorityLevelConfigurationV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * PriorityLevelConfigurationList is a list of PriorityLevelConfiguration objects.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationList
 */
export interface KubePriorityLevelConfigurationListV1Beta1Props {
  /**
   * `items` is a list of request-priorities.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationList#items
   */
  readonly items: KubePriorityLevelConfigurationV1Beta1Props[];
  /**
   * `metadata` is the standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePriorityLevelConfigurationListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubePriorityLevelConfigurationListV1Beta1Props(
  obj: KubePriorityLevelConfigurationListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * Ingress is a collection of rules that allow inbound connections to reach the endpoints defined by a backend. An Ingress can be configured to give services externally-reachable urls, load balance traffic, terminate SSL, offer name based virtual hosting etc.
 *
 * @schema io.k8s.api.networking.v1.Ingress
 */
export interface KubeIngressProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.networking.v1.Ingress#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec is the desired state of the Ingress. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.networking.v1.Ingress#spec
   */
  readonly spec?: IngressSpec;
}
/**
 * Converts an object of type 'KubeIngressProps' to JSON representation.
 */
export declare function toJson_KubeIngressProps(
  obj: KubeIngressProps | undefined,
): Record<string, any> | undefined;
/**
 * IngressClass represents the class of the Ingress, referenced by the Ingress Spec. The `ingressclass.kubernetes.io/is-default-class` annotation can be used to indicate that an IngressClass should be considered default. When a single IngressClass resource has this annotation set to true, new Ingress resources without a class specified will be assigned this default class.
 *
 * @schema io.k8s.api.networking.v1.IngressClass
 */
export interface KubeIngressClassProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.networking.v1.IngressClass#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec is the desired state of the IngressClass. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.networking.v1.IngressClass#spec
   */
  readonly spec?: IngressClassSpec;
}
/**
 * Converts an object of type 'KubeIngressClassProps' to JSON representation.
 */
export declare function toJson_KubeIngressClassProps(
  obj: KubeIngressClassProps | undefined,
): Record<string, any> | undefined;
/**
 * IngressClassList is a collection of IngressClasses.
 *
 * @schema io.k8s.api.networking.v1.IngressClassList
 */
export interface KubeIngressClassListProps {
  /**
   * Items is the list of IngressClasses.
   *
   * @schema io.k8s.api.networking.v1.IngressClassList#items
   */
  readonly items: KubeIngressClassProps[];
  /**
   * Standard list metadata.
   *
   * @schema io.k8s.api.networking.v1.IngressClassList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeIngressClassListProps' to JSON representation.
 */
export declare function toJson_KubeIngressClassListProps(
  obj: KubeIngressClassListProps | undefined,
): Record<string, any> | undefined;
/**
 * IngressList is a collection of Ingress.
 *
 * @schema io.k8s.api.networking.v1.IngressList
 */
export interface KubeIngressListProps {
  /**
   * Items is the list of Ingress.
   *
   * @schema io.k8s.api.networking.v1.IngressList#items
   */
  readonly items: KubeIngressProps[];
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.networking.v1.IngressList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeIngressListProps' to JSON representation.
 */
export declare function toJson_KubeIngressListProps(
  obj: KubeIngressListProps | undefined,
): Record<string, any> | undefined;
/**
 * NetworkPolicy describes what network traffic is allowed for a set of Pods
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicy
 */
export interface KubeNetworkPolicyProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicy#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior for this NetworkPolicy.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicy#spec
   */
  readonly spec?: NetworkPolicySpec;
}
/**
 * Converts an object of type 'KubeNetworkPolicyProps' to JSON representation.
 */
export declare function toJson_KubeNetworkPolicyProps(
  obj: KubeNetworkPolicyProps | undefined,
): Record<string, any> | undefined;
/**
 * NetworkPolicyList is a list of NetworkPolicy objects.
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicyList
 */
export interface KubeNetworkPolicyListProps {
  /**
   * Items is a list of schema objects.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyList#items
   */
  readonly items: KubeNetworkPolicyProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeNetworkPolicyListProps' to JSON representation.
 */
export declare function toJson_KubeNetworkPolicyListProps(
  obj: KubeNetworkPolicyListProps | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClass defines a class of container runtime supported in the cluster. The RuntimeClass is used to determine which container runtime is used to run all containers in a pod. RuntimeClasses are manually defined by a user or cluster provisioner, and referenced in the PodSpec. The Kubelet is responsible for resolving the RuntimeClassName reference before running the pod.  For more details, see https://kubernetes.io/docs/concepts/containers/runtime-class/
 *
 * @schema io.k8s.api.node.v1.RuntimeClass
 */
export interface KubeRuntimeClassProps {
  /**
   * Handler specifies the underlying runtime and configuration that the CRI implementation will use to handle pods of this class. The possible values are specific to the node & CRI configuration.  It is assumed that all handlers are available on every node, and handlers of the same name are equivalent on every node. For example, a handler called "runc" might specify that the runc OCI runtime (using native Linux containers) will be used to run the containers in a pod. The Handler must be lowercase, conform to the DNS Label (RFC 1123) requirements, and is immutable.
   *
   * @schema io.k8s.api.node.v1.RuntimeClass#handler
   */
  readonly handler: string;
  /**
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.node.v1.RuntimeClass#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Overhead represents the resource overhead associated with running a pod for a given RuntimeClass. For more details, see
   * https://kubernetes.io/docs/concepts/scheduling-eviction/pod-overhead/
   * This field is in beta starting v1.18 and is only honored by servers that enable the PodOverhead feature.
   *
   * @schema io.k8s.api.node.v1.RuntimeClass#overhead
   */
  readonly overhead?: Overhead;
  /**
   * Scheduling holds the scheduling constraints to ensure that pods running with this RuntimeClass are scheduled to nodes that support it. If scheduling is nil, this RuntimeClass is assumed to be supported by all nodes.
   *
   * @schema io.k8s.api.node.v1.RuntimeClass#scheduling
   */
  readonly scheduling?: Scheduling;
}
/**
 * Converts an object of type 'KubeRuntimeClassProps' to JSON representation.
 */
export declare function toJson_KubeRuntimeClassProps(
  obj: KubeRuntimeClassProps | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClassList is a list of RuntimeClass objects.
 *
 * @schema io.k8s.api.node.v1.RuntimeClassList
 */
export interface KubeRuntimeClassListProps {
  /**
   * Items is a list of schema objects.
   *
   * @schema io.k8s.api.node.v1.RuntimeClassList#items
   */
  readonly items: KubeRuntimeClassProps[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.node.v1.RuntimeClassList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeRuntimeClassListProps' to JSON representation.
 */
export declare function toJson_KubeRuntimeClassListProps(
  obj: KubeRuntimeClassListProps | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClass defines a class of container runtime supported in the cluster. The RuntimeClass is used to determine which container runtime is used to run all containers in a pod. RuntimeClasses are (currently) manually defined by a user or cluster provisioner, and referenced in the PodSpec. The Kubelet is responsible for resolving the RuntimeClassName reference before running the pod.  For more details, see https://git.k8s.io/enhancements/keps/sig-node/585-runtime-class
 *
 * @schema io.k8s.api.node.v1alpha1.RuntimeClass
 */
export interface KubeRuntimeClassV1Alpha1Props {
  /**
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.node.v1alpha1.RuntimeClass#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the RuntimeClass More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.node.v1alpha1.RuntimeClass#spec
   */
  readonly spec: RuntimeClassSpecV1Alpha1;
}
/**
 * Converts an object of type 'KubeRuntimeClassV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeRuntimeClassV1Alpha1Props(
  obj: KubeRuntimeClassV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClassList is a list of RuntimeClass objects.
 *
 * @schema io.k8s.api.node.v1alpha1.RuntimeClassList
 */
export interface KubeRuntimeClassListV1Alpha1Props {
  /**
   * Items is a list of schema objects.
   *
   * @schema io.k8s.api.node.v1alpha1.RuntimeClassList#items
   */
  readonly items: KubeRuntimeClassV1Alpha1Props[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.node.v1alpha1.RuntimeClassList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeRuntimeClassListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeRuntimeClassListV1Alpha1Props(
  obj: KubeRuntimeClassListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClass defines a class of container runtime supported in the cluster. The RuntimeClass is used to determine which container runtime is used to run all containers in a pod. RuntimeClasses are (currently) manually defined by a user or cluster provisioner, and referenced in the PodSpec. The Kubelet is responsible for resolving the RuntimeClassName reference before running the pod.  For more details, see https://git.k8s.io/enhancements/keps/sig-node/585-runtime-class
 *
 * @schema io.k8s.api.node.v1beta1.RuntimeClass
 */
export interface KubeRuntimeClassV1Beta1Props {
  /**
   * Handler specifies the underlying runtime and configuration that the CRI implementation will use to handle pods of this class. The possible values are specific to the node & CRI configuration.  It is assumed that all handlers are available on every node, and handlers of the same name are equivalent on every node. For example, a handler called "runc" might specify that the runc OCI runtime (using native Linux containers) will be used to run the containers in a pod. The Handler must be lowercase, conform to the DNS Label (RFC 1123) requirements, and is immutable.
   *
   * @schema io.k8s.api.node.v1beta1.RuntimeClass#handler
   */
  readonly handler: string;
  /**
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.node.v1beta1.RuntimeClass#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Overhead represents the resource overhead associated with running a pod for a given RuntimeClass. For more details, see https://git.k8s.io/enhancements/keps/sig-node/688-pod-overhead/README.md This field is beta-level as of Kubernetes v1.18, and is only honored by servers that enable the PodOverhead feature.
   *
   * @schema io.k8s.api.node.v1beta1.RuntimeClass#overhead
   */
  readonly overhead?: OverheadV1Beta1;
  /**
   * Scheduling holds the scheduling constraints to ensure that pods running with this RuntimeClass are scheduled to nodes that support it. If scheduling is nil, this RuntimeClass is assumed to be supported by all nodes.
   *
   * @schema io.k8s.api.node.v1beta1.RuntimeClass#scheduling
   */
  readonly scheduling?: SchedulingV1Beta1;
}
/**
 * Converts an object of type 'KubeRuntimeClassV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeRuntimeClassV1Beta1Props(
  obj: KubeRuntimeClassV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClassList is a list of RuntimeClass objects.
 *
 * @schema io.k8s.api.node.v1beta1.RuntimeClassList
 */
export interface KubeRuntimeClassListV1Beta1Props {
  /**
   * Items is a list of schema objects.
   *
   * @schema io.k8s.api.node.v1beta1.RuntimeClassList#items
   */
  readonly items: KubeRuntimeClassV1Beta1Props[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.node.v1beta1.RuntimeClassList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeRuntimeClassListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeRuntimeClassListV1Beta1Props(
  obj: KubeRuntimeClassListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * Eviction evicts a pod from its node subject to certain policies and safety constraints. This is a subresource of Pod.  A request to cause such an eviction is created by POSTing to .../pods/<pod name>/evictions.
 *
 * @schema io.k8s.api.policy.v1.Eviction
 */
export interface KubeEvictionProps {
  /**
   * DeleteOptions may be provided
   *
   * @schema io.k8s.api.policy.v1.Eviction#deleteOptions
   */
  readonly deleteOptions?: DeleteOptions;
  /**
   * ObjectMeta describes the pod that is being evicted.
   *
   * @schema io.k8s.api.policy.v1.Eviction#metadata
   */
  readonly metadata?: ObjectMeta;
}
/**
 * Converts an object of type 'KubeEvictionProps' to JSON representation.
 */
export declare function toJson_KubeEvictionProps(
  obj: KubeEvictionProps | undefined,
): Record<string, any> | undefined;
/**
 * PodDisruptionBudget is an object to define the max disruption that can be caused to a collection of pods
 *
 * @schema io.k8s.api.policy.v1.PodDisruptionBudget
 */
export interface KubePodDisruptionBudgetProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.policy.v1.PodDisruptionBudget#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of the PodDisruptionBudget.
   *
   * @schema io.k8s.api.policy.v1.PodDisruptionBudget#spec
   */
  readonly spec?: PodDisruptionBudgetSpec;
}
/**
 * Converts an object of type 'KubePodDisruptionBudgetProps' to JSON representation.
 */
export declare function toJson_KubePodDisruptionBudgetProps(
  obj: KubePodDisruptionBudgetProps | undefined,
): Record<string, any> | undefined;
/**
 * PodDisruptionBudgetList is a collection of PodDisruptionBudgets.
 *
 * @schema io.k8s.api.policy.v1.PodDisruptionBudgetList
 */
export interface KubePodDisruptionBudgetListProps {
  /**
   * Items is a list of PodDisruptionBudgets
   *
   * @schema io.k8s.api.policy.v1.PodDisruptionBudgetList#items
   */
  readonly items: KubePodDisruptionBudgetProps[];
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.policy.v1.PodDisruptionBudgetList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePodDisruptionBudgetListProps' to JSON representation.
 */
export declare function toJson_KubePodDisruptionBudgetListProps(
  obj: KubePodDisruptionBudgetListProps | undefined,
): Record<string, any> | undefined;
/**
 * PodDisruptionBudget is an object to define the max disruption that can be caused to a collection of pods
 *
 * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudget
 */
export interface KubePodDisruptionBudgetV1Beta1Props {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudget#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of the PodDisruptionBudget.
   *
   * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudget#spec
   */
  readonly spec?: PodDisruptionBudgetSpecV1Beta1;
}
/**
 * Converts an object of type 'KubePodDisruptionBudgetV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubePodDisruptionBudgetV1Beta1Props(
  obj: KubePodDisruptionBudgetV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * PodDisruptionBudgetList is a collection of PodDisruptionBudgets.
 *
 * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetList
 */
export interface KubePodDisruptionBudgetListV1Beta1Props {
  /**
   * items list individual PodDisruptionBudget objects
   *
   * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetList#items
   */
  readonly items: KubePodDisruptionBudgetV1Beta1Props[];
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePodDisruptionBudgetListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubePodDisruptionBudgetListV1Beta1Props(
  obj: KubePodDisruptionBudgetListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * PodSecurityPolicy governs the ability to make requests that affect the Security Context that will be applied to a pod and container. Deprecated in 1.21.
 *
 * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicy
 */
export interface KubePodSecurityPolicyV1Beta1Props {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicy#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * spec defines the policy enforced.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicy#spec
   */
  readonly spec?: PodSecurityPolicySpecV1Beta1;
}
/**
 * Converts an object of type 'KubePodSecurityPolicyV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubePodSecurityPolicyV1Beta1Props(
  obj: KubePodSecurityPolicyV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * PodSecurityPolicyList is a list of PodSecurityPolicy objects.
 *
 * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicyList
 */
export interface KubePodSecurityPolicyListV1Beta1Props {
  /**
   * items is a list of schema objects.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicyList#items
   */
  readonly items: KubePodSecurityPolicyV1Beta1Props[];
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicyList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePodSecurityPolicyListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubePodSecurityPolicyListV1Beta1Props(
  obj: KubePodSecurityPolicyListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRole is a cluster level, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding or ClusterRoleBinding.
 *
 * @schema io.k8s.api.rbac.v1.ClusterRole
 */
export interface KubeClusterRoleProps {
  /**
   * AggregationRule is an optional field that describes how to build the Rules for this ClusterRole. If AggregationRule is set, then the Rules are controller managed and direct changes to Rules will be stomped by the controller.
   *
   * @schema io.k8s.api.rbac.v1.ClusterRole#aggregationRule
   */
  readonly aggregationRule?: AggregationRule;
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.ClusterRole#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Rules holds all the PolicyRules for this ClusterRole
   *
   * @schema io.k8s.api.rbac.v1.ClusterRole#rules
   */
  readonly rules?: PolicyRule[];
}
/**
 * Converts an object of type 'KubeClusterRoleProps' to JSON representation.
 */
export declare function toJson_KubeClusterRoleProps(
  obj: KubeClusterRoleProps | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRoleBinding references a ClusterRole, but not contain it.  It can reference a ClusterRole in the global namespace, and adds who information via Subject.
 *
 * @schema io.k8s.api.rbac.v1.ClusterRoleBinding
 */
export interface KubeClusterRoleBindingProps {
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.ClusterRoleBinding#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * RoleRef can only reference a ClusterRole in the global namespace. If the RoleRef cannot be resolved, the Authorizer must return an error.
   *
   * @schema io.k8s.api.rbac.v1.ClusterRoleBinding#roleRef
   */
  readonly roleRef: RoleRef;
  /**
   * Subjects holds references to the objects the role applies to.
   *
   * @schema io.k8s.api.rbac.v1.ClusterRoleBinding#subjects
   */
  readonly subjects?: Subject[];
}
/**
 * Converts an object of type 'KubeClusterRoleBindingProps' to JSON representation.
 */
export declare function toJson_KubeClusterRoleBindingProps(
  obj: KubeClusterRoleBindingProps | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRoleBindingList is a collection of ClusterRoleBindings
 *
 * @schema io.k8s.api.rbac.v1.ClusterRoleBindingList
 */
export interface KubeClusterRoleBindingListProps {
  /**
   * Items is a list of ClusterRoleBindings
   *
   * @schema io.k8s.api.rbac.v1.ClusterRoleBindingList#items
   */
  readonly items: KubeClusterRoleBindingProps[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.ClusterRoleBindingList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeClusterRoleBindingListProps' to JSON representation.
 */
export declare function toJson_KubeClusterRoleBindingListProps(
  obj: KubeClusterRoleBindingListProps | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRoleList is a collection of ClusterRoles
 *
 * @schema io.k8s.api.rbac.v1.ClusterRoleList
 */
export interface KubeClusterRoleListProps {
  /**
   * Items is a list of ClusterRoles
   *
   * @schema io.k8s.api.rbac.v1.ClusterRoleList#items
   */
  readonly items: KubeClusterRoleProps[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.ClusterRoleList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeClusterRoleListProps' to JSON representation.
 */
export declare function toJson_KubeClusterRoleListProps(
  obj: KubeClusterRoleListProps | undefined,
): Record<string, any> | undefined;
/**
 * Role is a namespaced, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding.
 *
 * @schema io.k8s.api.rbac.v1.Role
 */
export interface KubeRoleProps {
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.Role#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Rules holds all the PolicyRules for this Role
   *
   * @schema io.k8s.api.rbac.v1.Role#rules
   */
  readonly rules?: PolicyRule[];
}
/**
 * Converts an object of type 'KubeRoleProps' to JSON representation.
 */
export declare function toJson_KubeRoleProps(
  obj: KubeRoleProps | undefined,
): Record<string, any> | undefined;
/**
 * RoleBinding references a role, but does not contain it.  It can reference a Role in the same namespace or a ClusterRole in the global namespace. It adds who information via Subjects and namespace information by which namespace it exists in.  RoleBindings in a given namespace only have effect in that namespace.
 *
 * @schema io.k8s.api.rbac.v1.RoleBinding
 */
export interface KubeRoleBindingProps {
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.RoleBinding#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * RoleRef can reference a Role in the current namespace or a ClusterRole in the global namespace. If the RoleRef cannot be resolved, the Authorizer must return an error.
   *
   * @schema io.k8s.api.rbac.v1.RoleBinding#roleRef
   */
  readonly roleRef: RoleRef;
  /**
   * Subjects holds references to the objects the role applies to.
   *
   * @schema io.k8s.api.rbac.v1.RoleBinding#subjects
   */
  readonly subjects?: Subject[];
}
/**
 * Converts an object of type 'KubeRoleBindingProps' to JSON representation.
 */
export declare function toJson_KubeRoleBindingProps(
  obj: KubeRoleBindingProps | undefined,
): Record<string, any> | undefined;
/**
 * RoleBindingList is a collection of RoleBindings
 *
 * @schema io.k8s.api.rbac.v1.RoleBindingList
 */
export interface KubeRoleBindingListProps {
  /**
   * Items is a list of RoleBindings
   *
   * @schema io.k8s.api.rbac.v1.RoleBindingList#items
   */
  readonly items: KubeRoleBindingProps[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.RoleBindingList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeRoleBindingListProps' to JSON representation.
 */
export declare function toJson_KubeRoleBindingListProps(
  obj: KubeRoleBindingListProps | undefined,
): Record<string, any> | undefined;
/**
 * RoleList is a collection of Roles
 *
 * @schema io.k8s.api.rbac.v1.RoleList
 */
export interface KubeRoleListProps {
  /**
   * Items is a list of Roles
   *
   * @schema io.k8s.api.rbac.v1.RoleList#items
   */
  readonly items: KubeRoleProps[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1.RoleList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeRoleListProps' to JSON representation.
 */
export declare function toJson_KubeRoleListProps(
  obj: KubeRoleListProps | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRole is a cluster level, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding or ClusterRoleBinding. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRole, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRole
 */
export interface KubeClusterRoleV1Alpha1Props {
  /**
   * AggregationRule is an optional field that describes how to build the Rules for this ClusterRole. If AggregationRule is set, then the Rules are controller managed and direct changes to Rules will be stomped by the controller.
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRole#aggregationRule
   */
  readonly aggregationRule?: AggregationRuleV1Alpha1;
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRole#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Rules holds all the PolicyRules for this ClusterRole
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRole#rules
   */
  readonly rules?: PolicyRuleV1Alpha1[];
}
/**
 * Converts an object of type 'KubeClusterRoleV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeClusterRoleV1Alpha1Props(
  obj: KubeClusterRoleV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRoleBinding references a ClusterRole, but not contain it.  It can reference a ClusterRole in the global namespace, and adds who information via Subject. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRoleBinding, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBinding
 */
export interface KubeClusterRoleBindingV1Alpha1Props {
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBinding#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * RoleRef can only reference a ClusterRole in the global namespace. If the RoleRef cannot be resolved, the Authorizer must return an error.
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBinding#roleRef
   */
  readonly roleRef: RoleRefV1Alpha1;
  /**
   * Subjects holds references to the objects the role applies to.
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBinding#subjects
   */
  readonly subjects?: SubjectV1Alpha1[];
}
/**
 * Converts an object of type 'KubeClusterRoleBindingV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeClusterRoleBindingV1Alpha1Props(
  obj: KubeClusterRoleBindingV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRoleBindingList is a collection of ClusterRoleBindings. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRoleBindings, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBindingList
 */
export interface KubeClusterRoleBindingListV1Alpha1Props {
  /**
   * Items is a list of ClusterRoleBindings
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBindingList#items
   */
  readonly items: KubeClusterRoleBindingV1Alpha1Props[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleBindingList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeClusterRoleBindingListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeClusterRoleBindingListV1Alpha1Props(
  obj: KubeClusterRoleBindingListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * ClusterRoleList is a collection of ClusterRoles. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 ClusterRoles, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleList
 */
export interface KubeClusterRoleListV1Alpha1Props {
  /**
   * Items is a list of ClusterRoles
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleList#items
   */
  readonly items: KubeClusterRoleV1Alpha1Props[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.ClusterRoleList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeClusterRoleListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeClusterRoleListV1Alpha1Props(
  obj: KubeClusterRoleListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * Role is a namespaced, logical grouping of PolicyRules that can be referenced as a unit by a RoleBinding. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 Role, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.Role
 */
export interface KubeRoleV1Alpha1Props {
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.Role#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Rules holds all the PolicyRules for this Role
   *
   * @schema io.k8s.api.rbac.v1alpha1.Role#rules
   */
  readonly rules?: PolicyRuleV1Alpha1[];
}
/**
 * Converts an object of type 'KubeRoleV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeRoleV1Alpha1Props(
  obj: KubeRoleV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * RoleBinding references a role, but does not contain it.  It can reference a Role in the same namespace or a ClusterRole in the global namespace. It adds who information via Subjects and namespace information by which namespace it exists in.  RoleBindings in a given namespace only have effect in that namespace. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 RoleBinding, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.RoleBinding
 */
export interface KubeRoleBindingV1Alpha1Props {
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleBinding#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * RoleRef can reference a Role in the current namespace or a ClusterRole in the global namespace. If the RoleRef cannot be resolved, the Authorizer must return an error.
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleBinding#roleRef
   */
  readonly roleRef: RoleRefV1Alpha1;
  /**
   * Subjects holds references to the objects the role applies to.
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleBinding#subjects
   */
  readonly subjects?: SubjectV1Alpha1[];
}
/**
 * Converts an object of type 'KubeRoleBindingV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeRoleBindingV1Alpha1Props(
  obj: KubeRoleBindingV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * RoleBindingList is a collection of RoleBindings Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 RoleBindingList, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.RoleBindingList
 */
export interface KubeRoleBindingListV1Alpha1Props {
  /**
   * Items is a list of RoleBindings
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleBindingList#items
   */
  readonly items: KubeRoleBindingV1Alpha1Props[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleBindingList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeRoleBindingListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeRoleBindingListV1Alpha1Props(
  obj: KubeRoleBindingListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * RoleList is a collection of Roles. Deprecated in v1.17 in favor of rbac.authorization.k8s.io/v1 RoleList, and will no longer be served in v1.22.
 *
 * @schema io.k8s.api.rbac.v1alpha1.RoleList
 */
export interface KubeRoleListV1Alpha1Props {
  /**
   * Items is a list of Roles
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleList#items
   */
  readonly items: KubeRoleV1Alpha1Props[];
  /**
   * Standard object's metadata.
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeRoleListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeRoleListV1Alpha1Props(
  obj: KubeRoleListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * PriorityClass defines mapping from a priority class name to the priority integer value. The value can be any valid integer.
 *
 * @schema io.k8s.api.scheduling.v1.PriorityClass
 */
export interface KubePriorityClassProps {
  /**
   * description is an arbitrary string that usually provides guidelines on when this priority class should be used.
   *
   * @schema io.k8s.api.scheduling.v1.PriorityClass#description
   */
  readonly description?: string;
  /**
   * globalDefault specifies whether this PriorityClass should be considered as the default priority for pods that do not have any priority class. Only one PriorityClass can be marked as `globalDefault`. However, if more than one PriorityClasses exists with their `globalDefault` field set to true, the smallest value of such global default PriorityClasses will be used as the default priority.
   *
   * @schema io.k8s.api.scheduling.v1.PriorityClass#globalDefault
   */
  readonly globalDefault?: boolean;
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.scheduling.v1.PriorityClass#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * PreemptionPolicy is the Policy for preempting pods with lower priority. One of Never, PreemptLowerPriority. Defaults to PreemptLowerPriority if unset. This field is beta-level, gated by the NonPreemptingPriority feature-gate.
   *
   * @default PreemptLowerPriority if unset. This field is beta-level, gated by the NonPreemptingPriority feature-gate.
   * @schema io.k8s.api.scheduling.v1.PriorityClass#preemptionPolicy
   */
  readonly preemptionPolicy?: string;
  /**
   * The value of this priority class. This is the actual priority that pods receive when they have the name of this class in their pod spec.
   *
   * @schema io.k8s.api.scheduling.v1.PriorityClass#value
   */
  readonly value: number;
}
/**
 * Converts an object of type 'KubePriorityClassProps' to JSON representation.
 */
export declare function toJson_KubePriorityClassProps(
  obj: KubePriorityClassProps | undefined,
): Record<string, any> | undefined;
/**
 * PriorityClassList is a collection of priority classes.
 *
 * @schema io.k8s.api.scheduling.v1.PriorityClassList
 */
export interface KubePriorityClassListProps {
  /**
   * items is the list of PriorityClasses
   *
   * @schema io.k8s.api.scheduling.v1.PriorityClassList#items
   */
  readonly items: KubePriorityClassProps[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.scheduling.v1.PriorityClassList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePriorityClassListProps' to JSON representation.
 */
export declare function toJson_KubePriorityClassListProps(
  obj: KubePriorityClassListProps | undefined,
): Record<string, any> | undefined;
/**
 * DEPRECATED - This group version of PriorityClass is deprecated by scheduling.k8s.io/v1/PriorityClass. PriorityClass defines mapping from a priority class name to the priority integer value. The value can be any valid integer.
 *
 * @schema io.k8s.api.scheduling.v1alpha1.PriorityClass
 */
export interface KubePriorityClassV1Alpha1Props {
  /**
   * description is an arbitrary string that usually provides guidelines on when this priority class should be used.
   *
   * @schema io.k8s.api.scheduling.v1alpha1.PriorityClass#description
   */
  readonly description?: string;
  /**
   * globalDefault specifies whether this PriorityClass should be considered as the default priority for pods that do not have any priority class. Only one PriorityClass can be marked as `globalDefault`. However, if more than one PriorityClasses exists with their `globalDefault` field set to true, the smallest value of such global default PriorityClasses will be used as the default priority.
   *
   * @schema io.k8s.api.scheduling.v1alpha1.PriorityClass#globalDefault
   */
  readonly globalDefault?: boolean;
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.scheduling.v1alpha1.PriorityClass#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * PreemptionPolicy is the Policy for preempting pods with lower priority. One of Never, PreemptLowerPriority. Defaults to PreemptLowerPriority if unset. This field is beta-level, gated by the NonPreemptingPriority feature-gate.
   *
   * @default PreemptLowerPriority if unset. This field is beta-level, gated by the NonPreemptingPriority feature-gate.
   * @schema io.k8s.api.scheduling.v1alpha1.PriorityClass#preemptionPolicy
   */
  readonly preemptionPolicy?: string;
  /**
   * The value of this priority class. This is the actual priority that pods receive when they have the name of this class in their pod spec.
   *
   * @schema io.k8s.api.scheduling.v1alpha1.PriorityClass#value
   */
  readonly value: number;
}
/**
 * Converts an object of type 'KubePriorityClassV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubePriorityClassV1Alpha1Props(
  obj: KubePriorityClassV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * PriorityClassList is a collection of priority classes.
 *
 * @schema io.k8s.api.scheduling.v1alpha1.PriorityClassList
 */
export interface KubePriorityClassListV1Alpha1Props {
  /**
   * items is the list of PriorityClasses
   *
   * @schema io.k8s.api.scheduling.v1alpha1.PriorityClassList#items
   */
  readonly items: KubePriorityClassV1Alpha1Props[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.scheduling.v1alpha1.PriorityClassList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubePriorityClassListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubePriorityClassListV1Alpha1Props(
  obj: KubePriorityClassListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * CSIDriver captures information about a Container Storage Interface (CSI) volume driver deployed on the cluster. Kubernetes attach detach controller uses this object to determine whether attach is required. Kubelet uses this object to determine whether pod information needs to be passed on mount. CSIDriver objects are non-namespaced.
 *
 * @schema io.k8s.api.storage.v1.CSIDriver
 */
export interface KubeCsiDriverProps {
  /**
   * Standard object metadata. metadata.Name indicates the name of the CSI driver that this object refers to; it MUST be the same name returned by the CSI GetPluginName() call for that driver. The driver name must be 63 characters or less, beginning and ending with an alphanumeric character ([a-z0-9A-Z]) with dashes (-), dots (.), and alphanumerics between. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1.CSIDriver#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the CSI Driver.
   *
   * @schema io.k8s.api.storage.v1.CSIDriver#spec
   */
  readonly spec: CsiDriverSpec;
}
/**
 * Converts an object of type 'KubeCsiDriverProps' to JSON representation.
 */
export declare function toJson_KubeCsiDriverProps(
  obj: KubeCsiDriverProps | undefined,
): Record<string, any> | undefined;
/**
 * CSIDriverList is a collection of CSIDriver objects.
 *
 * @schema io.k8s.api.storage.v1.CSIDriverList
 */
export interface KubeCsiDriverListProps {
  /**
   * items is the list of CSIDriver
   *
   * @schema io.k8s.api.storage.v1.CSIDriverList#items
   */
  readonly items: KubeCsiDriverProps[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1.CSIDriverList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCsiDriverListProps' to JSON representation.
 */
export declare function toJson_KubeCsiDriverListProps(
  obj: KubeCsiDriverListProps | undefined,
): Record<string, any> | undefined;
/**
 * CSINode holds information about all CSI drivers installed on a node. CSI drivers do not need to create the CSINode object directly. As long as they use the node-driver-registrar sidecar container, the kubelet will automatically populate the CSINode object for the CSI driver as part of kubelet plugin registration. CSINode has the same name as a node. If the object is missing, it means either there are no CSI Drivers available on the node, or the Kubelet version is low enough that it doesn't create this object. CSINode has an OwnerReference that points to the corresponding node object.
 *
 * @schema io.k8s.api.storage.v1.CSINode
 */
export interface KubeCsiNodeProps {
  /**
   * metadata.name must be the Kubernetes node name.
   *
   * @schema io.k8s.api.storage.v1.CSINode#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * spec is the specification of CSINode
   *
   * @schema io.k8s.api.storage.v1.CSINode#spec
   */
  readonly spec: CsiNodeSpec;
}
/**
 * Converts an object of type 'KubeCsiNodeProps' to JSON representation.
 */
export declare function toJson_KubeCsiNodeProps(
  obj: KubeCsiNodeProps | undefined,
): Record<string, any> | undefined;
/**
 * CSINodeList is a collection of CSINode objects.
 *
 * @schema io.k8s.api.storage.v1.CSINodeList
 */
export interface KubeCsiNodeListProps {
  /**
   * items is the list of CSINode
   *
   * @schema io.k8s.api.storage.v1.CSINodeList#items
   */
  readonly items: KubeCsiNodeProps[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1.CSINodeList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCsiNodeListProps' to JSON representation.
 */
export declare function toJson_KubeCsiNodeListProps(
  obj: KubeCsiNodeListProps | undefined,
): Record<string, any> | undefined;
/**
 * StorageClass describes the parameters for a class of storage for which PersistentVolumes can be dynamically provisioned.
 *
 * StorageClasses are non-namespaced; the name of the storage class according to etcd is in ObjectMeta.Name.
 *
 * @schema io.k8s.api.storage.v1.StorageClass
 */
export interface KubeStorageClassProps {
  /**
   * AllowVolumeExpansion shows whether the storage class allow volume expand
   *
   * @schema io.k8s.api.storage.v1.StorageClass#allowVolumeExpansion
   */
  readonly allowVolumeExpansion?: boolean;
  /**
   * Restrict the node topologies where volumes can be dynamically provisioned. Each volume plugin defines its own supported topology specifications. An empty TopologySelectorTerm list means there is no topology restriction. This field is only honored by servers that enable the VolumeScheduling feature.
   *
   * @schema io.k8s.api.storage.v1.StorageClass#allowedTopologies
   */
  readonly allowedTopologies?: TopologySelectorTerm[];
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1.StorageClass#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Dynamically provisioned PersistentVolumes of this storage class are created with these mountOptions, e.g. ["ro", "soft"]. Not validated - mount of the PVs will simply fail if one is invalid.
   *
   * @schema io.k8s.api.storage.v1.StorageClass#mountOptions
   */
  readonly mountOptions?: string[];
  /**
   * Parameters holds the parameters for the provisioner that should create volumes of this storage class.
   *
   * @schema io.k8s.api.storage.v1.StorageClass#parameters
   */
  readonly parameters?: {
    [key: string]: string;
  };
  /**
   * Provisioner indicates the type of the provisioner.
   *
   * @schema io.k8s.api.storage.v1.StorageClass#provisioner
   */
  readonly provisioner: string;
  /**
   * Dynamically provisioned PersistentVolumes of this storage class are created with this reclaimPolicy. Defaults to Delete.
   *
   * @default Delete.
   * @schema io.k8s.api.storage.v1.StorageClass#reclaimPolicy
   */
  readonly reclaimPolicy?: string;
  /**
   * VolumeBindingMode indicates how PersistentVolumeClaims should be provisioned and bound.  When unset, VolumeBindingImmediate is used. This field is only honored by servers that enable the VolumeScheduling feature.
   *
   * @schema io.k8s.api.storage.v1.StorageClass#volumeBindingMode
   */
  readonly volumeBindingMode?: string;
}
/**
 * Converts an object of type 'KubeStorageClassProps' to JSON representation.
 */
export declare function toJson_KubeStorageClassProps(
  obj: KubeStorageClassProps | undefined,
): Record<string, any> | undefined;
/**
 * StorageClassList is a collection of storage classes.
 *
 * @schema io.k8s.api.storage.v1.StorageClassList
 */
export interface KubeStorageClassListProps {
  /**
   * Items is the list of StorageClasses
   *
   * @schema io.k8s.api.storage.v1.StorageClassList#items
   */
  readonly items: KubeStorageClassProps[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1.StorageClassList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeStorageClassListProps' to JSON representation.
 */
export declare function toJson_KubeStorageClassListProps(
  obj: KubeStorageClassListProps | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachment captures the intent to attach or detach the specified volume to/from the specified node.
 *
 * VolumeAttachment objects are non-namespaced.
 *
 * @schema io.k8s.api.storage.v1.VolumeAttachment
 */
export interface KubeVolumeAttachmentProps {
  /**
   * Standard object metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachment#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired attach/detach volume behavior. Populated by the Kubernetes system.
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachment#spec
   */
  readonly spec: VolumeAttachmentSpec;
}
/**
 * Converts an object of type 'KubeVolumeAttachmentProps' to JSON representation.
 */
export declare function toJson_KubeVolumeAttachmentProps(
  obj: KubeVolumeAttachmentProps | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachmentList is a collection of VolumeAttachment objects.
 *
 * @schema io.k8s.api.storage.v1.VolumeAttachmentList
 */
export interface KubeVolumeAttachmentListProps {
  /**
   * Items is the list of VolumeAttachments
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachmentList#items
   */
  readonly items: KubeVolumeAttachmentProps[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachmentList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeVolumeAttachmentListProps' to JSON representation.
 */
export declare function toJson_KubeVolumeAttachmentListProps(
  obj: KubeVolumeAttachmentListProps | undefined,
): Record<string, any> | undefined;
/**
 * CSIStorageCapacity stores the result of one CSI GetCapacity call. For a given StorageClass, this describes the available capacity in a particular topology segment.  This can be used when considering where to instantiate new PersistentVolumes.
 *
 * For example this can express things like: - StorageClass "standard" has "1234 GiB" available in "topology.kubernetes.io/zone=us-east1" - StorageClass "localssd" has "10 GiB" available in "kubernetes.io/hostname=knode-abc123"
 *
 * The following three cases all imply that no capacity is available for a certain combination: - no object exists with suitable topology and storage class name - such an object exists, but the capacity is unset - such an object exists, but the capacity is zero
 *
 * The producer of these objects can decide which approach is more suitable.
 *
 * They are consumed by the kube-scheduler if the CSIStorageCapacity beta feature gate is enabled there and a CSI driver opts into capacity-aware scheduling with CSIDriver.StorageCapacity.
 *
 * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacity
 */
export interface KubeCsiStorageCapacityV1Alpha1Props {
  /**
   * Capacity is the value reported by the CSI driver in its GetCapacityResponse for a GetCapacityRequest with topology and parameters that match the previous fields.
   *
   * The semantic is currently (CSI spec 1.2) defined as: The available capacity, in bytes, of the storage that can be used to provision volumes. If not set, that information is currently unavailable and treated like zero capacity.
   *
   * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacity#capacity
   */
  readonly capacity?: Quantity;
  /**
   * MaximumVolumeSize is the value reported by the CSI driver in its GetCapacityResponse for a GetCapacityRequest with topology and parameters that match the previous fields.
   *
   * This is defined since CSI spec 1.4.0 as the largest size that may be used in a CreateVolumeRequest.capacity_range.required_bytes field to create a volume with the same parameters as those in GetCapacityRequest. The corresponding value in the Kubernetes API is ResourceRequirements.Requests in a volume claim.
   *
   * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacity#maximumVolumeSize
   */
  readonly maximumVolumeSize?: Quantity;
  /**
   * Standard object's metadata. The name has no particular meaning. It must be be a DNS subdomain (dots allowed, 253 characters). To ensure that there are no conflicts with other CSI drivers on the cluster, the recommendation is to use csisc-<uuid>, a generated name, or a reverse-domain name which ends with the unique CSI driver name.
   *
   * Objects are namespaced.
   *
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacity#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * NodeTopology defines which nodes have access to the storage for which capacity was reported. If not set, the storage is not accessible from any node in the cluster. If empty, the storage is accessible from all nodes. This field is immutable.
   *
   * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacity#nodeTopology
   */
  readonly nodeTopology?: LabelSelector;
  /**
   * The name of the StorageClass that the reported capacity applies to. It must meet the same requirements as the name of a StorageClass object (non-empty, DNS subdomain). If that object no longer exists, the CSIStorageCapacity object is obsolete and should be removed by its creator. This field is immutable.
   *
   * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacity#storageClassName
   */
  readonly storageClassName: string;
}
/**
 * Converts an object of type 'KubeCsiStorageCapacityV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeCsiStorageCapacityV1Alpha1Props(
  obj: KubeCsiStorageCapacityV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * CSIStorageCapacityList is a collection of CSIStorageCapacity objects.
 *
 * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacityList
 */
export interface KubeCsiStorageCapacityListV1Alpha1Props {
  /**
   * Items is the list of CSIStorageCapacity objects.
   *
   * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacityList#items
   */
  readonly items: KubeCsiStorageCapacityV1Alpha1Props[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1alpha1.CSIStorageCapacityList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCsiStorageCapacityListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeCsiStorageCapacityListV1Alpha1Props(
  obj: KubeCsiStorageCapacityListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachment captures the intent to attach or detach the specified volume to/from the specified node.
 *
 * VolumeAttachment objects are non-namespaced.
 *
 * @schema io.k8s.api.storage.v1alpha1.VolumeAttachment
 */
export interface KubeVolumeAttachmentV1Alpha1Props {
  /**
   * Standard object metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachment#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired attach/detach volume behavior. Populated by the Kubernetes system.
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachment#spec
   */
  readonly spec: VolumeAttachmentSpecV1Alpha1;
}
/**
 * Converts an object of type 'KubeVolumeAttachmentV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeVolumeAttachmentV1Alpha1Props(
  obj: KubeVolumeAttachmentV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachmentList is a collection of VolumeAttachment objects.
 *
 * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentList
 */
export interface KubeVolumeAttachmentListV1Alpha1Props {
  /**
   * Items is the list of VolumeAttachments
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentList#items
   */
  readonly items: KubeVolumeAttachmentV1Alpha1Props[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeVolumeAttachmentListV1Alpha1Props' to JSON representation.
 */
export declare function toJson_KubeVolumeAttachmentListV1Alpha1Props(
  obj: KubeVolumeAttachmentListV1Alpha1Props | undefined,
): Record<string, any> | undefined;
/**
 * CSIStorageCapacity stores the result of one CSI GetCapacity call. For a given StorageClass, this describes the available capacity in a particular topology segment.  This can be used when considering where to instantiate new PersistentVolumes.
 *
 * For example this can express things like: - StorageClass "standard" has "1234 GiB" available in "topology.kubernetes.io/zone=us-east1" - StorageClass "localssd" has "10 GiB" available in "kubernetes.io/hostname=knode-abc123"
 *
 * The following three cases all imply that no capacity is available for a certain combination: - no object exists with suitable topology and storage class name - such an object exists, but the capacity is unset - such an object exists, but the capacity is zero
 *
 * The producer of these objects can decide which approach is more suitable.
 *
 * They are consumed by the kube-scheduler if the CSIStorageCapacity beta feature gate is enabled there and a CSI driver opts into capacity-aware scheduling with CSIDriver.StorageCapacity.
 *
 * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacity
 */
export interface KubeCsiStorageCapacityV1Beta1Props {
  /**
   * Capacity is the value reported by the CSI driver in its GetCapacityResponse for a GetCapacityRequest with topology and parameters that match the previous fields.
   *
   * The semantic is currently (CSI spec 1.2) defined as: The available capacity, in bytes, of the storage that can be used to provision volumes. If not set, that information is currently unavailable and treated like zero capacity.
   *
   * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacity#capacity
   */
  readonly capacity?: Quantity;
  /**
   * MaximumVolumeSize is the value reported by the CSI driver in its GetCapacityResponse for a GetCapacityRequest with topology and parameters that match the previous fields.
   *
   * This is defined since CSI spec 1.4.0 as the largest size that may be used in a CreateVolumeRequest.capacity_range.required_bytes field to create a volume with the same parameters as those in GetCapacityRequest. The corresponding value in the Kubernetes API is ResourceRequirements.Requests in a volume claim.
   *
   * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacity#maximumVolumeSize
   */
  readonly maximumVolumeSize?: Quantity;
  /**
   * Standard object's metadata. The name has no particular meaning. It must be be a DNS subdomain (dots allowed, 253 characters). To ensure that there are no conflicts with other CSI drivers on the cluster, the recommendation is to use csisc-<uuid>, a generated name, or a reverse-domain name which ends with the unique CSI driver name.
   *
   * Objects are namespaced.
   *
   * More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacity#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * NodeTopology defines which nodes have access to the storage for which capacity was reported. If not set, the storage is not accessible from any node in the cluster. If empty, the storage is accessible from all nodes. This field is immutable.
   *
   * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacity#nodeTopology
   */
  readonly nodeTopology?: LabelSelector;
  /**
   * The name of the StorageClass that the reported capacity applies to. It must meet the same requirements as the name of a StorageClass object (non-empty, DNS subdomain). If that object no longer exists, the CSIStorageCapacity object is obsolete and should be removed by its creator. This field is immutable.
   *
   * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacity#storageClassName
   */
  readonly storageClassName: string;
}
/**
 * Converts an object of type 'KubeCsiStorageCapacityV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeCsiStorageCapacityV1Beta1Props(
  obj: KubeCsiStorageCapacityV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * CSIStorageCapacityList is a collection of CSIStorageCapacity objects.
 *
 * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacityList
 */
export interface KubeCsiStorageCapacityListV1Beta1Props {
  /**
   * Items is the list of CSIStorageCapacity objects.
   *
   * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacityList#items
   */
  readonly items: KubeCsiStorageCapacityV1Beta1Props[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.storage.v1beta1.CSIStorageCapacityList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCsiStorageCapacityListV1Beta1Props' to JSON representation.
 */
export declare function toJson_KubeCsiStorageCapacityListV1Beta1Props(
  obj: KubeCsiStorageCapacityListV1Beta1Props | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceDefinition represents a resource that should be exposed on the API server.  Its name MUST be in the format <.spec.name>.<.spec.group>.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition
 */
export interface KubeCustomResourceDefinitionProps {
  /**
   * Standard object's metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * spec describes how the user wants the resources to appear
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinition#spec
   */
  readonly spec: CustomResourceDefinitionSpec;
}
/**
 * Converts an object of type 'KubeCustomResourceDefinitionProps' to JSON representation.
 */
export declare function toJson_KubeCustomResourceDefinitionProps(
  obj: KubeCustomResourceDefinitionProps | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceDefinitionList is a list of CustomResourceDefinition objects.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionList
 */
export interface KubeCustomResourceDefinitionListProps {
  /**
   * items list individual CustomResourceDefinition objects
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionList#items
   */
  readonly items: KubeCustomResourceDefinitionProps[];
  /**
   * Standard object's metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeCustomResourceDefinitionListProps' to JSON representation.
 */
export declare function toJson_KubeCustomResourceDefinitionListProps(
  obj: KubeCustomResourceDefinitionListProps | undefined,
): Record<string, any> | undefined;
/**
 * Status is a return value for calls that don't return other objects.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Status
 */
export interface KubeStatusProps {
  /**
   * Suggested HTTP return code for this status, 0 if not set.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Status#code
   */
  readonly code?: number;
  /**
   * Extended data associated with the reason.  Each reason may define its own extended details. This field is optional and the data returned is not guaranteed to conform to any schema except that defined by the reason type.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Status#details
   */
  readonly details?: StatusDetails;
  /**
   * A human-readable description of the status of this operation.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Status#message
   */
  readonly message?: string;
  /**
   * Standard list metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Status#metadata
   */
  readonly metadata?: ListMeta;
  /**
   * A machine-readable description of why this operation is in the "Failure" status. If this value is empty there is no information available. A Reason clarifies an HTTP status code but does not override it.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Status#reason
   */
  readonly reason?: string;
}
/**
 * Converts an object of type 'KubeStatusProps' to JSON representation.
 */
export declare function toJson_KubeStatusProps(
  obj: KubeStatusProps | undefined,
): Record<string, any> | undefined;
/**
 * APIService represents a server for a particular GroupVersion. Name must be "version.group".
 *
 * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIService
 */
export interface KubeApiServiceProps {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIService#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Spec contains information for locating and communicating with a server
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIService#spec
   */
  readonly spec?: ApiServiceSpec;
}
/**
 * Converts an object of type 'KubeApiServiceProps' to JSON representation.
 */
export declare function toJson_KubeApiServiceProps(
  obj: KubeApiServiceProps | undefined,
): Record<string, any> | undefined;
/**
 * APIServiceList is a list of APIService objects.
 *
 * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceList
 */
export interface KubeApiServiceListProps {
  /**
   * Items is the list of APIService
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceList#items
   */
  readonly items: KubeApiServiceProps[];
  /**
   * Standard list metadata More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceList#metadata
   */
  readonly metadata?: ListMeta;
}
/**
 * Converts an object of type 'KubeApiServiceListProps' to JSON representation.
 */
export declare function toJson_KubeApiServiceListProps(
  obj: KubeApiServiceListProps | undefined,
): Record<string, any> | undefined;
/**
 * ObjectMeta is metadata that all persisted resources must have, which includes all objects users must create.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta
 */
export interface ObjectMeta {
  /**
   * Annotations is an unstructured key value map stored with a resource that may be set by external tools to store and retrieve arbitrary metadata. They are not queryable and should be preserved when modifying objects. More info: http://kubernetes.io/docs/user-guide/annotations
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#annotations
   */
  readonly annotations?: {
    [key: string]: string;
  };
  /**
   * The name of the cluster which the object belongs to. This is used to distinguish resources with same name and namespace in different clusters. This field is not set anywhere right now and apiserver is going to ignore it if set in create or update request.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#clusterName
   */
  readonly clusterName?: string;
  /**
   * CreationTimestamp is a timestamp representing the server time when this object was created. It is not guaranteed to be set in happens-before order across separate operations. Clients may not set this value. It is represented in RFC3339 form and is in UTC.
   *
   * Populated by the system. Read-only. Null for lists. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#creationTimestamp
   */
  readonly creationTimestamp?: Date;
  /**
   * Number of seconds allowed for this object to gracefully terminate before it will be removed from the system. Only set when deletionTimestamp is also set. May only be shortened. Read-only.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#deletionGracePeriodSeconds
   */
  readonly deletionGracePeriodSeconds?: number;
  /**
   * DeletionTimestamp is RFC 3339 date and time at which this resource will be deleted. This field is set by the server when a graceful deletion is requested by the user, and is not directly settable by a client. The resource is expected to be deleted (no longer visible from resource lists, and not reachable by name) after the time in this field, once the finalizers list is empty. As long as the finalizers list contains items, deletion is blocked. Once the deletionTimestamp is set, this value may not be unset or be set further into the future, although it may be shortened or the resource may be deleted prior to this time. For example, a user may request that a pod is deleted in 30 seconds. The Kubelet will react by sending a graceful termination signal to the containers in the pod. After that 30 seconds, the Kubelet will send a hard termination signal (SIGKILL) to the container and after cleanup, remove the pod from the API. In the presence of network partitions, this object may still exist after this timestamp, until an administrator or automated process can determine the resource is fully terminated. If not set, graceful deletion of the object has not been requested.
   *
   * Populated by the system when a graceful deletion is requested. Read-only. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#deletionTimestamp
   */
  readonly deletionTimestamp?: Date;
  /**
   * Must be empty before the object is deleted from the registry. Each entry is an identifier for the responsible component that will remove the entry from the list. If the deletionTimestamp of the object is non-nil, entries in this list can only be removed. Finalizers may be processed and removed in any order.  Order is NOT enforced because it introduces significant risk of stuck finalizers. finalizers is a shared field, any actor with permission can reorder it. If the finalizer list is processed in order, then this can lead to a situation in which the component responsible for the first finalizer in the list is waiting for a signal (field value, external system, or other) produced by a component responsible for a finalizer later in the list, resulting in a deadlock. Without enforced ordering finalizers are free to order amongst themselves and are not vulnerable to ordering changes in the list.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#finalizers
   */
  readonly finalizers?: string[];
  /**
   * GenerateName is an optional prefix, used by the server, to generate a unique name ONLY IF the Name field has not been provided. If this field is used, the name returned to the client will be different than the name passed. This value will also be combined with a unique suffix. The provided value has the same validation rules as the Name field, and may be truncated by the length of the suffix required to make the value unique on the server.
   *
   * If this field is specified and the generated name exists, the server will NOT return a 409 - instead, it will either return 201 Created or 500 with Reason ServerTimeout indicating a unique name could not be found in the time allotted, and the client should retry (optionally after the time indicated in the Retry-After header).
   *
   * Applied only if Name is not specified. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#idempotency
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#generateName
   */
  readonly generateName?: string;
  /**
   * A sequence number representing a specific generation of the desired state. Populated by the system. Read-only.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#generation
   */
  readonly generation?: number;
  /**
   * Map of string keys and values that can be used to organize and categorize (scope and select) objects. May match selectors of replication controllers and services. More info: http://kubernetes.io/docs/user-guide/labels
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#labels
   */
  readonly labels?: {
    [key: string]: string;
  };
  /**
   * ManagedFields maps workflow-id and version to the set of fields that are managed by that workflow. This is mostly for internal housekeeping, and users typically shouldn't need to set or understand this field. A workflow can be the user's name, a controller's name, or the name of a specific apply path like "ci-cd". The set of fields is always in the version that the workflow used when modifying the object.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#managedFields
   */
  readonly managedFields?: ManagedFieldsEntry[];
  /**
   * Name must be unique within a namespace. Is required when creating resources, although some resources may allow a client to request the generation of an appropriate name automatically. Name is primarily intended for creation idempotence and configuration definition. Cannot be updated. More info: http://kubernetes.io/docs/user-guide/identifiers#names
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#name
   */
  readonly name?: string;
  /**
   * Namespace defines the space within which each name must be unique. An empty namespace is equivalent to the "default" namespace, but "default" is the canonical representation. Not all objects are required to be scoped to a namespace - the value of this field for those objects will be empty.
   *
   * Must be a DNS_LABEL. Cannot be updated. More info: http://kubernetes.io/docs/user-guide/namespaces
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#namespace
   */
  readonly namespace?: string;
  /**
   * List of objects depended by this object. If ALL objects in the list have been deleted, this object will be garbage collected. If this object is managed by a controller, then an entry in this list will point to this controller, with the controller field set to true. There cannot be more than one managing controller.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#ownerReferences
   */
  readonly ownerReferences?: OwnerReference[];
  /**
   * An opaque value that represents the internal version of this object that can be used by clients to determine when objects have changed. May be used for optimistic concurrency, change detection, and the watch operation on a resource or set of resources. Clients must treat these values as opaque and passed unmodified back to the server. They may only be valid for a particular resource or set of resources.
   *
   * Populated by the system. Read-only. Value must be treated as opaque by clients and . More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#resourceVersion
   */
  readonly resourceVersion?: string;
  /**
   * SelfLink is a URL representing this object. Populated by the system. Read-only.
   *
   * DEPRECATED Kubernetes will stop propagating this field in 1.20 release and the field is planned to be removed in 1.21 release.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#selfLink
   */
  readonly selfLink?: string;
  /**
   * UID is the unique in time and space value for this object. It is typically generated by the server on successful creation of a resource and is not allowed to change on PUT operations.
   *
   * Populated by the system. Read-only. More info: http://kubernetes.io/docs/user-guide/identifiers#uids
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ObjectMeta#uid
   */
  readonly uid?: string;
}
/**
 * Converts an object of type 'ObjectMeta' to JSON representation.
 */
export declare function toJson_ObjectMeta(
  obj: ObjectMeta | undefined,
): Record<string, any> | undefined;
/**
 * MutatingWebhook describes an admission webhook and the resources and operations it applies to.
 *
 * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook
 */
export interface MutatingWebhook {
  /**
   * AdmissionReviewVersions is an ordered list of preferred `AdmissionReview` versions the Webhook expects. API server will try to use first version in the list which it supports. If none of the versions specified in this list supported by API server, validation will fail for this object. If a persisted webhook configuration specifies allowed versions and does not include any versions known to the API Server, calls to the webhook will fail and be subject to the failure policy.
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#admissionReviewVersions
   */
  readonly admissionReviewVersions: string[];
  /**
   * ClientConfig defines how to communicate with the hook. Required
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#clientConfig
   */
  readonly clientConfig: WebhookClientConfig;
  /**
   * FailurePolicy defines how unrecognized errors from the admission endpoint are handled - allowed values are Ignore or Fail. Defaults to Fail.
   *
   * @default Fail.
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#failurePolicy
   */
  readonly failurePolicy?: string;
  /**
   * matchPolicy defines how the "rules" list is used to match incoming requests. Allowed values are "Exact" or "Equivalent".
   *
   * - Exact: match a request only if it exactly matches a specified rule. For example, if deployments can be modified via apps/v1, apps/v1beta1, and extensions/v1beta1, but "rules" only included `apiGroups:["apps"], apiVersions:["v1"], resources: ["deployments"]`, a request to apps/v1beta1 or extensions/v1beta1 would not be sent to the webhook.
   *
   * - Equivalent: match a request if modifies a resource listed in rules, even via another API group or version. For example, if deployments can be modified via apps/v1, apps/v1beta1, and extensions/v1beta1, and "rules" only included `apiGroups:["apps"], apiVersions:["v1"], resources: ["deployments"]`, a request to apps/v1beta1 or extensions/v1beta1 would be converted to apps/v1 and sent to the webhook.
   *
   * Defaults to "Equivalent"
   *
   * @default Equivalent"
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#matchPolicy
   */
  readonly matchPolicy?: string;
  /**
   * The name of the admission webhook. Name should be fully qualified, e.g., imagepolicy.kubernetes.io, where "imagepolicy" is the name of the webhook, and kubernetes.io is the name of the organization. Required.
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#name
   */
  readonly name: string;
  /**
   * NamespaceSelector decides whether to run the webhook on an object based on whether the namespace for that object matches the selector. If the object itself is a namespace, the matching is performed on object.metadata.labels. If the object is another cluster scoped resource, it never skips the webhook.
   *
   * For example, to run the webhook on any objects whose namespace is not associated with "runlevel" of "0" or "1";  you will set the selector as follows: "namespaceSelector": {
   * "matchExpressions": [
   * {
   * "key": "runlevel",
   * "operator": "NotIn",
   * "values": [
   * "0",
   * "1"
   * ]
   * }
   * ]
   * }
   *
   * If instead you want to only run the webhook on any objects whose namespace is associated with the "environment" of "prod" or "staging"; you will set the selector as follows: "namespaceSelector": {
   * "matchExpressions": [
   * {
   * "key": "environment",
   * "operator": "In",
   * "values": [
   * "prod",
   * "staging"
   * ]
   * }
   * ]
   * }
   *
   * See https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/ for more examples of label selectors.
   *
   * Default to the empty LabelSelector, which matches everything.
   *
   * @default the empty LabelSelector, which matches everything.
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#namespaceSelector
   */
  readonly namespaceSelector?: LabelSelector;
  /**
   * ObjectSelector decides whether to run the webhook based on if the object has matching labels. objectSelector is evaluated against both the oldObject and newObject that would be sent to the webhook, and is considered to match if either object matches the selector. A null object (oldObject in the case of create, or newObject in the case of delete) or an object that cannot have labels (like a DeploymentRollback or a PodProxyOptions object) is not considered to match. Use the object selector only if the webhook is opt-in, because end users may skip the admission webhook by setting the labels. Default to the empty LabelSelector, which matches everything.
   *
   * @default the empty LabelSelector, which matches everything.
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#objectSelector
   */
  readonly objectSelector?: LabelSelector;
  /**
   * reinvocationPolicy indicates whether this webhook should be called multiple times as part of a single admission evaluation. Allowed values are "Never" and "IfNeeded".
   *
   * Never: the webhook will not be called more than once in a single admission evaluation.
   *
   * IfNeeded: the webhook will be called at least one additional time as part of the admission evaluation if the object being admitted is modified by other admission plugins after the initial webhook call. Webhooks that specify this option *must* be idempotent, able to process objects they previously admitted. Note: * the number of additional invocations is not guaranteed to be exactly one. * if additional invocations result in further modifications to the object, webhooks are not guaranteed to be invoked again. * webhooks that use this option may be reordered to minimize the number of additional invocations. * to validate an object after all mutations are guaranteed complete, use a validating admission webhook instead.
   *
   * Defaults to "Never".
   *
   * @default Never".
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#reinvocationPolicy
   */
  readonly reinvocationPolicy?: string;
  /**
   * Rules describes what operations on what resources/subresources the webhook cares about. The webhook cares about an operation if it matches _any_ Rule. However, in order to prevent ValidatingAdmissionWebhooks and MutatingAdmissionWebhooks from putting the cluster in a state which cannot be recovered from without completely disabling the plugin, ValidatingAdmissionWebhooks and MutatingAdmissionWebhooks are never called on admission requests for ValidatingWebhookConfiguration and MutatingWebhookConfiguration objects.
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#rules
   */
  readonly rules?: RuleWithOperations[];
  /**
   * SideEffects states whether this webhook has side effects. Acceptable values are: None, NoneOnDryRun (webhooks created via v1beta1 may also specify Some or Unknown). Webhooks with side effects MUST implement a reconciliation system, since a request may be rejected by a future step in the admission chain and the side effects therefore need to be undone. Requests with the dryRun attribute will be auto-rejected if they match a webhook with sideEffects == Unknown or Some.
   *
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#sideEffects
   */
  readonly sideEffects: string;
  /**
   * TimeoutSeconds specifies the timeout for this webhook. After the timeout passes, the webhook call will be ignored or the API call will fail based on the failure policy. The timeout value must be between 1 and 30 seconds. Default to 10 seconds.
   *
   * @default 10 seconds.
   * @schema io.k8s.api.admissionregistration.v1.MutatingWebhook#timeoutSeconds
   */
  readonly timeoutSeconds?: number;
}
/**
 * Converts an object of type 'MutatingWebhook' to JSON representation.
 */
export declare function toJson_MutatingWebhook(
  obj: MutatingWebhook | undefined,
): Record<string, any> | undefined;
/**
 * ListMeta describes metadata that synthetic resources must have, including lists and various status objects. A resource may have only one of {ObjectMeta, ListMeta}.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta
 */
export interface ListMeta {
  /**
   * continue may be set if the user set a limit on the number of items returned, and indicates that the server has more data available. The value is opaque and may be used to issue another request to the endpoint that served this list to retrieve the next set of available objects. Continuing a consistent list may not be possible if the server configuration has changed or more than a few minutes have passed. The resourceVersion field returned when using this continue value will be identical to the value in the first response, unless you have received this token from an error message.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta#continue
   */
  readonly continue?: string;
  /**
   * remainingItemCount is the number of subsequent items in the list which are not included in this list response. If the list request contained label or field selectors, then the number of remaining items is unknown and the field will be left unset and omitted during serialization. If the list is complete (either because it is not chunking or because this is the last chunk), then there are no more remaining items and this field will be left unset and omitted during serialization. Servers older than v1.15 do not set this field. The intended use of the remainingItemCount is *estimating* the size of a collection. Clients should not rely on the remainingItemCount to be set or to be exact.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta#remainingItemCount
   */
  readonly remainingItemCount?: number;
  /**
   * String that identifies the server's internal version of this object that can be used by clients to determine when objects have changed. Value must be treated as opaque by clients and passed unmodified back to the server. Populated by the system. Read-only. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta#resourceVersion
   */
  readonly resourceVersion?: string;
  /**
   * selfLink is a URL representing this object. Populated by the system. Read-only.
   *
   * DEPRECATED Kubernetes will stop propagating this field in 1.20 release and the field is planned to be removed in 1.21 release.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ListMeta#selfLink
   */
  readonly selfLink?: string;
}
/**
 * Converts an object of type 'ListMeta' to JSON representation.
 */
export declare function toJson_ListMeta(
  obj: ListMeta | undefined,
): Record<string, any> | undefined;
/**
 * ValidatingWebhook describes an admission webhook and the resources and operations it applies to.
 *
 * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook
 */
export interface ValidatingWebhook {
  /**
   * AdmissionReviewVersions is an ordered list of preferred `AdmissionReview` versions the Webhook expects. API server will try to use first version in the list which it supports. If none of the versions specified in this list supported by API server, validation will fail for this object. If a persisted webhook configuration specifies allowed versions and does not include any versions known to the API Server, calls to the webhook will fail and be subject to the failure policy.
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#admissionReviewVersions
   */
  readonly admissionReviewVersions: string[];
  /**
   * ClientConfig defines how to communicate with the hook. Required
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#clientConfig
   */
  readonly clientConfig: WebhookClientConfig;
  /**
   * FailurePolicy defines how unrecognized errors from the admission endpoint are handled - allowed values are Ignore or Fail. Defaults to Fail.
   *
   * @default Fail.
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#failurePolicy
   */
  readonly failurePolicy?: string;
  /**
   * matchPolicy defines how the "rules" list is used to match incoming requests. Allowed values are "Exact" or "Equivalent".
   *
   * - Exact: match a request only if it exactly matches a specified rule. For example, if deployments can be modified via apps/v1, apps/v1beta1, and extensions/v1beta1, but "rules" only included `apiGroups:["apps"], apiVersions:["v1"], resources: ["deployments"]`, a request to apps/v1beta1 or extensions/v1beta1 would not be sent to the webhook.
   *
   * - Equivalent: match a request if modifies a resource listed in rules, even via another API group or version. For example, if deployments can be modified via apps/v1, apps/v1beta1, and extensions/v1beta1, and "rules" only included `apiGroups:["apps"], apiVersions:["v1"], resources: ["deployments"]`, a request to apps/v1beta1 or extensions/v1beta1 would be converted to apps/v1 and sent to the webhook.
   *
   * Defaults to "Equivalent"
   *
   * @default Equivalent"
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#matchPolicy
   */
  readonly matchPolicy?: string;
  /**
   * The name of the admission webhook. Name should be fully qualified, e.g., imagepolicy.kubernetes.io, where "imagepolicy" is the name of the webhook, and kubernetes.io is the name of the organization. Required.
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#name
   */
  readonly name: string;
  /**
   * NamespaceSelector decides whether to run the webhook on an object based on whether the namespace for that object matches the selector. If the object itself is a namespace, the matching is performed on object.metadata.labels. If the object is another cluster scoped resource, it never skips the webhook.
   *
   * For example, to run the webhook on any objects whose namespace is not associated with "runlevel" of "0" or "1";  you will set the selector as follows: "namespaceSelector": {
   * "matchExpressions": [
   * {
   * "key": "runlevel",
   * "operator": "NotIn",
   * "values": [
   * "0",
   * "1"
   * ]
   * }
   * ]
   * }
   *
   * If instead you want to only run the webhook on any objects whose namespace is associated with the "environment" of "prod" or "staging"; you will set the selector as follows: "namespaceSelector": {
   * "matchExpressions": [
   * {
   * "key": "environment",
   * "operator": "In",
   * "values": [
   * "prod",
   * "staging"
   * ]
   * }
   * ]
   * }
   *
   * See https://kubernetes.io/docs/concepts/overview/working-with-objects/labels for more examples of label selectors.
   *
   * Default to the empty LabelSelector, which matches everything.
   *
   * @default the empty LabelSelector, which matches everything.
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#namespaceSelector
   */
  readonly namespaceSelector?: LabelSelector;
  /**
   * ObjectSelector decides whether to run the webhook based on if the object has matching labels. objectSelector is evaluated against both the oldObject and newObject that would be sent to the webhook, and is considered to match if either object matches the selector. A null object (oldObject in the case of create, or newObject in the case of delete) or an object that cannot have labels (like a DeploymentRollback or a PodProxyOptions object) is not considered to match. Use the object selector only if the webhook is opt-in, because end users may skip the admission webhook by setting the labels. Default to the empty LabelSelector, which matches everything.
   *
   * @default the empty LabelSelector, which matches everything.
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#objectSelector
   */
  readonly objectSelector?: LabelSelector;
  /**
   * Rules describes what operations on what resources/subresources the webhook cares about. The webhook cares about an operation if it matches _any_ Rule. However, in order to prevent ValidatingAdmissionWebhooks and MutatingAdmissionWebhooks from putting the cluster in a state which cannot be recovered from without completely disabling the plugin, ValidatingAdmissionWebhooks and MutatingAdmissionWebhooks are never called on admission requests for ValidatingWebhookConfiguration and MutatingWebhookConfiguration objects.
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#rules
   */
  readonly rules?: RuleWithOperations[];
  /**
   * SideEffects states whether this webhook has side effects. Acceptable values are: None, NoneOnDryRun (webhooks created via v1beta1 may also specify Some or Unknown). Webhooks with side effects MUST implement a reconciliation system, since a request may be rejected by a future step in the admission chain and the side effects therefore need to be undone. Requests with the dryRun attribute will be auto-rejected if they match a webhook with sideEffects == Unknown or Some.
   *
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#sideEffects
   */
  readonly sideEffects: string;
  /**
   * TimeoutSeconds specifies the timeout for this webhook. After the timeout passes, the webhook call will be ignored or the API call will fail based on the failure policy. The timeout value must be between 1 and 30 seconds. Default to 10 seconds.
   *
   * @default 10 seconds.
   * @schema io.k8s.api.admissionregistration.v1.ValidatingWebhook#timeoutSeconds
   */
  readonly timeoutSeconds?: number;
}
/**
 * Converts an object of type 'ValidatingWebhook' to JSON representation.
 */
export declare function toJson_ValidatingWebhook(
  obj: ValidatingWebhook | undefined,
): Record<string, any> | undefined;
/**
 * DaemonSetSpec is the specification of a daemon set.
 *
 * @schema io.k8s.api.apps.v1.DaemonSetSpec
 */
export interface DaemonSetSpec {
  /**
   * The minimum number of seconds for which a newly created DaemonSet pod should be ready without any of its container crashing, for it to be considered available. Defaults to 0 (pod will be considered available as soon as it is ready).
   *
   * @default 0 (pod will be considered available as soon as it is ready).
   * @schema io.k8s.api.apps.v1.DaemonSetSpec#minReadySeconds
   */
  readonly minReadySeconds?: number;
  /**
   * The number of old history to retain to allow rollback. This is a pointer to distinguish between explicit zero and not specified. Defaults to 10.
   *
   * @default 10.
   * @schema io.k8s.api.apps.v1.DaemonSetSpec#revisionHistoryLimit
   */
  readonly revisionHistoryLimit?: number;
  /**
   * A label query over pods that are managed by the daemon set. Must match in order to be controlled. It must match the pod template's labels. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
   *
   * @schema io.k8s.api.apps.v1.DaemonSetSpec#selector
   */
  readonly selector: LabelSelector;
  /**
   * An object that describes the pod that will be created. The DaemonSet will create exactly one copy of this pod on every node that matches the template's node selector (or on every node if no node selector is specified). More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#pod-template
   *
   * @schema io.k8s.api.apps.v1.DaemonSetSpec#template
   */
  readonly template: PodTemplateSpec;
  /**
   * An update strategy to replace existing DaemonSet pods with new pods.
   *
   * @schema io.k8s.api.apps.v1.DaemonSetSpec#updateStrategy
   */
  readonly updateStrategy?: DaemonSetUpdateStrategy;
}
/**
 * Converts an object of type 'DaemonSetSpec' to JSON representation.
 */
export declare function toJson_DaemonSetSpec(
  obj: DaemonSetSpec | undefined,
): Record<string, any> | undefined;
/**
 * DeploymentSpec is the specification of the desired behavior of the Deployment.
 *
 * @schema io.k8s.api.apps.v1.DeploymentSpec
 */
export interface DeploymentSpec {
  /**
   * Minimum number of seconds for which a newly created pod should be ready without any of its container crashing, for it to be considered available. Defaults to 0 (pod will be considered available as soon as it is ready)
   *
   * @default 0 (pod will be considered available as soon as it is ready)
   * @schema io.k8s.api.apps.v1.DeploymentSpec#minReadySeconds
   */
  readonly minReadySeconds?: number;
  /**
   * Indicates that the deployment is paused.
   *
   * @schema io.k8s.api.apps.v1.DeploymentSpec#paused
   */
  readonly paused?: boolean;
  /**
   * The maximum time in seconds for a deployment to make progress before it is considered to be failed. The deployment controller will continue to process failed deployments and a condition with a ProgressDeadlineExceeded reason will be surfaced in the deployment status. Note that progress will not be estimated during the time a deployment is paused. Defaults to 600s.
   *
   * @default 600s.
   * @schema io.k8s.api.apps.v1.DeploymentSpec#progressDeadlineSeconds
   */
  readonly progressDeadlineSeconds?: number;
  /**
   * Number of desired pods. This is a pointer to distinguish between explicit zero and not specified. Defaults to 1.
   *
   * @default 1.
   * @schema io.k8s.api.apps.v1.DeploymentSpec#replicas
   */
  readonly replicas?: number;
  /**
   * The number of old ReplicaSets to retain to allow rollback. This is a pointer to distinguish between explicit zero and not specified. Defaults to 10.
   *
   * @default 10.
   * @schema io.k8s.api.apps.v1.DeploymentSpec#revisionHistoryLimit
   */
  readonly revisionHistoryLimit?: number;
  /**
   * Label selector for pods. Existing ReplicaSets whose pods are selected by this will be the ones affected by this deployment. It must match the pod template's labels.
   *
   * @schema io.k8s.api.apps.v1.DeploymentSpec#selector
   */
  readonly selector: LabelSelector;
  /**
   * The deployment strategy to use to replace existing pods with new ones.
   *
   * @schema io.k8s.api.apps.v1.DeploymentSpec#strategy
   */
  readonly strategy?: DeploymentStrategy;
  /**
   * Template describes the pods that will be created.
   *
   * @schema io.k8s.api.apps.v1.DeploymentSpec#template
   */
  readonly template: PodTemplateSpec;
}
/**
 * Converts an object of type 'DeploymentSpec' to JSON representation.
 */
export declare function toJson_DeploymentSpec(
  obj: DeploymentSpec | undefined,
): Record<string, any> | undefined;
/**
 * ReplicaSetSpec is the specification of a ReplicaSet.
 *
 * @schema io.k8s.api.apps.v1.ReplicaSetSpec
 */
export interface ReplicaSetSpec {
  /**
   * Minimum number of seconds for which a newly created pod should be ready without any of its container crashing, for it to be considered available. Defaults to 0 (pod will be considered available as soon as it is ready)
   *
   * @default 0 (pod will be considered available as soon as it is ready)
   * @schema io.k8s.api.apps.v1.ReplicaSetSpec#minReadySeconds
   */
  readonly minReadySeconds?: number;
  /**
   * Replicas is the number of desired replicas. This is a pointer to distinguish between explicit zero and unspecified. Defaults to 1. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/#what-is-a-replicationcontroller
   *
   * @default 1. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/#what-is-a-replicationcontroller
   * @schema io.k8s.api.apps.v1.ReplicaSetSpec#replicas
   */
  readonly replicas?: number;
  /**
   * Selector is a label query over pods that should match the replica count. Label keys and values that must match in order to be controlled by this replica set. It must match the pod template's labels. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
   *
   * @schema io.k8s.api.apps.v1.ReplicaSetSpec#selector
   */
  readonly selector: LabelSelector;
  /**
   * Template is the object that describes the pod that will be created if insufficient replicas are detected. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#pod-template
   *
   * @schema io.k8s.api.apps.v1.ReplicaSetSpec#template
   */
  readonly template?: PodTemplateSpec;
}
/**
 * Converts an object of type 'ReplicaSetSpec' to JSON representation.
 */
export declare function toJson_ReplicaSetSpec(
  obj: ReplicaSetSpec | undefined,
): Record<string, any> | undefined;
/**
 * A StatefulSetSpec is the specification of a StatefulSet.
 *
 * @schema io.k8s.api.apps.v1.StatefulSetSpec
 */
export interface StatefulSetSpec {
  /**
   * Minimum number of seconds for which a newly created pod should be ready without any of its container crashing for it to be considered available. Defaults to 0 (pod will be considered available as soon as it is ready) This is an alpha field and requires enabling StatefulSetMinReadySeconds feature gate.
   *
   * @default 0 (pod will be considered available as soon as it is ready) This is an alpha field and requires enabling StatefulSetMinReadySeconds feature gate.
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#minReadySeconds
   */
  readonly minReadySeconds?: number;
  /**
   * podManagementPolicy controls how pods are created during initial scale up, when replacing pods on nodes, or when scaling down. The default policy is `OrderedReady`, where pods are created in increasing order (pod-0, then pod-1, etc) and the controller will wait until each pod is ready before continuing. When scaling down, the pods are removed in the opposite order. The alternative policy is `Parallel` which will create pods in parallel to match the desired scale without waiting, and on scale down will delete all pods at once.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#podManagementPolicy
   */
  readonly podManagementPolicy?: string;
  /**
   * replicas is the desired number of replicas of the given Template. These are replicas in the sense that they are instantiations of the same Template, but individual replicas also have a consistent identity. If unspecified, defaults to 1.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#replicas
   */
  readonly replicas?: number;
  /**
   * revisionHistoryLimit is the maximum number of revisions that will be maintained in the StatefulSet's revision history. The revision history consists of all revisions not represented by a currently applied StatefulSetSpec version. The default value is 10.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#revisionHistoryLimit
   */
  readonly revisionHistoryLimit?: number;
  /**
   * selector is a label query over pods that should match the replica count. It must match the pod template's labels. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#selector
   */
  readonly selector: LabelSelector;
  /**
   * serviceName is the name of the service that governs this StatefulSet. This service must exist before the StatefulSet, and is responsible for the network identity of the set. Pods get DNS/hostnames that follow the pattern: pod-specific-string.serviceName.default.svc.cluster.local where "pod-specific-string" is managed by the StatefulSet controller.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#serviceName
   */
  readonly serviceName: string;
  /**
   * template is the object that describes the pod that will be created if insufficient replicas are detected. Each pod stamped out by the StatefulSet will fulfill this Template, but have a unique identity from the rest of the StatefulSet.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#template
   */
  readonly template: PodTemplateSpec;
  /**
   * updateStrategy indicates the StatefulSetUpdateStrategy that will be employed to update Pods in the StatefulSet when a revision is made to Template.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#updateStrategy
   */
  readonly updateStrategy?: StatefulSetUpdateStrategy;
  /**
   * volumeClaimTemplates is a list of claims that pods are allowed to reference. The StatefulSet controller is responsible for mapping network identities to claims in a way that maintains the identity of a pod. Every claim in this list must have at least one matching (by name) volumeMount in one container in the template. A claim in this list takes precedence over any volumes in the template, with the same name.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetSpec#volumeClaimTemplates
   */
  readonly volumeClaimTemplates?: KubePersistentVolumeClaimProps[];
}
/**
 * Converts an object of type 'StatefulSetSpec' to JSON representation.
 */
export declare function toJson_StatefulSetSpec(
  obj: StatefulSetSpec | undefined,
): Record<string, any> | undefined;
/**
 * TokenRequestSpec contains client provided parameters of a token request.
 *
 * @schema io.k8s.api.authentication.v1.TokenRequestSpec
 */
export interface TokenRequestSpec {
  /**
   * Audiences are the intendend audiences of the token. A recipient of a token must identitfy themself with an identifier in the list of audiences of the token, and otherwise should reject the token. A token issued for multiple audiences may be used to authenticate against any of the audiences listed but implies a high degree of trust between the target audiences.
   *
   * @schema io.k8s.api.authentication.v1.TokenRequestSpec#audiences
   */
  readonly audiences: string[];
  /**
   * BoundObjectRef is a reference to an object that the token will be bound to. The token will only be valid for as long as the bound object exists. NOTE: The API server's TokenReview endpoint will validate the BoundObjectRef, but other audiences may not. Keep ExpirationSeconds small if you want prompt revocation.
   *
   * @schema io.k8s.api.authentication.v1.TokenRequestSpec#boundObjectRef
   */
  readonly boundObjectRef?: BoundObjectReference;
  /**
   * ExpirationSeconds is the requested duration of validity of the request. The token issuer may return a token with a different validity duration so a client needs to check the 'expiration' field in a response.
   *
   * @schema io.k8s.api.authentication.v1.TokenRequestSpec#expirationSeconds
   */
  readonly expirationSeconds?: number;
}
/**
 * Converts an object of type 'TokenRequestSpec' to JSON representation.
 */
export declare function toJson_TokenRequestSpec(
  obj: TokenRequestSpec | undefined,
): Record<string, any> | undefined;
/**
 * TokenReviewSpec is a description of the token authentication request.
 *
 * @schema io.k8s.api.authentication.v1.TokenReviewSpec
 */
export interface TokenReviewSpec {
  /**
   * Audiences is a list of the identifiers that the resource server presented with the token identifies as. Audience-aware token authenticators will verify that the token was intended for at least one of the audiences in this list. If no audiences are provided, the audience will default to the audience of the Kubernetes apiserver.
   *
   * @schema io.k8s.api.authentication.v1.TokenReviewSpec#audiences
   */
  readonly audiences?: string[];
  /**
   * Token is the opaque bearer token.
   *
   * @schema io.k8s.api.authentication.v1.TokenReviewSpec#token
   */
  readonly token?: string;
}
/**
 * Converts an object of type 'TokenReviewSpec' to JSON representation.
 */
export declare function toJson_TokenReviewSpec(
  obj: TokenReviewSpec | undefined,
): Record<string, any> | undefined;
/**
 * SubjectAccessReviewSpec is a description of the access request.  Exactly one of ResourceAuthorizationAttributes and NonResourceAuthorizationAttributes must be set
 *
 * @schema io.k8s.api.authorization.v1.SubjectAccessReviewSpec
 */
export interface SubjectAccessReviewSpec {
  /**
   * Extra corresponds to the user.Info.GetExtra() method from the authenticator.  Since that is input to the authorizer it needs a reflection here.
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReviewSpec#extra
   */
  readonly extra?: {
    [key: string]: string[];
  };
  /**
   * Groups is the groups you're testing for.
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReviewSpec#groups
   */
  readonly groups?: string[];
  /**
   * NonResourceAttributes describes information for a non-resource access request
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReviewSpec#nonResourceAttributes
   */
  readonly nonResourceAttributes?: NonResourceAttributes;
  /**
   * ResourceAuthorizationAttributes describes information for a resource access request
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReviewSpec#resourceAttributes
   */
  readonly resourceAttributes?: ResourceAttributes;
  /**
   * UID information about the requesting user.
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReviewSpec#uid
   */
  readonly uid?: string;
  /**
   * User is the user you're testing for. If you specify "User" but not "Groups", then is it interpreted as "What if User were not a member of any groups
   *
   * @schema io.k8s.api.authorization.v1.SubjectAccessReviewSpec#user
   */
  readonly user?: string;
}
/**
 * Converts an object of type 'SubjectAccessReviewSpec' to JSON representation.
 */
export declare function toJson_SubjectAccessReviewSpec(
  obj: SubjectAccessReviewSpec | undefined,
): Record<string, any> | undefined;
/**
 * SelfSubjectAccessReviewSpec is a description of the access request.  Exactly one of ResourceAuthorizationAttributes and NonResourceAuthorizationAttributes must be set
 *
 * @schema io.k8s.api.authorization.v1.SelfSubjectAccessReviewSpec
 */
export interface SelfSubjectAccessReviewSpec {
  /**
   * NonResourceAttributes describes information for a non-resource access request
   *
   * @schema io.k8s.api.authorization.v1.SelfSubjectAccessReviewSpec#nonResourceAttributes
   */
  readonly nonResourceAttributes?: NonResourceAttributes;
  /**
   * ResourceAuthorizationAttributes describes information for a resource access request
   *
   * @schema io.k8s.api.authorization.v1.SelfSubjectAccessReviewSpec#resourceAttributes
   */
  readonly resourceAttributes?: ResourceAttributes;
}
/**
 * Converts an object of type 'SelfSubjectAccessReviewSpec' to JSON representation.
 */
export declare function toJson_SelfSubjectAccessReviewSpec(
  obj: SelfSubjectAccessReviewSpec | undefined,
): Record<string, any> | undefined;
/**
 * SelfSubjectRulesReviewSpec defines the specification for SelfSubjectRulesReview.
 *
 * @schema io.k8s.api.authorization.v1.SelfSubjectRulesReviewSpec
 */
export interface SelfSubjectRulesReviewSpec {
  /**
   * Namespace to evaluate rules for. Required.
   *
   * @schema io.k8s.api.authorization.v1.SelfSubjectRulesReviewSpec#namespace
   */
  readonly namespace?: string;
}
/**
 * Converts an object of type 'SelfSubjectRulesReviewSpec' to JSON representation.
 */
export declare function toJson_SelfSubjectRulesReviewSpec(
  obj: SelfSubjectRulesReviewSpec | undefined,
): Record<string, any> | undefined;
/**
 * specification of a horizontal pod autoscaler.
 *
 * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerSpec
 */
export interface HorizontalPodAutoscalerSpec {
  /**
   * upper limit for the number of pods that can be set by the autoscaler; cannot be smaller than MinReplicas.
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerSpec#maxReplicas
   */
  readonly maxReplicas: number;
  /**
   * minReplicas is the lower limit for the number of replicas to which the autoscaler can scale down.  It defaults to 1 pod.  minReplicas is allowed to be 0 if the alpha feature gate HPAScaleToZero is enabled and at least one Object or External metric is configured.  Scaling is active as long as at least one metric value is available.
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerSpec#minReplicas
   */
  readonly minReplicas?: number;
  /**
   * reference to scaled resource; horizontal pod autoscaler will learn the current resource consumption and will set the desired number of pods by using its Scale subresource.
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerSpec#scaleTargetRef
   */
  readonly scaleTargetRef: CrossVersionObjectReference;
  /**
   * target average CPU utilization (represented as a percentage of requested CPU) over all the pods; if not specified the default autoscaling policy will be used.
   *
   * @schema io.k8s.api.autoscaling.v1.HorizontalPodAutoscalerSpec#targetCPUUtilizationPercentage
   */
  readonly targetCpuUtilizationPercentage?: number;
}
/**
 * Converts an object of type 'HorizontalPodAutoscalerSpec' to JSON representation.
 */
export declare function toJson_HorizontalPodAutoscalerSpec(
  obj: HorizontalPodAutoscalerSpec | undefined,
): Record<string, any> | undefined;
/**
 * ScaleSpec describes the attributes of a scale subresource.
 *
 * @schema io.k8s.api.autoscaling.v1.ScaleSpec
 */
export interface ScaleSpec {
  /**
   * desired number of instances for the scaled object.
   *
   * @schema io.k8s.api.autoscaling.v1.ScaleSpec#replicas
   */
  readonly replicas?: number;
}
/**
 * Converts an object of type 'ScaleSpec' to JSON representation.
 */
export declare function toJson_ScaleSpec(
  obj: ScaleSpec | undefined,
): Record<string, any> | undefined;
/**
 * HorizontalPodAutoscalerSpec describes the desired functionality of the HorizontalPodAutoscaler.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerSpec
 */
export interface HorizontalPodAutoscalerSpecV2Beta1 {
  /**
   * maxReplicas is the upper limit for the number of replicas to which the autoscaler can scale up. It cannot be less that minReplicas.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerSpec#maxReplicas
   */
  readonly maxReplicas: number;
  /**
   * metrics contains the specifications for which to use to calculate the desired replica count (the maximum replica count across all metrics will be used).  The desired replica count is calculated multiplying the ratio between the target value and the current value by the current number of pods.  Ergo, metrics used must decrease as the pod count is increased, and vice-versa.  See the individual metric source types for more information about how each type of metric must respond.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerSpec#metrics
   */
  readonly metrics?: MetricSpecV2Beta1[];
  /**
   * minReplicas is the lower limit for the number of replicas to which the autoscaler can scale down.  It defaults to 1 pod.  minReplicas is allowed to be 0 if the alpha feature gate HPAScaleToZero is enabled and at least one Object or External metric is configured.  Scaling is active as long as at least one metric value is available.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerSpec#minReplicas
   */
  readonly minReplicas?: number;
  /**
   * scaleTargetRef points to the target resource to scale, and is used to the pods for which metrics should be collected, as well as to actually change the replica count.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.HorizontalPodAutoscalerSpec#scaleTargetRef
   */
  readonly scaleTargetRef: CrossVersionObjectReferenceV2Beta1;
}
/**
 * Converts an object of type 'HorizontalPodAutoscalerSpecV2Beta1' to JSON representation.
 */
export declare function toJson_HorizontalPodAutoscalerSpecV2Beta1(
  obj: HorizontalPodAutoscalerSpecV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * HorizontalPodAutoscalerSpec describes the desired functionality of the HorizontalPodAutoscaler.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerSpec
 */
export interface HorizontalPodAutoscalerSpecV2Beta2 {
  /**
   * behavior configures the scaling behavior of the target in both Up and Down directions (scaleUp and scaleDown fields respectively). If not set, the default HPAScalingRules for scale up and scale down are used.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerSpec#behavior
   */
  readonly behavior?: HorizontalPodAutoscalerBehaviorV2Beta2;
  /**
   * maxReplicas is the upper limit for the number of replicas to which the autoscaler can scale up. It cannot be less that minReplicas.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerSpec#maxReplicas
   */
  readonly maxReplicas: number;
  /**
   * metrics contains the specifications for which to use to calculate the desired replica count (the maximum replica count across all metrics will be used).  The desired replica count is calculated multiplying the ratio between the target value and the current value by the current number of pods.  Ergo, metrics used must decrease as the pod count is increased, and vice-versa.  See the individual metric source types for more information about how each type of metric must respond. If not set, the default metric will be set to 80% average CPU utilization.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerSpec#metrics
   */
  readonly metrics?: MetricSpecV2Beta2[];
  /**
   * minReplicas is the lower limit for the number of replicas to which the autoscaler can scale down.  It defaults to 1 pod.  minReplicas is allowed to be 0 if the alpha feature gate HPAScaleToZero is enabled and at least one Object or External metric is configured.  Scaling is active as long as at least one metric value is available.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerSpec#minReplicas
   */
  readonly minReplicas?: number;
  /**
   * scaleTargetRef points to the target resource to scale, and is used to the pods for which metrics should be collected, as well as to actually change the replica count.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerSpec#scaleTargetRef
   */
  readonly scaleTargetRef: CrossVersionObjectReferenceV2Beta2;
}
/**
 * Converts an object of type 'HorizontalPodAutoscalerSpecV2Beta2' to JSON representation.
 */
export declare function toJson_HorizontalPodAutoscalerSpecV2Beta2(
  obj: HorizontalPodAutoscalerSpecV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * CronJobSpec describes how the job execution will look like and when it will actually run.
 *
 * @schema io.k8s.api.batch.v1.CronJobSpec
 */
export interface CronJobSpec {
  /**
   * Specifies how to treat concurrent executions of a Job. Valid values are: - "Allow" (default): allows CronJobs to run concurrently; - "Forbid": forbids concurrent runs, skipping next run if previous run hasn't finished yet; - "Replace": cancels currently running job and replaces it with a new one
   *
   * @schema io.k8s.api.batch.v1.CronJobSpec#concurrencyPolicy
   */
  readonly concurrencyPolicy?: string;
  /**
   * The number of failed finished jobs to retain. Value must be non-negative integer. Defaults to 1.
   *
   * @default 1.
   * @schema io.k8s.api.batch.v1.CronJobSpec#failedJobsHistoryLimit
   */
  readonly failedJobsHistoryLimit?: number;
  /**
   * Specifies the job that will be created when executing a CronJob.
   *
   * @schema io.k8s.api.batch.v1.CronJobSpec#jobTemplate
   */
  readonly jobTemplate: JobTemplateSpec;
  /**
   * The schedule in Cron format, see https://en.wikipedia.org/wiki/Cron.
   *
   * @schema io.k8s.api.batch.v1.CronJobSpec#schedule
   */
  readonly schedule: string;
  /**
   * Optional deadline in seconds for starting the job if it misses scheduled time for any reason.  Missed jobs executions will be counted as failed ones.
   *
   * @schema io.k8s.api.batch.v1.CronJobSpec#startingDeadlineSeconds
   */
  readonly startingDeadlineSeconds?: number;
  /**
   * The number of successful finished jobs to retain. Value must be non-negative integer. Defaults to 3.
   *
   * @default 3.
   * @schema io.k8s.api.batch.v1.CronJobSpec#successfulJobsHistoryLimit
   */
  readonly successfulJobsHistoryLimit?: number;
  /**
   * This flag tells the controller to suspend subsequent executions, it does not apply to already started executions.  Defaults to false.
   *
   * @default false.
   * @schema io.k8s.api.batch.v1.CronJobSpec#suspend
   */
  readonly suspend?: boolean;
}
/**
 * Converts an object of type 'CronJobSpec' to JSON representation.
 */
export declare function toJson_CronJobSpec(
  obj: CronJobSpec | undefined,
): Record<string, any> | undefined;
/**
 * JobSpec describes how the job execution will look like.
 *
 * @schema io.k8s.api.batch.v1.JobSpec
 */
export interface JobSpec {
  /**
   * Specifies the duration in seconds relative to the startTime that the job may be continuously active before the system tries to terminate it; value must be positive integer. If a Job is suspended (at creation or through an update), this timer will effectively be stopped and reset when the Job is resumed again.
   *
   * @schema io.k8s.api.batch.v1.JobSpec#activeDeadlineSeconds
   */
  readonly activeDeadlineSeconds?: number;
  /**
   * Specifies the number of retries before marking this job failed. Defaults to 6
   *
   * @default 6
   * @schema io.k8s.api.batch.v1.JobSpec#backoffLimit
   */
  readonly backoffLimit?: number;
  /**
   * CompletionMode specifies how Pod completions are tracked. It can be `NonIndexed` (default) or `Indexed`.
   *
   * `NonIndexed` means that the Job is considered complete when there have been .spec.completions successfully completed Pods. Each Pod completion is homologous to each other.
   *
   * `Indexed` means that the Pods of a Job get an associated completion index from 0 to (.spec.completions - 1), available in the annotation batch.kubernetes.io/job-completion-index. The Job is considered complete when there is one successfully completed Pod for each index. When value is `Indexed`, .spec.completions must be specified and `.spec.parallelism` must be less than or equal to 10^5. In addition, The Pod name takes the form `$(job-name)-$(index)-$(random-string)`, the Pod hostname takes the form `$(job-name)-$(index)`.
   *
   * This field is beta-level. More completion modes can be added in the future. If the Job controller observes a mode that it doesn't recognize, the controller skips updates for the Job.
   *
   * @schema io.k8s.api.batch.v1.JobSpec#completionMode
   */
  readonly completionMode?: string;
  /**
   * Specifies the desired number of successfully finished pods the job should be run with.  Setting to nil means that the success of any pod signals the success of all pods, and allows parallelism to have any positive value.  Setting to 1 means that parallelism is limited to 1 and the success of that pod signals the success of the job. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/
   *
   * @schema io.k8s.api.batch.v1.JobSpec#completions
   */
  readonly completions?: number;
  /**
   * manualSelector controls generation of pod labels and pod selectors. Leave `manualSelector` unset unless you are certain what you are doing. When false or unset, the system pick labels unique to this job and appends those labels to the pod template.  When true, the user is responsible for picking unique labels and specifying the selector.  Failure to pick a unique label may cause this and other jobs to not function correctly.  However, You may see `manualSelector=true` in jobs that were created with the old `extensions/v1beta1` API. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/#specifying-your-own-pod-selector
   *
   * @schema io.k8s.api.batch.v1.JobSpec#manualSelector
   */
  readonly manualSelector?: boolean;
  /**
   * Specifies the maximum desired number of pods the job should run at any given time. The actual number of pods running in steady state will be less than this number when ((.spec.completions - .status.successful) < .spec.parallelism), i.e. when the work left to do is less than max parallelism. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/
   *
   * @schema io.k8s.api.batch.v1.JobSpec#parallelism
   */
  readonly parallelism?: number;
  /**
   * A label query over pods that should match the pod count. Normally, the system sets this field for you. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
   *
   * @schema io.k8s.api.batch.v1.JobSpec#selector
   */
  readonly selector?: LabelSelector;
  /**
   * Suspend specifies whether the Job controller should create Pods or not. If a Job is created with suspend set to true, no Pods are created by the Job controller. If a Job is suspended after creation (i.e. the flag goes from false to true), the Job controller will delete all active Pods associated with this Job. Users must design their workload to gracefully handle this. Suspending a Job will reset the StartTime field of the Job, effectively resetting the ActiveDeadlineSeconds timer too. Defaults to false.
   *
   * This field is beta-level, gated by SuspendJob feature flag (enabled by default).
   *
   * @default false.
   * @schema io.k8s.api.batch.v1.JobSpec#suspend
   */
  readonly suspend?: boolean;
  /**
   * Describes the pod that will be created when executing a job. More info: https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/
   *
   * @schema io.k8s.api.batch.v1.JobSpec#template
   */
  readonly template: PodTemplateSpec;
  /**
   * ttlSecondsAfterFinished limits the lifetime of a Job that has finished execution (either Complete or Failed). If this field is set, ttlSecondsAfterFinished after the Job finishes, it is eligible to be automatically deleted. When the Job is being deleted, its lifecycle guarantees (e.g. finalizers) will be honored. If this field is unset, the Job won't be automatically deleted. If this field is set to zero, the Job becomes eligible to be deleted immediately after it finishes. This field is alpha-level and is only honored by servers that enable the TTLAfterFinished feature.
   *
   * @schema io.k8s.api.batch.v1.JobSpec#ttlSecondsAfterFinished
   */
  readonly ttlSecondsAfterFinished?: number;
}
/**
 * Converts an object of type 'JobSpec' to JSON representation.
 */
export declare function toJson_JobSpec(
  obj: JobSpec | undefined,
): Record<string, any> | undefined;
/**
 * CronJobSpec describes how the job execution will look like and when it will actually run.
 *
 * @schema io.k8s.api.batch.v1beta1.CronJobSpec
 */
export interface CronJobSpecV1Beta1 {
  /**
   * Specifies how to treat concurrent executions of a Job. Valid values are: - "Allow" (default): allows CronJobs to run concurrently; - "Forbid": forbids concurrent runs, skipping next run if previous run hasn't finished yet; - "Replace": cancels currently running job and replaces it with a new one
   *
   * @schema io.k8s.api.batch.v1beta1.CronJobSpec#concurrencyPolicy
   */
  readonly concurrencyPolicy?: string;
  /**
   * The number of failed finished jobs to retain. This is a pointer to distinguish between explicit zero and not specified. Defaults to 1.
   *
   * @default 1.
   * @schema io.k8s.api.batch.v1beta1.CronJobSpec#failedJobsHistoryLimit
   */
  readonly failedJobsHistoryLimit?: number;
  /**
   * Specifies the job that will be created when executing a CronJob.
   *
   * @schema io.k8s.api.batch.v1beta1.CronJobSpec#jobTemplate
   */
  readonly jobTemplate: JobTemplateSpecV1Beta1;
  /**
   * The schedule in Cron format, see https://en.wikipedia.org/wiki/Cron.
   *
   * @schema io.k8s.api.batch.v1beta1.CronJobSpec#schedule
   */
  readonly schedule: string;
  /**
   * Optional deadline in seconds for starting the job if it misses scheduled time for any reason.  Missed jobs executions will be counted as failed ones.
   *
   * @schema io.k8s.api.batch.v1beta1.CronJobSpec#startingDeadlineSeconds
   */
  readonly startingDeadlineSeconds?: number;
  /**
   * The number of successful finished jobs to retain. This is a pointer to distinguish between explicit zero and not specified. Defaults to 3.
   *
   * @default 3.
   * @schema io.k8s.api.batch.v1beta1.CronJobSpec#successfulJobsHistoryLimit
   */
  readonly successfulJobsHistoryLimit?: number;
  /**
   * This flag tells the controller to suspend subsequent executions, it does not apply to already started executions.  Defaults to false.
   *
   * @default false.
   * @schema io.k8s.api.batch.v1beta1.CronJobSpec#suspend
   */
  readonly suspend?: boolean;
}
/**
 * Converts an object of type 'CronJobSpecV1Beta1' to JSON representation.
 */
export declare function toJson_CronJobSpecV1Beta1(
  obj: CronJobSpecV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * CertificateSigningRequestSpec contains the certificate request.
 *
 * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec
 */
export interface CertificateSigningRequestSpec {
  /**
   * expirationSeconds is the requested duration of validity of the issued certificate. The certificate signer may issue a certificate with a different validity duration so a client must check the delta between the notBefore and and notAfter fields in the issued certificate to determine the actual duration.
   *
   * The v1.22+ in-tree implementations of the well-known Kubernetes signers will honor this field as long as the requested duration is not greater than the maximum duration they will honor per the --cluster-signing-duration CLI flag to the Kubernetes controller manager.
   *
   * Certificate signers may not honor this field for various reasons:
   *
   * 1. Old signer that is unaware of the field (such as the in-tree
   * implementations prior to v1.22)
   * 2. Signer whose configured maximum is shorter than the requested duration
   * 3. Signer whose configured minimum is longer than the requested duration
   *
   * The minimum valid value for expirationSeconds is 600, i.e. 10 minutes.
   *
   * As of v1.22, this field is beta and is controlled via the CSRDuration feature gate.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#expirationSeconds
   */
  readonly expirationSeconds?: number;
  /**
   * extra contains extra attributes of the user that created the CertificateSigningRequest. Populated by the API server on creation and immutable.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#extra
   */
  readonly extra?: {
    [key: string]: string[];
  };
  /**
   * groups contains group membership of the user that created the CertificateSigningRequest. Populated by the API server on creation and immutable.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#groups
   */
  readonly groups?: string[];
  /**
   * request contains an x509 certificate signing request encoded in a "CERTIFICATE REQUEST" PEM block. When serialized as JSON or YAML, the data is additionally base64-encoded.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#request
   */
  readonly request: string;
  /**
   * signerName indicates the requested signer, and is a qualified name.
   *
   * List/watch requests for CertificateSigningRequests can filter on this field using a "spec.signerName=NAME" fieldSelector.
   *
   * Well-known Kubernetes signers are:
   * 1. "kubernetes.io/kube-apiserver-client": issues client certificates that can be used to authenticate to kube-apiserver.
   * Requests for this signer are never auto-approved by kube-controller-manager, can be issued by the "csrsigning" controller in kube-controller-manager.
   * 2. "kubernetes.io/kube-apiserver-client-kubelet": issues client certificates that kubelets use to authenticate to kube-apiserver.
   * Requests for this signer can be auto-approved by the "csrapproving" controller in kube-controller-manager, and can be issued by the "csrsigning" controller in kube-controller-manager.
   * 3. "kubernetes.io/kubelet-serving" issues serving certificates that kubelets use to serve TLS endpoints, which kube-apiserver can connect to securely.
   * Requests for this signer are never auto-approved by kube-controller-manager, and can be issued by the "csrsigning" controller in kube-controller-manager.
   *
   * More details are available at https://k8s.io/docs/reference/access-authn-authz/certificate-signing-requests/#kubernetes-signers
   *
   * Custom signerNames can also be specified. The signer defines:
   * 1. Trust distribution: how trust (CA bundles) are distributed.
   * 2. Permitted subjects: and behavior when a disallowed subject is requested.
   * 3. Required, permitted, or forbidden x509 extensions in the request (including whether subjectAltNames are allowed, which types, restrictions on allowed values) and behavior when a disallowed extension is requested.
   * 4. Required, permitted, or forbidden key usages / extended key usages.
   * 5. Expiration/certificate lifetime: whether it is fixed by the signer, configurable by the admin.
   * 6. Whether or not requests for CA certificates are allowed.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#signerName
   */
  readonly signerName: string;
  /**
   * uid contains the uid of the user that created the CertificateSigningRequest. Populated by the API server on creation and immutable.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#uid
   */
  readonly uid?: string;
  /**
   * usages specifies a set of key usages requested in the issued certificate.
   *
   * Requests for TLS client certificates typically request: "digital signature", "key encipherment", "client auth".
   *
   * Requests for TLS serving certificates typically request: "key encipherment", "digital signature", "server auth".
   *
   * Valid values are:
   * "signing", "digital signature", "content commitment",
   * "key encipherment", "key agreement", "data encipherment",
   * "cert sign", "crl sign", "encipher only", "decipher only", "any",
   * "server auth", "client auth",
   * "code signing", "email protection", "s/mime",
   * "ipsec end system", "ipsec tunnel", "ipsec user",
   * "timestamping", "ocsp signing", "microsoft sgc", "netscape sgc"
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#usages
   */
  readonly usages?: string[];
  /**
   * username contains the name of the user that created the CertificateSigningRequest. Populated by the API server on creation and immutable.
   *
   * @schema io.k8s.api.certificates.v1.CertificateSigningRequestSpec#username
   */
  readonly username?: string;
}
/**
 * Converts an object of type 'CertificateSigningRequestSpec' to JSON representation.
 */
export declare function toJson_CertificateSigningRequestSpec(
  obj: CertificateSigningRequestSpec | undefined,
): Record<string, any> | undefined;
/**
 * LeaseSpec is a specification of a Lease.
 *
 * @schema io.k8s.api.coordination.v1.LeaseSpec
 */
export interface LeaseSpec {
  /**
   * acquireTime is a time when the current lease was acquired.
   *
   * @schema io.k8s.api.coordination.v1.LeaseSpec#acquireTime
   */
  readonly acquireTime?: Date;
  /**
   * holderIdentity contains the identity of the holder of a current lease.
   *
   * @schema io.k8s.api.coordination.v1.LeaseSpec#holderIdentity
   */
  readonly holderIdentity?: string;
  /**
   * leaseDurationSeconds is a duration that candidates for a lease need to wait to force acquire it. This is measure against time of last observed RenewTime.
   *
   * @schema io.k8s.api.coordination.v1.LeaseSpec#leaseDurationSeconds
   */
  readonly leaseDurationSeconds?: number;
  /**
   * leaseTransitions is the number of transitions of a lease between holders.
   *
   * @schema io.k8s.api.coordination.v1.LeaseSpec#leaseTransitions
   */
  readonly leaseTransitions?: number;
  /**
   * renewTime is a time when the current holder of a lease has last updated the lease.
   *
   * @schema io.k8s.api.coordination.v1.LeaseSpec#renewTime
   */
  readonly renewTime?: Date;
}
/**
 * Converts an object of type 'LeaseSpec' to JSON representation.
 */
export declare function toJson_LeaseSpec(
  obj: LeaseSpec | undefined,
): Record<string, any> | undefined;
/**
 * ObjectReference contains enough information to let you inspect or modify the referred object.
 *
 * @schema io.k8s.api.core.v1.ObjectReference
 */
export interface ObjectReference {
  /**
   * API version of the referent.
   *
   * @schema io.k8s.api.core.v1.ObjectReference#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * If referring to a piece of an object instead of an entire object, this string should contain a valid JSON/Go field access statement, such as desiredState.manifest.containers[2]. For example, if the object reference is to a container within a pod, this would take on a value like: "spec.containers{name}" (where "name" refers to the name of the container that triggered the event) or if no container name is specified "spec.containers[2]" (container with index 2 in this pod). This syntax is chosen only to have some well-defined way of referencing a part of an object.
   *
   * @schema io.k8s.api.core.v1.ObjectReference#fieldPath
   */
  readonly fieldPath?: string;
  /**
   * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.api.core.v1.ObjectReference#kind
   */
  readonly kind?: string;
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.ObjectReference#name
   */
  readonly name?: string;
  /**
   * Namespace of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/
   *
   * @schema io.k8s.api.core.v1.ObjectReference#namespace
   */
  readonly namespace?: string;
  /**
   * Specific resourceVersion to which this reference is made, if any. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#concurrency-control-and-consistency
   *
   * @schema io.k8s.api.core.v1.ObjectReference#resourceVersion
   */
  readonly resourceVersion?: string;
  /**
   * UID of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#uids
   *
   * @schema io.k8s.api.core.v1.ObjectReference#uid
   */
  readonly uid?: string;
}
/**
 * Converts an object of type 'ObjectReference' to JSON representation.
 */
export declare function toJson_ObjectReference(
  obj: ObjectReference | undefined,
): Record<string, any> | undefined;
/**
 * Information about the condition of a component.
 *
 * @schema io.k8s.api.core.v1.ComponentCondition
 */
export interface ComponentCondition {
  /**
   * Condition error code for a component. For example, a health check error code.
   *
   * @schema io.k8s.api.core.v1.ComponentCondition#error
   */
  readonly error?: string;
  /**
   * Message about the condition for a component. For example, information about a health check.
   *
   * @schema io.k8s.api.core.v1.ComponentCondition#message
   */
  readonly message?: string;
  /**
   * Status of the condition for a component. Valid values for "Healthy": "True", "False", or "Unknown".
   *
   * @schema io.k8s.api.core.v1.ComponentCondition#status
   */
  readonly status: string;
  /**
   * Type of condition for a component. Valid value: "Healthy"
   *
   * @schema io.k8s.api.core.v1.ComponentCondition#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'ComponentCondition' to JSON representation.
 */
export declare function toJson_ComponentCondition(
  obj: ComponentCondition | undefined,
): Record<string, any> | undefined;
/**
 * EndpointSubset is a group of addresses with a common set of ports. The expanded set of endpoints is the Cartesian product of Addresses x Ports. For example, given:
 * {
 * Addresses: [{"ip": "10.10.1.1"}, {"ip": "10.10.2.2"}],
 * Ports:     [{"name": "a", "port": 8675}, {"name": "b", "port": 309}]
 * }
 * The resulting set of endpoints can be viewed as:
 * a: [ 10.10.1.1:8675, 10.10.2.2:8675 ],
 * b: [ 10.10.1.1:309, 10.10.2.2:309 ]
 *
 * @schema io.k8s.api.core.v1.EndpointSubset
 */
export interface EndpointSubset {
  /**
   * IP addresses which offer the related ports that are marked as ready. These endpoints should be considered safe for load balancers and clients to utilize.
   *
   * @schema io.k8s.api.core.v1.EndpointSubset#addresses
   */
  readonly addresses?: EndpointAddress[];
  /**
   * IP addresses which offer the related ports but are not currently marked as ready because they have not yet finished starting, have recently failed a readiness check, or have recently failed a liveness check.
   *
   * @schema io.k8s.api.core.v1.EndpointSubset#notReadyAddresses
   */
  readonly notReadyAddresses?: EndpointAddress[];
  /**
   * Port numbers available on the related IP addresses.
   *
   * @schema io.k8s.api.core.v1.EndpointSubset#ports
   */
  readonly ports?: EndpointPort[];
}
/**
 * Converts an object of type 'EndpointSubset' to JSON representation.
 */
export declare function toJson_EndpointSubset(
  obj: EndpointSubset | undefined,
): Record<string, any> | undefined;
/**
 * EventSource contains information for an event.
 *
 * @schema io.k8s.api.core.v1.EventSource
 */
export interface EventSource {
  /**
   * Component from which the event is generated.
   *
   * @schema io.k8s.api.core.v1.EventSource#component
   */
  readonly component?: string;
  /**
   * Node name on which the event is generated.
   *
   * @schema io.k8s.api.core.v1.EventSource#host
   */
  readonly host?: string;
}
/**
 * Converts an object of type 'EventSource' to JSON representation.
 */
export declare function toJson_EventSource(
  obj: EventSource | undefined,
): Record<string, any> | undefined;
/**
 * EventSeries contain information on series of events, i.e. thing that was/is happening continuously for some time. How often to update the EventSeries is up to the event reporters. The default event reporter in "k8s.io/client-go/tools/events/event_broadcaster.go" shows how this struct is updated on heartbeats and can guide customized reporter implementations.
 *
 * @schema io.k8s.api.events.v1.EventSeries
 */
export interface EventSeries {
  /**
   * count is the number of occurrences in this series up to the last heartbeat time.
   *
   * @schema io.k8s.api.events.v1.EventSeries#count
   */
  readonly count: number;
  /**
   * lastObservedTime is the time when last Event from the series was seen before last heartbeat.
   *
   * @schema io.k8s.api.events.v1.EventSeries#lastObservedTime
   */
  readonly lastObservedTime: Date;
}
/**
 * Converts an object of type 'EventSeries' to JSON representation.
 */
export declare function toJson_EventSeries(
  obj: EventSeries | undefined,
): Record<string, any> | undefined;
/**
 * LimitRangeSpec defines a min/max usage limit for resources that match on kind.
 *
 * @schema io.k8s.api.core.v1.LimitRangeSpec
 */
export interface LimitRangeSpec {
  /**
   * Limits is the list of LimitRangeItem objects that are enforced.
   *
   * @schema io.k8s.api.core.v1.LimitRangeSpec#limits
   */
  readonly limits: LimitRangeItem[];
}
/**
 * Converts an object of type 'LimitRangeSpec' to JSON representation.
 */
export declare function toJson_LimitRangeSpec(
  obj: LimitRangeSpec | undefined,
): Record<string, any> | undefined;
/**
 * NamespaceSpec describes the attributes on a Namespace.
 *
 * @schema io.k8s.api.core.v1.NamespaceSpec
 */
export interface NamespaceSpec {
  /**
   * Finalizers is an opaque list of values that must be empty to permanently remove object from storage. More info: https://kubernetes.io/docs/tasks/administer-cluster/namespaces/
   *
   * @schema io.k8s.api.core.v1.NamespaceSpec#finalizers
   */
  readonly finalizers?: string[];
}
/**
 * Converts an object of type 'NamespaceSpec' to JSON representation.
 */
export declare function toJson_NamespaceSpec(
  obj: NamespaceSpec | undefined,
): Record<string, any> | undefined;
/**
 * NodeSpec describes the attributes that a node is created with.
 *
 * @schema io.k8s.api.core.v1.NodeSpec
 */
export interface NodeSpec {
  /**
   * Deprecated. If specified, the source of the node's configuration. The DynamicKubeletConfig feature gate must be enabled for the Kubelet to use this field. This field is deprecated as of 1.22: https://git.k8s.io/enhancements/keps/sig-node/281-dynamic-kubelet-configuration
   *
   * @schema io.k8s.api.core.v1.NodeSpec#configSource
   */
  readonly configSource?: NodeConfigSource;
  /**
   * Deprecated. Not all kubelets will set this field. Remove field after 1.13. see: https://issues.k8s.io/61966
   *
   * @schema io.k8s.api.core.v1.NodeSpec#externalID
   */
  readonly externalId?: string;
  /**
   * PodCIDR represents the pod IP range assigned to the node.
   *
   * @schema io.k8s.api.core.v1.NodeSpec#podCIDR
   */
  readonly podCidr?: string;
  /**
   * podCIDRs represents the IP ranges assigned to the node for usage by Pods on that node. If this field is specified, the 0th entry must match the podCIDR field. It may contain at most 1 value for each of IPv4 and IPv6.
   *
   * @schema io.k8s.api.core.v1.NodeSpec#podCIDRs
   */
  readonly podCidRs?: string[];
  /**
   * ID of the node assigned by the cloud provider in the format: <ProviderName>://<ProviderSpecificNodeID>
   *
   * @schema io.k8s.api.core.v1.NodeSpec#providerID
   */
  readonly providerId?: string;
  /**
   * If specified, the node's taints.
   *
   * @schema io.k8s.api.core.v1.NodeSpec#taints
   */
  readonly taints?: Taint[];
  /**
   * Unschedulable controls node schedulability of new pods. By default, node is schedulable. More info: https://kubernetes.io/docs/concepts/nodes/node/#manual-node-administration
   *
   * @schema io.k8s.api.core.v1.NodeSpec#unschedulable
   */
  readonly unschedulable?: boolean;
}
/**
 * Converts an object of type 'NodeSpec' to JSON representation.
 */
export declare function toJson_NodeSpec(
  obj: NodeSpec | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolumeSpec is the specification of a persistent volume.
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeSpec
 */
export interface PersistentVolumeSpec {
  /**
   * AccessModes contains all ways the volume can be mounted. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#accessModes
   */
  readonly accessModes?: string[];
  /**
   * AWSElasticBlockStore represents an AWS Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#awsElasticBlockStore
   */
  readonly awsElasticBlockStore?: AwsElasticBlockStoreVolumeSource;
  /**
   * AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#azureDisk
   */
  readonly azureDisk?: AzureDiskVolumeSource;
  /**
   * AzureFile represents an Azure File Service mount on the host and bind mount to the pod.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#azureFile
   */
  readonly azureFile?: AzureFilePersistentVolumeSource;
  /**
   * A description of the persistent volume's resources and capacity. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#capacity
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#capacity
   */
  readonly capacity?: {
    [key: string]: Quantity;
  };
  /**
   * CephFS represents a Ceph FS mount on the host that shares a pod's lifetime
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#cephfs
   */
  readonly cephfs?: CephFsPersistentVolumeSource;
  /**
   * Cinder represents a cinder volume attached and mounted on kubelets host machine. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#cinder
   */
  readonly cinder?: CinderPersistentVolumeSource;
  /**
   * ClaimRef is part of a bi-directional binding between PersistentVolume and PersistentVolumeClaim. Expected to be non-nil when bound. claim.VolumeName is the authoritative bind between PV and PVC. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#binding
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#claimRef
   */
  readonly claimRef?: ObjectReference;
  /**
   * CSI represents storage that is handled by an external CSI driver (Beta feature).
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#csi
   */
  readonly csi?: CsiPersistentVolumeSource;
  /**
   * FC represents a Fibre Channel resource that is attached to a kubelet's host machine and then exposed to the pod.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#fc
   */
  readonly fc?: FcVolumeSource;
  /**
   * FlexVolume represents a generic volume resource that is provisioned/attached using an exec based plugin.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#flexVolume
   */
  readonly flexVolume?: FlexPersistentVolumeSource;
  /**
   * Flocker represents a Flocker volume attached to a kubelet's host machine and exposed to the pod for its usage. This depends on the Flocker control service being running
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#flocker
   */
  readonly flocker?: FlockerVolumeSource;
  /**
   * GCEPersistentDisk represents a GCE Disk resource that is attached to a kubelet's host machine and then exposed to the pod. Provisioned by an admin. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#gcePersistentDisk
   */
  readonly gcePersistentDisk?: GcePersistentDiskVolumeSource;
  /**
   * Glusterfs represents a Glusterfs volume that is attached to a host and exposed to the pod. Provisioned by an admin. More info: https://examples.k8s.io/volumes/glusterfs/README.md
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#glusterfs
   */
  readonly glusterfs?: GlusterfsPersistentVolumeSource;
  /**
   * HostPath represents a directory on the host. Provisioned by a developer or tester. This is useful for single-node development and testing only! On-host storage is not supported in any way and WILL NOT WORK in a multi-node cluster. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#hostPath
   */
  readonly hostPath?: HostPathVolumeSource;
  /**
   * ISCSI represents an ISCSI Disk resource that is attached to a kubelet's host machine and then exposed to the pod. Provisioned by an admin.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#iscsi
   */
  readonly iscsi?: IscsiPersistentVolumeSource;
  /**
   * Local represents directly-attached storage with node affinity
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#local
   */
  readonly local?: LocalVolumeSource;
  /**
   * A list of mount options, e.g. ["ro", "soft"]. Not validated - mount will simply fail if one is invalid. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes/#mount-options
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#mountOptions
   */
  readonly mountOptions?: string[];
  /**
   * NFS represents an NFS mount on the host. Provisioned by an admin. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#nfs
   */
  readonly nfs?: NfsVolumeSource;
  /**
   * NodeAffinity defines constraints that limit what nodes this volume can be accessed from. This field influences the scheduling of pods that use this volume.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#nodeAffinity
   */
  readonly nodeAffinity?: VolumeNodeAffinity;
  /**
   * What happens to a persistent volume when released from its claim. Valid options are Retain (default for manually created PersistentVolumes), Delete (default for dynamically provisioned PersistentVolumes), and Recycle (deprecated). Recycle must be supported by the volume plugin underlying this PersistentVolume. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#reclaiming
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#persistentVolumeReclaimPolicy
   */
  readonly persistentVolumeReclaimPolicy?: string;
  /**
   * PhotonPersistentDisk represents a PhotonController persistent disk attached and mounted on kubelets host machine
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#photonPersistentDisk
   */
  readonly photonPersistentDisk?: PhotonPersistentDiskVolumeSource;
  /**
   * PortworxVolume represents a portworx volume attached and mounted on kubelets host machine
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#portworxVolume
   */
  readonly portworxVolume?: PortworxVolumeSource;
  /**
   * Quobyte represents a Quobyte mount on the host that shares a pod's lifetime
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#quobyte
   */
  readonly quobyte?: QuobyteVolumeSource;
  /**
   * RBD represents a Rados Block Device mount on the host that shares a pod's lifetime. More info: https://examples.k8s.io/volumes/rbd/README.md
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#rbd
   */
  readonly rbd?: RbdPersistentVolumeSource;
  /**
   * ScaleIO represents a ScaleIO persistent volume attached and mounted on Kubernetes nodes.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#scaleIO
   */
  readonly scaleIo?: ScaleIoPersistentVolumeSource;
  /**
   * Name of StorageClass to which this persistent volume belongs. Empty value means that this volume does not belong to any StorageClass.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#storageClassName
   */
  readonly storageClassName?: string;
  /**
   * StorageOS represents a StorageOS volume that is attached to the kubelet's host machine and mounted into the pod More info: https://examples.k8s.io/volumes/storageos/README.md
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#storageos
   */
  readonly storageos?: StorageOsPersistentVolumeSource;
  /**
   * volumeMode defines if a volume is intended to be used with a formatted filesystem or to remain in raw block state. Value of Filesystem is implied when not included in spec.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#volumeMode
   */
  readonly volumeMode?: string;
  /**
   * VsphereVolume represents a vSphere volume attached and mounted on kubelets host machine
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeSpec#vsphereVolume
   */
  readonly vsphereVolume?: VsphereVirtualDiskVolumeSource;
}
/**
 * Converts an object of type 'PersistentVolumeSpec' to JSON representation.
 */
export declare function toJson_PersistentVolumeSpec(
  obj: PersistentVolumeSpec | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolumeClaimSpec describes the common attributes of storage devices and allows a Source for provider-specific attributes
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec
 */
export interface PersistentVolumeClaimSpec {
  /**
   * AccessModes contains the desired access modes the volume should have. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#access-modes-1
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#accessModes
   */
  readonly accessModes?: string[];
  /**
   * This field can be used to specify either: * An existing VolumeSnapshot object (snapshot.storage.k8s.io/VolumeSnapshot) * An existing PVC (PersistentVolumeClaim) If the provisioner or an external controller can support the specified data source, it will create a new volume based on the contents of the specified data source. If the AnyVolumeDataSource feature gate is enabled, this field will always have the same contents as the DataSourceRef field.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#dataSource
   */
  readonly dataSource?: TypedLocalObjectReference;
  /**
   * Specifies the object from which to populate the volume with data, if a non-empty volume is desired. This may be any local object from a non-empty API group (non core object) or a PersistentVolumeClaim object. When this field is specified, volume binding will only succeed if the type of the specified object matches some installed volume populator or dynamic provisioner. This field will replace the functionality of the DataSource field and as such if both fields are non-empty, they must have the same value. For backwards compatibility, both fields (DataSource and DataSourceRef) will be set to the same value automatically if one of them is empty and the other is non-empty. There are two important differences between DataSource and DataSourceRef: * While DataSource only allows two specific types of objects, DataSourceRef
   * allows any non-core object, as well as PersistentVolumeClaim objects.
   * * While DataSource ignores disallowed values (dropping them), DataSourceRef
   * preserves all values, and generates an error if a disallowed value is
   * specified.
   * (Alpha) Using this field requires the AnyVolumeDataSource feature gate to be enabled.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#dataSourceRef
   */
  readonly dataSourceRef?: TypedLocalObjectReference;
  /**
   * Resources represents the minimum resources the volume should have. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#resources
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#resources
   */
  readonly resources?: ResourceRequirements;
  /**
   * A label query over volumes to consider for binding.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#selector
   */
  readonly selector?: LabelSelector;
  /**
   * Name of the StorageClass required by the claim. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#class-1
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#storageClassName
   */
  readonly storageClassName?: string;
  /**
   * volumeMode defines what type of volume is required by the claim. Value of Filesystem is implied when not included in claim spec.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#volumeMode
   */
  readonly volumeMode?: string;
  /**
   * VolumeName is the binding reference to the PersistentVolume backing this claim.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimSpec#volumeName
   */
  readonly volumeName?: string;
}
/**
 * Converts an object of type 'PersistentVolumeClaimSpec' to JSON representation.
 */
export declare function toJson_PersistentVolumeClaimSpec(
  obj: PersistentVolumeClaimSpec | undefined,
): Record<string, any> | undefined;
/**
 * PodSpec is a description of a pod.
 *
 * @schema io.k8s.api.core.v1.PodSpec
 */
export interface PodSpec {
  /**
   * Optional duration in seconds the pod may be active on the node relative to StartTime before the system will actively try to mark it failed and kill associated containers. Value must be a positive integer.
   *
   * @schema io.k8s.api.core.v1.PodSpec#activeDeadlineSeconds
   */
  readonly activeDeadlineSeconds?: number;
  /**
   * If specified, the pod's scheduling constraints
   *
   * @schema io.k8s.api.core.v1.PodSpec#affinity
   */
  readonly affinity?: Affinity;
  /**
   * AutomountServiceAccountToken indicates whether a service account token should be automatically mounted.
   *
   * @schema io.k8s.api.core.v1.PodSpec#automountServiceAccountToken
   */
  readonly automountServiceAccountToken?: boolean;
  /**
   * List of containers belonging to the pod. Containers cannot currently be added or removed. There must be at least one container in a Pod. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.PodSpec#containers
   */
  readonly containers: Container[];
  /**
   * Specifies the DNS parameters of a pod. Parameters specified here will be merged to the generated DNS configuration based on DNSPolicy.
   *
   * @schema io.k8s.api.core.v1.PodSpec#dnsConfig
   */
  readonly dnsConfig?: PodDnsConfig;
  /**
   * Set DNS policy for the pod. Defaults to "ClusterFirst". Valid values are 'ClusterFirstWithHostNet', 'ClusterFirst', 'Default' or 'None'. DNS parameters given in DNSConfig will be merged with the policy selected with DNSPolicy. To have DNS options set along with hostNetwork, you have to specify DNS policy explicitly to 'ClusterFirstWithHostNet'.
   *
   * @default ClusterFirst". Valid values are 'ClusterFirstWithHostNet', 'ClusterFirst', 'Default' or 'None'. DNS parameters given in DNSConfig will be merged with the policy selected with DNSPolicy. To have DNS options set along with hostNetwork, you have to specify DNS policy explicitly to 'ClusterFirstWithHostNet'.
   * @schema io.k8s.api.core.v1.PodSpec#dnsPolicy
   */
  readonly dnsPolicy?: string;
  /**
   * EnableServiceLinks indicates whether information about services should be injected into pod's environment variables, matching the syntax of Docker links. Optional: Defaults to true.
   *
   * @default true.
   * @schema io.k8s.api.core.v1.PodSpec#enableServiceLinks
   */
  readonly enableServiceLinks?: boolean;
  /**
   * List of ephemeral containers run in this pod. Ephemeral containers may be run in an existing pod to perform user-initiated actions such as debugging. This list cannot be specified when creating a pod, and it cannot be modified by updating the pod spec. In order to add an ephemeral container to an existing pod, use the pod's ephemeralcontainers subresource. This field is alpha-level and is only honored by servers that enable the EphemeralContainers feature.
   *
   * @schema io.k8s.api.core.v1.PodSpec#ephemeralContainers
   */
  readonly ephemeralContainers?: EphemeralContainer[];
  /**
   * HostAliases is an optional list of hosts and IPs that will be injected into the pod's hosts file if specified. This is only valid for non-hostNetwork pods.
   *
   * @schema io.k8s.api.core.v1.PodSpec#hostAliases
   */
  readonly hostAliases?: HostAlias[];
  /**
   * Use the host's ipc namespace. Optional: Default to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.PodSpec#hostIPC
   */
  readonly hostIpc?: boolean;
  /**
   * Host networking requested for this pod. Use the host's network namespace. If this option is set, the ports that will be used must be specified. Default to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.PodSpec#hostNetwork
   */
  readonly hostNetwork?: boolean;
  /**
   * Use the host's pid namespace. Optional: Default to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.PodSpec#hostPID
   */
  readonly hostPid?: boolean;
  /**
   * Specifies the hostname of the Pod If not specified, the pod's hostname will be set to a system-defined value.
   *
   * @schema io.k8s.api.core.v1.PodSpec#hostname
   */
  readonly hostname?: string;
  /**
   * ImagePullSecrets is an optional list of references to secrets in the same namespace to use for pulling any of the images used by this PodSpec. If specified, these secrets will be passed to individual puller implementations for them to use. For example, in the case of docker, only DockerConfig type secrets are honored. More info: https://kubernetes.io/docs/concepts/containers/images#specifying-imagepullsecrets-on-a-pod
   *
   * @schema io.k8s.api.core.v1.PodSpec#imagePullSecrets
   */
  readonly imagePullSecrets?: LocalObjectReference[];
  /**
   * List of initialization containers belonging to the pod. Init containers are executed in order prior to containers being started. If any init container fails, the pod is considered to have failed and is handled according to its restartPolicy. The name for an init container or normal container must be unique among all containers. Init containers may not have Lifecycle actions, Readiness probes, Liveness probes, or Startup probes. The resourceRequirements of an init container are taken into account during scheduling by finding the highest request/limit for each resource type, and then using the max of of that value or the sum of the normal containers. Limits are applied to init containers in a similar fashion. Init containers cannot currently be added or removed. Cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/init-containers/
   *
   * @schema io.k8s.api.core.v1.PodSpec#initContainers
   */
  readonly initContainers?: Container[];
  /**
   * NodeName is a request to schedule this pod onto a specific node. If it is non-empty, the scheduler simply schedules this pod onto that node, assuming that it fits resource requirements.
   *
   * @schema io.k8s.api.core.v1.PodSpec#nodeName
   */
  readonly nodeName?: string;
  /**
   * NodeSelector is a selector which must be true for the pod to fit on a node. Selector which must match a node's labels for the pod to be scheduled on that node. More info: https://kubernetes.io/docs/concepts/configuration/assign-pod-node/
   *
   * @schema io.k8s.api.core.v1.PodSpec#nodeSelector
   */
  readonly nodeSelector?: {
    [key: string]: string;
  };
  /**
   * Overhead represents the resource overhead associated with running a pod for a given RuntimeClass. This field will be autopopulated at admission time by the RuntimeClass admission controller. If the RuntimeClass admission controller is enabled, overhead must not be set in Pod create requests. The RuntimeClass admission controller will reject Pod create requests which have the overhead already set. If RuntimeClass is configured and selected in the PodSpec, Overhead will be set to the value defined in the corresponding RuntimeClass, otherwise it will remain unset and treated as zero. More info: https://git.k8s.io/enhancements/keps/sig-node/688-pod-overhead/README.md This field is beta-level as of Kubernetes v1.18, and is only honored by servers that enable the PodOverhead feature.
   *
   * @schema io.k8s.api.core.v1.PodSpec#overhead
   */
  readonly overhead?: {
    [key: string]: Quantity;
  };
  /**
   * PreemptionPolicy is the Policy for preempting pods with lower priority. One of Never, PreemptLowerPriority. Defaults to PreemptLowerPriority if unset. This field is beta-level, gated by the NonPreemptingPriority feature-gate.
   *
   * @default PreemptLowerPriority if unset. This field is beta-level, gated by the NonPreemptingPriority feature-gate.
   * @schema io.k8s.api.core.v1.PodSpec#preemptionPolicy
   */
  readonly preemptionPolicy?: string;
  /**
   * The priority value. Various system components use this field to find the priority of the pod. When Priority Admission Controller is enabled, it prevents users from setting this field. The admission controller populates this field from PriorityClassName. The higher the value, the higher the priority.
   *
   * @schema io.k8s.api.core.v1.PodSpec#priority
   */
  readonly priority?: number;
  /**
   * If specified, indicates the pod's priority. "system-node-critical" and "system-cluster-critical" are two special keywords which indicate the highest priorities with the former being the highest priority. Any other name must be defined by creating a PriorityClass object with that name. If not specified, the pod priority will be default or zero if there is no default.
   *
   * @schema io.k8s.api.core.v1.PodSpec#priorityClassName
   */
  readonly priorityClassName?: string;
  /**
   * If specified, all readiness gates will be evaluated for pod readiness. A pod is ready when all its containers are ready AND all conditions specified in the readiness gates have status equal to "True" More info: https://git.k8s.io/enhancements/keps/sig-network/580-pod-readiness-gates
   *
   * @schema io.k8s.api.core.v1.PodSpec#readinessGates
   */
  readonly readinessGates?: PodReadinessGate[];
  /**
   * Restart policy for all containers within the pod. One of Always, OnFailure, Never. Default to Always. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy
   *
   * @default Always. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy
   * @schema io.k8s.api.core.v1.PodSpec#restartPolicy
   */
  readonly restartPolicy?: string;
  /**
   * RuntimeClassName refers to a RuntimeClass object in the node.k8s.io group, which should be used to run this pod.  If no RuntimeClass resource matches the named class, the pod will not be run. If unset or empty, the "legacy" RuntimeClass will be used, which is an implicit class with an empty definition that uses the default runtime handler. More info: https://git.k8s.io/enhancements/keps/sig-node/585-runtime-class This is a beta feature as of Kubernetes v1.14.
   *
   * @schema io.k8s.api.core.v1.PodSpec#runtimeClassName
   */
  readonly runtimeClassName?: string;
  /**
   * If specified, the pod will be dispatched by specified scheduler. If not specified, the pod will be dispatched by default scheduler.
   *
   * @schema io.k8s.api.core.v1.PodSpec#schedulerName
   */
  readonly schedulerName?: string;
  /**
   * SecurityContext holds pod-level security attributes and common container settings. Optional: Defaults to empty.  See type description for default values of each field.
   *
   * @default empty.  See type description for default values of each field.
   * @schema io.k8s.api.core.v1.PodSpec#securityContext
   */
  readonly securityContext?: PodSecurityContext;
  /**
   * DeprecatedServiceAccount is a depreciated alias for ServiceAccountName. Deprecated: Use serviceAccountName instead.
   *
   * @schema io.k8s.api.core.v1.PodSpec#serviceAccount
   */
  readonly serviceAccount?: string;
  /**
   * ServiceAccountName is the name of the ServiceAccount to use to run this pod. More info: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/
   *
   * @schema io.k8s.api.core.v1.PodSpec#serviceAccountName
   */
  readonly serviceAccountName?: string;
  /**
   * If true the pod's hostname will be configured as the pod's FQDN, rather than the leaf name (the default). In Linux containers, this means setting the FQDN in the hostname field of the kernel (the nodename field of struct utsname). In Windows containers, this means setting the registry value of hostname for the registry key HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters to FQDN. If a pod does not have FQDN, this has no effect. Default to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.PodSpec#setHostnameAsFQDN
   */
  readonly setHostnameAsFqdn?: boolean;
  /**
   * Share a single process namespace between all of the containers in a pod. When this is set containers will be able to view and signal processes from other containers in the same pod, and the first process in each container will not be assigned PID 1. HostPID and ShareProcessNamespace cannot both be set. Optional: Default to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.PodSpec#shareProcessNamespace
   */
  readonly shareProcessNamespace?: boolean;
  /**
   * If specified, the fully qualified Pod hostname will be "<hostname>.<subdomain>.<pod namespace>.svc.<cluster domain>". If not specified, the pod will not have a domainname at all.
   *
   * @schema io.k8s.api.core.v1.PodSpec#subdomain
   */
  readonly subdomain?: string;
  /**
   * Optional duration in seconds the pod needs to terminate gracefully. May be decreased in delete request. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). If this value is nil, the default grace period will be used instead. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. Defaults to 30 seconds.
   *
   * @default 30 seconds.
   * @schema io.k8s.api.core.v1.PodSpec#terminationGracePeriodSeconds
   */
  readonly terminationGracePeriodSeconds?: number;
  /**
   * If specified, the pod's tolerations.
   *
   * @schema io.k8s.api.core.v1.PodSpec#tolerations
   */
  readonly tolerations?: Toleration[];
  /**
   * TopologySpreadConstraints describes how a group of pods ought to spread across topology domains. Scheduler will schedule pods in a way which abides by the constraints. All topologySpreadConstraints are ANDed.
   *
   * @schema io.k8s.api.core.v1.PodSpec#topologySpreadConstraints
   */
  readonly topologySpreadConstraints?: TopologySpreadConstraint[];
  /**
   * List of volumes that can be mounted by containers belonging to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes
   *
   * @schema io.k8s.api.core.v1.PodSpec#volumes
   */
  readonly volumes?: Volume[];
}
/**
 * Converts an object of type 'PodSpec' to JSON representation.
 */
export declare function toJson_PodSpec(
  obj: PodSpec | undefined,
): Record<string, any> | undefined;
/**
 * PodTemplateSpec describes the data a pod should have when created from a template
 *
 * @schema io.k8s.api.core.v1.PodTemplateSpec
 */
export interface PodTemplateSpec {
  /**
   * Standard object's metadata. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.core.v1.PodTemplateSpec#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of the pod. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.core.v1.PodTemplateSpec#spec
   */
  readonly spec?: PodSpec;
}
/**
 * Converts an object of type 'PodTemplateSpec' to JSON representation.
 */
export declare function toJson_PodTemplateSpec(
  obj: PodTemplateSpec | undefined,
): Record<string, any> | undefined;
/**
 * ReplicationControllerSpec is the specification of a replication controller.
 *
 * @schema io.k8s.api.core.v1.ReplicationControllerSpec
 */
export interface ReplicationControllerSpec {
  /**
   * Minimum number of seconds for which a newly created pod should be ready without any of its container crashing, for it to be considered available. Defaults to 0 (pod will be considered available as soon as it is ready)
   *
   * @default 0 (pod will be considered available as soon as it is ready)
   * @schema io.k8s.api.core.v1.ReplicationControllerSpec#minReadySeconds
   */
  readonly minReadySeconds?: number;
  /**
   * Replicas is the number of desired replicas. This is a pointer to distinguish between explicit zero and unspecified. Defaults to 1. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#what-is-a-replicationcontroller
   *
   * @default 1. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#what-is-a-replicationcontroller
   * @schema io.k8s.api.core.v1.ReplicationControllerSpec#replicas
   */
  readonly replicas?: number;
  /**
   * Selector is a label query over pods that should match the Replicas count. If Selector is empty, it is defaulted to the labels present on the Pod template. Label keys and values that must match in order to be controlled by this replication controller, if empty defaulted to labels on Pod template. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors
   *
   * @schema io.k8s.api.core.v1.ReplicationControllerSpec#selector
   */
  readonly selector?: {
    [key: string]: string;
  };
  /**
   * Template is the object that describes the pod that will be created if insufficient replicas are detected. This takes precedence over a TemplateRef. More info: https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller#pod-template
   *
   * @schema io.k8s.api.core.v1.ReplicationControllerSpec#template
   */
  readonly template?: PodTemplateSpec;
}
/**
 * Converts an object of type 'ReplicationControllerSpec' to JSON representation.
 */
export declare function toJson_ReplicationControllerSpec(
  obj: ReplicationControllerSpec | undefined,
): Record<string, any> | undefined;
/**
 * ResourceQuotaSpec defines the desired hard limits to enforce for Quota.
 *
 * @schema io.k8s.api.core.v1.ResourceQuotaSpec
 */
export interface ResourceQuotaSpec {
  /**
   * hard is the set of desired hard limits for each named resource. More info: https://kubernetes.io/docs/concepts/policy/resource-quotas/
   *
   * @schema io.k8s.api.core.v1.ResourceQuotaSpec#hard
   */
  readonly hard?: {
    [key: string]: Quantity;
  };
  /**
   * scopeSelector is also a collection of filters like scopes that must match each object tracked by a quota but expressed using ScopeSelectorOperator in combination with possible values. For a resource to match, both scopes AND scopeSelector (if specified in spec), must be matched.
   *
   * @schema io.k8s.api.core.v1.ResourceQuotaSpec#scopeSelector
   */
  readonly scopeSelector?: ScopeSelector;
  /**
   * A collection of filters that must match each object tracked by a quota. If not specified, the quota matches all objects.
   *
   * @schema io.k8s.api.core.v1.ResourceQuotaSpec#scopes
   */
  readonly scopes?: string[];
}
/**
 * Converts an object of type 'ResourceQuotaSpec' to JSON representation.
 */
export declare function toJson_ResourceQuotaSpec(
  obj: ResourceQuotaSpec | undefined,
): Record<string, any> | undefined;
/**
 * ServiceSpec describes the attributes that a user creates on a service.
 *
 * @schema io.k8s.api.core.v1.ServiceSpec
 */
export interface ServiceSpec {
  /**
   * allocateLoadBalancerNodePorts defines if NodePorts will be automatically allocated for services with type LoadBalancer.  Default is "true". It may be set to "false" if the cluster load-balancer does not rely on NodePorts.  If the caller requests specific NodePorts (by specifying a value), those requests will be respected, regardless of this field. This field may only be set for services with type LoadBalancer and will be cleared if the type is changed to any other type. This field is beta-level and is only honored by servers that enable the ServiceLBNodePortControl feature.
   *
   * @default true". It may be set to "false" if the cluster load-balancer does not rely on NodePorts.  If the caller requests specific NodePorts (by specifying a value), those requests will be respected, regardless of this field. This field may only be set for services with type LoadBalancer and will be cleared if the type is changed to any other type. This field is beta-level and is only honored by servers that enable the ServiceLBNodePortControl feature.
   * @schema io.k8s.api.core.v1.ServiceSpec#allocateLoadBalancerNodePorts
   */
  readonly allocateLoadBalancerNodePorts?: boolean;
  /**
   * clusterIP is the IP address of the service and is usually assigned randomly. If an address is specified manually, is in-range (as per system configuration), and is not in use, it will be allocated to the service; otherwise creation of the service will fail. This field may not be changed through updates unless the type field is also being changed to ExternalName (which requires this field to be blank) or the type field is being changed from ExternalName (in which case this field may optionally be specified, as describe above).  Valid values are "None", empty string (""), or a valid IP address. Setting this to "None" makes a "headless service" (no virtual IP), which is useful when direct endpoint connections are preferred and proxying is not required.  Only applies to types ClusterIP, NodePort, and LoadBalancer. If this field is specified when creating a Service of type ExternalName, creation will fail. This field will be wiped when updating a Service to type ExternalName. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#clusterIP
   */
  readonly clusterIp?: string;
  /**
   * ClusterIPs is a list of IP addresses assigned to this service, and are usually assigned randomly.  If an address is specified manually, is in-range (as per system configuration), and is not in use, it will be allocated to the service; otherwise creation of the service will fail. This field may not be changed through updates unless the type field is also being changed to ExternalName (which requires this field to be empty) or the type field is being changed from ExternalName (in which case this field may optionally be specified, as describe above).  Valid values are "None", empty string (""), or a valid IP address.  Setting this to "None" makes a "headless service" (no virtual IP), which is useful when direct endpoint connections are preferred and proxying is not required.  Only applies to types ClusterIP, NodePort, and LoadBalancer. If this field is specified when creating a Service of type ExternalName, creation will fail. This field will be wiped when updating a Service to type ExternalName.  If this field is not specified, it will be initialized from the clusterIP field.  If this field is specified, clients must ensure that clusterIPs[0] and clusterIP have the same value.
   *
   * Unless the "IPv6DualStack" feature gate is enabled, this field is limited to one value, which must be the same as the clusterIP field.  If the feature gate is enabled, this field may hold a maximum of two entries (dual-stack IPs, in either order).  These IPs must correspond to the values of the ipFamilies field. Both clusterIPs and ipFamilies are governed by the ipFamilyPolicy field. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#clusterIPs
   */
  readonly clusterIPs?: string[];
  /**
   * externalIPs is a list of IP addresses for which nodes in the cluster will also accept traffic for this service.  These IPs are not managed by Kubernetes.  The user is responsible for ensuring that traffic arrives at a node with this IP.  A common example is external load-balancers that are not part of the Kubernetes system.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#externalIPs
   */
  readonly externalIPs?: string[];
  /**
   * externalName is the external reference that discovery mechanisms will return as an alias for this service (e.g. a DNS CNAME record). No proxying will be involved.  Must be a lowercase RFC-1123 hostname (https://tools.ietf.org/html/rfc1123) and requires `type` to be "ExternalName".
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#externalName
   */
  readonly externalName?: string;
  /**
   * externalTrafficPolicy denotes if this Service desires to route external traffic to node-local or cluster-wide endpoints. "Local" preserves the client source IP and avoids a second hop for LoadBalancer and Nodeport type services, but risks potentially imbalanced traffic spreading. "Cluster" obscures the client source IP and may cause a second hop to another node, but should have good overall load-spreading.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#externalTrafficPolicy
   */
  readonly externalTrafficPolicy?: string;
  /**
   * healthCheckNodePort specifies the healthcheck nodePort for the service. This only applies when type is set to LoadBalancer and externalTrafficPolicy is set to Local. If a value is specified, is in-range, and is not in use, it will be used.  If not specified, a value will be automatically allocated.  External systems (e.g. load-balancers) can use this port to determine if a given node holds endpoints for this service or not.  If this field is specified when creating a Service which does not need it, creation will fail. This field will be wiped when updating a Service to no longer need it (e.g. changing type).
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#healthCheckNodePort
   */
  readonly healthCheckNodePort?: number;
  /**
   * InternalTrafficPolicy specifies if the cluster internal traffic should be routed to all endpoints or node-local endpoints only. "Cluster" routes internal traffic to a Service to all endpoints. "Local" routes traffic to node-local endpoints only, traffic is dropped if no node-local endpoints are ready. The default value is "Cluster".
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#internalTrafficPolicy
   */
  readonly internalTrafficPolicy?: string;
  /**
   * IPFamilies is a list of IP families (e.g. IPv4, IPv6) assigned to this service, and is gated by the "IPv6DualStack" feature gate.  This field is usually assigned automatically based on cluster configuration and the ipFamilyPolicy field. If this field is specified manually, the requested family is available in the cluster, and ipFamilyPolicy allows it, it will be used; otherwise creation of the service will fail.  This field is conditionally mutable: it allows for adding or removing a secondary IP family, but it does not allow changing the primary IP family of the Service.  Valid values are "IPv4" and "IPv6".  This field only applies to Services of types ClusterIP, NodePort, and LoadBalancer, and does apply to "headless" services.  This field will be wiped when updating a Service to type ExternalName.
   *
   * This field may hold a maximum of two entries (dual-stack families, in either order).  These families must correspond to the values of the clusterIPs field, if specified. Both clusterIPs and ipFamilies are governed by the ipFamilyPolicy field.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#ipFamilies
   */
  readonly ipFamilies?: string[];
  /**
   * IPFamilyPolicy represents the dual-stack-ness requested or required by this Service, and is gated by the "IPv6DualStack" feature gate.  If there is no value provided, then this field will be set to SingleStack. Services can be "SingleStack" (a single IP family), "PreferDualStack" (two IP families on dual-stack configured clusters or a single IP family on single-stack clusters), or "RequireDualStack" (two IP families on dual-stack configured clusters, otherwise fail). The ipFamilies and clusterIPs fields depend on the value of this field.  This field will be wiped when updating a service to type ExternalName.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#ipFamilyPolicy
   */
  readonly ipFamilyPolicy?: string;
  /**
   * loadBalancerClass is the class of the load balancer implementation this Service belongs to. If specified, the value of this field must be a label-style identifier, with an optional prefix, e.g. "internal-vip" or "example.com/internal-vip". Unprefixed names are reserved for end-users. This field can only be set when the Service type is 'LoadBalancer'. If not set, the default load balancer implementation is used, today this is typically done through the cloud provider integration, but should apply for any default implementation. If set, it is assumed that a load balancer implementation is watching for Services with a matching class. Any default load balancer implementation (e.g. cloud providers) should ignore Services that set this field. This field can only be set when creating or updating a Service to type 'LoadBalancer'. Once set, it can not be changed. This field will be wiped when a service is updated to a non 'LoadBalancer' type.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#loadBalancerClass
   */
  readonly loadBalancerClass?: string;
  /**
   * Only applies to Service Type: LoadBalancer LoadBalancer will get created with the IP specified in this field. This feature depends on whether the underlying cloud-provider supports specifying the loadBalancerIP when a load balancer is created. This field will be ignored if the cloud-provider does not support the feature.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#loadBalancerIP
   */
  readonly loadBalancerIp?: string;
  /**
   * If specified and supported by the platform, this will restrict traffic through the cloud-provider load-balancer will be restricted to the specified client IPs. This field will be ignored if the cloud-provider does not support the feature." More info: https://kubernetes.io/docs/tasks/access-application-cluster/create-external-load-balancer/
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#loadBalancerSourceRanges
   */
  readonly loadBalancerSourceRanges?: string[];
  /**
   * The list of ports that are exposed by this service. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#ports
   */
  readonly ports?: ServicePort[];
  /**
   * publishNotReadyAddresses indicates that any agent which deals with endpoints for this Service should disregard any indications of ready/not-ready. The primary use case for setting this field is for a StatefulSet's Headless Service to propagate SRV DNS records for its Pods for the purpose of peer discovery. The Kubernetes controllers that generate Endpoints and EndpointSlice resources for Services interpret this to mean that all endpoints are considered "ready" even if the Pods themselves are not. Agents which consume only Kubernetes generated endpoints through the Endpoints or EndpointSlice resources can safely assume this behavior.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#publishNotReadyAddresses
   */
  readonly publishNotReadyAddresses?: boolean;
  /**
   * Route service traffic to pods with label keys and values matching this selector. If empty or not present, the service is assumed to have an external process managing its endpoints, which Kubernetes will not modify. Only applies to types ClusterIP, NodePort, and LoadBalancer. Ignored if type is ExternalName. More info: https://kubernetes.io/docs/concepts/services-networking/service/
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#selector
   */
  readonly selector?: {
    [key: string]: string;
  };
  /**
   * Supports "ClientIP" and "None". Used to maintain session affinity. Enable client IP based session affinity. Must be ClientIP or None. Defaults to None. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies
   *
   * @default None. More info: https://kubernetes.io/docs/concepts/services-networking/service/#virtual-ips-and-service-proxies
   * @schema io.k8s.api.core.v1.ServiceSpec#sessionAffinity
   */
  readonly sessionAffinity?: string;
  /**
   * sessionAffinityConfig contains the configurations of session affinity.
   *
   * @schema io.k8s.api.core.v1.ServiceSpec#sessionAffinityConfig
   */
  readonly sessionAffinityConfig?: SessionAffinityConfig;
  /**
   * type determines how the Service is exposed. Defaults to ClusterIP. Valid options are ExternalName, ClusterIP, NodePort, and LoadBalancer. "ClusterIP" allocates a cluster-internal IP address for load-balancing to endpoints. Endpoints are determined by the selector or if that is not specified, by manual construction of an Endpoints object or EndpointSlice objects. If clusterIP is "None", no virtual IP is allocated and the endpoints are published as a set of endpoints rather than a virtual IP. "NodePort" builds on ClusterIP and allocates a port on every node which routes to the same endpoints as the clusterIP. "LoadBalancer" builds on NodePort and creates an external load-balancer (if supported in the current cloud) which routes to the same endpoints as the clusterIP. "ExternalName" aliases this service to the specified externalName. Several other fields do not apply to ExternalName services. More info: https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types
   *
   * @default ClusterIP. Valid options are ExternalName, ClusterIP, NodePort, and LoadBalancer. "ClusterIP" allocates a cluster-internal IP address for load-balancing to endpoints. Endpoints are determined by the selector or if that is not specified, by manual construction of an Endpoints object or EndpointSlice objects. If clusterIP is "None", no virtual IP is allocated and the endpoints are published as a set of endpoints rather than a virtual IP. "NodePort" builds on ClusterIP and allocates a port on every node which routes to the same endpoints as the clusterIP. "LoadBalancer" builds on NodePort and creates an external load-balancer (if supported in the current cloud) which routes to the same endpoints as the clusterIP. "ExternalName" aliases this service to the specified externalName. Several other fields do not apply to ExternalName services. More info: https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types
   * @schema io.k8s.api.core.v1.ServiceSpec#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'ServiceSpec' to JSON representation.
 */
export declare function toJson_ServiceSpec(
  obj: ServiceSpec | undefined,
): Record<string, any> | undefined;
/**
 * LocalObjectReference contains enough information to let you locate the referenced object inside the same namespace.
 *
 * @schema io.k8s.api.core.v1.LocalObjectReference
 */
export interface LocalObjectReference {
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.LocalObjectReference#name
   */
  readonly name?: string;
}
/**
 * Converts an object of type 'LocalObjectReference' to JSON representation.
 */
export declare function toJson_LocalObjectReference(
  obj: LocalObjectReference | undefined,
): Record<string, any> | undefined;
/**
 * Endpoint represents a single logical "backend" implementing a service.
 *
 * @schema io.k8s.api.discovery.v1.Endpoint
 */
export interface Endpoint {
  /**
   * addresses of this endpoint. The contents of this field are interpreted according to the corresponding EndpointSlice addressType field. Consumers must handle different types of addresses in the context of their own capabilities. This must contain at least one address but no more than 100.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#addresses
   */
  readonly addresses: string[];
  /**
   * conditions contains information about the current status of the endpoint.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#conditions
   */
  readonly conditions?: EndpointConditions;
  /**
   * deprecatedTopology contains topology information part of the v1beta1 API. This field is deprecated, and will be removed when the v1beta1 API is removed (no sooner than kubernetes v1.24).  While this field can hold values, it is not writable through the v1 API, and any attempts to write to it will be silently ignored. Topology information can be found in the zone and nodeName fields instead.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#deprecatedTopology
   */
  readonly deprecatedTopology?: {
    [key: string]: string;
  };
  /**
   * hints contains information associated with how an endpoint should be consumed.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#hints
   */
  readonly hints?: EndpointHints;
  /**
   * hostname of this endpoint. This field may be used by consumers of endpoints to distinguish endpoints from each other (e.g. in DNS names). Multiple endpoints which use the same hostname should be considered fungible (e.g. multiple A values in DNS). Must be lowercase and pass DNS Label (RFC 1123) validation.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#hostname
   */
  readonly hostname?: string;
  /**
   * nodeName represents the name of the Node hosting this endpoint. This can be used to determine endpoints local to a Node. This field can be enabled with the EndpointSliceNodeName feature gate.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#nodeName
   */
  readonly nodeName?: string;
  /**
   * targetRef is a reference to a Kubernetes object that represents this endpoint.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#targetRef
   */
  readonly targetRef?: ObjectReference;
  /**
   * zone is the name of the Zone this endpoint exists in.
   *
   * @schema io.k8s.api.discovery.v1.Endpoint#zone
   */
  readonly zone?: string;
}
/**
 * Converts an object of type 'Endpoint' to JSON representation.
 */
export declare function toJson_Endpoint(
  obj: Endpoint | undefined,
): Record<string, any> | undefined;
/**
 * EndpointPort is a tuple that describes a single port.
 *
 * @schema io.k8s.api.core.v1.EndpointPort
 */
export interface EndpointPort {
  /**
   * The application protocol for this port. This field follows standard Kubernetes label syntax. Un-prefixed names are reserved for IANA standard service names (as per RFC-6335 and http://www.iana.org/assignments/service-names). Non-standard protocols should use prefixed names such as mycompany.com/my-custom-protocol.
   *
   * @schema io.k8s.api.core.v1.EndpointPort#appProtocol
   */
  readonly appProtocol?: string;
  /**
   * The name of this port.  This must match the 'name' field in the corresponding ServicePort. Must be a DNS_LABEL. Optional only if one port is defined.
   *
   * @schema io.k8s.api.core.v1.EndpointPort#name
   */
  readonly name?: string;
  /**
   * The port number of the endpoint.
   *
   * @schema io.k8s.api.core.v1.EndpointPort#port
   */
  readonly port: number;
  /**
   * The IP protocol for this port. Must be UDP, TCP, or SCTP. Default is TCP.
   *
   * @default TCP.
   * @schema io.k8s.api.core.v1.EndpointPort#protocol
   */
  readonly protocol?: string;
}
/**
 * Converts an object of type 'EndpointPort' to JSON representation.
 */
export declare function toJson_EndpointPort(
  obj: EndpointPort | undefined,
): Record<string, any> | undefined;
/**
 * Endpoint represents a single logical "backend" implementing a service.
 *
 * @schema io.k8s.api.discovery.v1beta1.Endpoint
 */
export interface EndpointV1Beta1 {
  /**
   * addresses of this endpoint. The contents of this field are interpreted according to the corresponding EndpointSlice addressType field. Consumers must handle different types of addresses in the context of their own capabilities. This must contain at least one address but no more than 100.
   *
   * @schema io.k8s.api.discovery.v1beta1.Endpoint#addresses
   */
  readonly addresses: string[];
  /**
   * conditions contains information about the current status of the endpoint.
   *
   * @schema io.k8s.api.discovery.v1beta1.Endpoint#conditions
   */
  readonly conditions?: EndpointConditionsV1Beta1;
  /**
   * hints contains information associated with how an endpoint should be consumed.
   *
   * @schema io.k8s.api.discovery.v1beta1.Endpoint#hints
   */
  readonly hints?: EndpointHintsV1Beta1;
  /**
   * hostname of this endpoint. This field may be used by consumers of endpoints to distinguish endpoints from each other (e.g. in DNS names). Multiple endpoints which use the same hostname should be considered fungible (e.g. multiple A values in DNS). Must be lowercase and pass DNS Label (RFC 1123) validation.
   *
   * @schema io.k8s.api.discovery.v1beta1.Endpoint#hostname
   */
  readonly hostname?: string;
  /**
   * nodeName represents the name of the Node hosting this endpoint. This can be used to determine endpoints local to a Node. This field can be enabled with the EndpointSliceNodeName feature gate.
   *
   * @schema io.k8s.api.discovery.v1beta1.Endpoint#nodeName
   */
  readonly nodeName?: string;
  /**
   * targetRef is a reference to a Kubernetes object that represents this endpoint.
   *
   * @schema io.k8s.api.discovery.v1beta1.Endpoint#targetRef
   */
  readonly targetRef?: ObjectReference;
  /**
   * topology contains arbitrary topology information associated with the endpoint. These key/value pairs must conform with the label format. https://kubernetes.io/docs/concepts/overview/working-with-objects/labels Topology may include a maximum of 16 key/value pairs. This includes, but is not limited to the following well known keys: * kubernetes.io/hostname: the value indicates the hostname of the node
   * where the endpoint is located. This should match the corresponding
   * node label.
   * * topology.kubernetes.io/zone: the value indicates the zone where the
   * endpoint is located. This should match the corresponding node label.
   * * topology.kubernetes.io/region: the value indicates the region where the
   * endpoint is located. This should match the corresponding node label.
   * This field is deprecated and will be removed in future api versions.
   *
   * @schema io.k8s.api.discovery.v1beta1.Endpoint#topology
   */
  readonly topology?: {
    [key: string]: string;
  };
}
/**
 * Converts an object of type 'EndpointV1Beta1' to JSON representation.
 */
export declare function toJson_EndpointV1Beta1(
  obj: EndpointV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * EndpointPort represents a Port used by an EndpointSlice
 *
 * @schema io.k8s.api.discovery.v1beta1.EndpointPort
 */
export interface EndpointPortV1Beta1 {
  /**
   * The application protocol for this port. This field follows standard Kubernetes label syntax. Un-prefixed names are reserved for IANA standard service names (as per RFC-6335 and http://www.iana.org/assignments/service-names). Non-standard protocols should use prefixed names such as mycompany.com/my-custom-protocol.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointPort#appProtocol
   */
  readonly appProtocol?: string;
  /**
   * The name of this port. All ports in an EndpointSlice must have a unique name. If the EndpointSlice is dervied from a Kubernetes service, this corresponds to the Service.ports[].name. Name must either be an empty string or pass DNS_LABEL validation: * must be no more than 63 characters long. * must consist of lower case alphanumeric characters or '-'. * must start and end with an alphanumeric character. Default is empty string.
   *
   * @default empty string.
   * @schema io.k8s.api.discovery.v1beta1.EndpointPort#name
   */
  readonly name?: string;
  /**
   * The port number of the endpoint. If this is not specified, ports are not restricted and must be interpreted in the context of the specific consumer.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointPort#port
   */
  readonly port?: number;
  /**
   * The IP protocol for this port. Must be UDP, TCP, or SCTP. Default is TCP.
   *
   * @default TCP.
   * @schema io.k8s.api.discovery.v1beta1.EndpointPort#protocol
   */
  readonly protocol?: string;
}
/**
 * Converts an object of type 'EndpointPortV1Beta1' to JSON representation.
 */
export declare function toJson_EndpointPortV1Beta1(
  obj: EndpointPortV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * EventSeries contain information on series of events, i.e. thing that was/is happening continuously for some time.
 *
 * @schema io.k8s.api.events.v1beta1.EventSeries
 */
export interface EventSeriesV1Beta1 {
  /**
   * count is the number of occurrences in this series up to the last heartbeat time.
   *
   * @schema io.k8s.api.events.v1beta1.EventSeries#count
   */
  readonly count: number;
  /**
   * lastObservedTime is the time when last Event from the series was seen before last heartbeat.
   *
   * @schema io.k8s.api.events.v1beta1.EventSeries#lastObservedTime
   */
  readonly lastObservedTime: Date;
}
/**
 * Converts an object of type 'EventSeriesV1Beta1' to JSON representation.
 */
export declare function toJson_EventSeriesV1Beta1(
  obj: EventSeriesV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * FlowSchemaSpec describes how the FlowSchema's specification looks like.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaSpec
 */
export interface FlowSchemaSpecV1Beta1 {
  /**
   * `distinguisherMethod` defines how to compute the flow distinguisher for requests that match this schema. `nil` specifies that the distinguisher is disabled and thus will always be the empty string.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaSpec#distinguisherMethod
   */
  readonly distinguisherMethod?: FlowDistinguisherMethodV1Beta1;
  /**
   * `matchingPrecedence` is used to choose among the FlowSchemas that match a given request. The chosen FlowSchema is among those with the numerically lowest (which we take to be logically highest) MatchingPrecedence.  Each MatchingPrecedence value must be ranged in [1,10000]. Note that if the precedence is not specified, it will be set to 1000 as default.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaSpec#matchingPrecedence
   */
  readonly matchingPrecedence?: number;
  /**
   * `priorityLevelConfiguration` should reference a PriorityLevelConfiguration in the cluster. If the reference cannot be resolved, the FlowSchema will be ignored and marked as invalid in its status. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaSpec#priorityLevelConfiguration
   */
  readonly priorityLevelConfiguration: PriorityLevelConfigurationReferenceV1Beta1;
  /**
   * `rules` describes which requests will match this flow schema. This FlowSchema matches a request if and only if at least one member of rules matches the request. if it is an empty slice, there will be no requests matching the FlowSchema.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowSchemaSpec#rules
   */
  readonly rules?: PolicyRulesWithSubjectsV1Beta1[];
}
/**
 * Converts an object of type 'FlowSchemaSpecV1Beta1' to JSON representation.
 */
export declare function toJson_FlowSchemaSpecV1Beta1(
  obj: FlowSchemaSpecV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * PriorityLevelConfigurationSpec specifies the configuration of a priority level.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationSpec
 */
export interface PriorityLevelConfigurationSpecV1Beta1 {
  /**
   * `limited` specifies how requests are handled for a Limited priority level. This field must be non-empty if and only if `type` is `"Limited"`.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationSpec#limited
   */
  readonly limited?: LimitedPriorityLevelConfigurationV1Beta1;
  /**
   * `type` indicates whether this priority level is subject to limitation on request execution.  A value of `"Exempt"` means that requests of this priority level are not subject to a limit (and thus are never queued) and do not detract from the capacity made available to other priority levels.  A value of `"Limited"` means that (a) requests of this priority level _are_ subject to limits and (b) some of the server's limited capacity is made available exclusively to this priority level. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationSpec#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'PriorityLevelConfigurationSpecV1Beta1' to JSON representation.
 */
export declare function toJson_PriorityLevelConfigurationSpecV1Beta1(
  obj: PriorityLevelConfigurationSpecV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * IngressSpec describes the Ingress the user wishes to exist.
 *
 * @schema io.k8s.api.networking.v1.IngressSpec
 */
export interface IngressSpec {
  /**
   * DefaultBackend is the backend that should handle requests that don't match any rule. If Rules are not specified, DefaultBackend must be specified. If DefaultBackend is not set, the handling of requests that do not match any of the rules will be up to the Ingress controller.
   *
   * @schema io.k8s.api.networking.v1.IngressSpec#defaultBackend
   */
  readonly defaultBackend?: IngressBackend;
  /**
   * IngressClassName is the name of the IngressClass cluster resource. The associated IngressClass defines which controller will implement the resource. This replaces the deprecated `kubernetes.io/ingress.class` annotation. For backwards compatibility, when that annotation is set, it must be given precedence over this field. The controller may emit a warning if the field and annotation have different values. Implementations of this API should ignore Ingresses without a class specified. An IngressClass resource may be marked as default, which can be used to set a default value for this field. For more information, refer to the IngressClass documentation.
   *
   * @schema io.k8s.api.networking.v1.IngressSpec#ingressClassName
   */
  readonly ingressClassName?: string;
  /**
   * A list of host rules used to configure the Ingress. If unspecified, or no rule matches, all traffic is sent to the default backend.
   *
   * @schema io.k8s.api.networking.v1.IngressSpec#rules
   */
  readonly rules?: IngressRule[];
  /**
   * TLS configuration. Currently the Ingress only supports a single TLS port, 443. If multiple members of this list specify different hosts, they will be multiplexed on the same port according to the hostname specified through the SNI TLS extension, if the ingress controller fulfilling the ingress supports SNI.
   *
   * @schema io.k8s.api.networking.v1.IngressSpec#tls
   */
  readonly tls?: IngressTls[];
}
/**
 * Converts an object of type 'IngressSpec' to JSON representation.
 */
export declare function toJson_IngressSpec(
  obj: IngressSpec | undefined,
): Record<string, any> | undefined;
/**
 * IngressClassSpec provides information about the class of an Ingress.
 *
 * @schema io.k8s.api.networking.v1.IngressClassSpec
 */
export interface IngressClassSpec {
  /**
   * Controller refers to the name of the controller that should handle this class. This allows for different "flavors" that are controlled by the same controller. For example, you may have different Parameters for the same implementing controller. This should be specified as a domain-prefixed path no more than 250 characters in length, e.g. "acme.io/ingress-controller". This field is immutable.
   *
   * @schema io.k8s.api.networking.v1.IngressClassSpec#controller
   */
  readonly controller?: string;
  /**
   * Parameters is a link to a custom resource containing additional configuration for the controller. This is optional if the controller does not require extra parameters.
   *
   * @schema io.k8s.api.networking.v1.IngressClassSpec#parameters
   */
  readonly parameters?: IngressClassParametersReference;
}
/**
 * Converts an object of type 'IngressClassSpec' to JSON representation.
 */
export declare function toJson_IngressClassSpec(
  obj: IngressClassSpec | undefined,
): Record<string, any> | undefined;
/**
 * NetworkPolicySpec provides the specification of a NetworkPolicy
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicySpec
 */
export interface NetworkPolicySpec {
  /**
   * List of egress rules to be applied to the selected pods. Outgoing traffic is allowed if there are no NetworkPolicies selecting the pod (and cluster policy otherwise allows the traffic), OR if the traffic matches at least one egress rule across all of the NetworkPolicy objects whose podSelector matches the pod. If this field is empty then this NetworkPolicy limits all outgoing traffic (and serves solely to ensure that the pods it selects are isolated by default). This field is beta-level in 1.8
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicySpec#egress
   */
  readonly egress?: NetworkPolicyEgressRule[];
  /**
   * List of ingress rules to be applied to the selected pods. Traffic is allowed to a pod if there are no NetworkPolicies selecting the pod (and cluster policy otherwise allows the traffic), OR if the traffic source is the pod's local node, OR if the traffic matches at least one ingress rule across all of the NetworkPolicy objects whose podSelector matches the pod. If this field is empty then this NetworkPolicy does not allow any traffic (and serves solely to ensure that the pods it selects are isolated by default)
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicySpec#ingress
   */
  readonly ingress?: NetworkPolicyIngressRule[];
  /**
   * Selects the pods to which this NetworkPolicy object applies. The array of ingress rules is applied to any pods selected by this field. Multiple network policies can select the same set of pods. In this case, the ingress rules for each are combined additively. This field is NOT optional and follows standard label selector semantics. An empty podSelector matches all pods in this namespace.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicySpec#podSelector
   */
  readonly podSelector: LabelSelector;
  /**
   * List of rule types that the NetworkPolicy relates to. Valid options are ["Ingress"], ["Egress"], or ["Ingress", "Egress"]. If this field is not specified, it will default based on the existence of Ingress or Egress rules; policies that contain an Egress section are assumed to affect Egress, and all policies (whether or not they contain an Ingress section) are assumed to affect Ingress. If you want to write an egress-only policy, you must explicitly specify policyTypes [ "Egress" ]. Likewise, if you want to write a policy that specifies that no egress is allowed, you must specify a policyTypes value that include "Egress" (since such a policy would not include an Egress section and would otherwise default to just [ "Ingress" ]). This field is beta-level in 1.8
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicySpec#policyTypes
   */
  readonly policyTypes?: string[];
}
/**
 * Converts an object of type 'NetworkPolicySpec' to JSON representation.
 */
export declare function toJson_NetworkPolicySpec(
  obj: NetworkPolicySpec | undefined,
): Record<string, any> | undefined;
/**
 * Overhead structure represents the resource overhead associated with running a pod.
 *
 * @schema io.k8s.api.node.v1.Overhead
 */
export interface Overhead {
  /**
   * PodFixed represents the fixed resource overhead associated with running a pod.
   *
   * @schema io.k8s.api.node.v1.Overhead#podFixed
   */
  readonly podFixed?: {
    [key: string]: Quantity;
  };
}
/**
 * Converts an object of type 'Overhead' to JSON representation.
 */
export declare function toJson_Overhead(
  obj: Overhead | undefined,
): Record<string, any> | undefined;
/**
 * Scheduling specifies the scheduling constraints for nodes supporting a RuntimeClass.
 *
 * @schema io.k8s.api.node.v1.Scheduling
 */
export interface Scheduling {
  /**
   * nodeSelector lists labels that must be present on nodes that support this RuntimeClass. Pods using this RuntimeClass can only be scheduled to a node matched by this selector. The RuntimeClass nodeSelector is merged with a pod's existing nodeSelector. Any conflicts will cause the pod to be rejected in admission.
   *
   * @schema io.k8s.api.node.v1.Scheduling#nodeSelector
   */
  readonly nodeSelector?: {
    [key: string]: string;
  };
  /**
   * tolerations are appended (excluding duplicates) to pods running with this RuntimeClass during admission, effectively unioning the set of nodes tolerated by the pod and the RuntimeClass.
   *
   * @schema io.k8s.api.node.v1.Scheduling#tolerations
   */
  readonly tolerations?: Toleration[];
}
/**
 * Converts an object of type 'Scheduling' to JSON representation.
 */
export declare function toJson_Scheduling(
  obj: Scheduling | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClassSpec is a specification of a RuntimeClass. It contains parameters that are required to describe the RuntimeClass to the Container Runtime Interface (CRI) implementation, as well as any other components that need to understand how the pod will be run. The RuntimeClassSpec is immutable.
 *
 * @schema io.k8s.api.node.v1alpha1.RuntimeClassSpec
 */
export interface RuntimeClassSpecV1Alpha1 {
  /**
   * Overhead represents the resource overhead associated with running a pod for a given RuntimeClass. For more details, see https://git.k8s.io/enhancements/keps/sig-node/688-pod-overhead/README.md This field is beta-level as of Kubernetes v1.18, and is only honored by servers that enable the PodOverhead feature.
   *
   * @schema io.k8s.api.node.v1alpha1.RuntimeClassSpec#overhead
   */
  readonly overhead?: OverheadV1Alpha1;
  /**
   * RuntimeHandler specifies the underlying runtime and configuration that the CRI implementation will use to handle pods of this class. The possible values are specific to the node & CRI configuration.  It is assumed that all handlers are available on every node, and handlers of the same name are equivalent on every node. For example, a handler called "runc" might specify that the runc OCI runtime (using native Linux containers) will be used to run the containers in a pod. The RuntimeHandler must be lowercase, conform to the DNS Label (RFC 1123) requirements, and is immutable.
   *
   * @schema io.k8s.api.node.v1alpha1.RuntimeClassSpec#runtimeHandler
   */
  readonly runtimeHandler: string;
  /**
   * Scheduling holds the scheduling constraints to ensure that pods running with this RuntimeClass are scheduled to nodes that support it. If scheduling is nil, this RuntimeClass is assumed to be supported by all nodes.
   *
   * @schema io.k8s.api.node.v1alpha1.RuntimeClassSpec#scheduling
   */
  readonly scheduling?: SchedulingV1Alpha1;
}
/**
 * Converts an object of type 'RuntimeClassSpecV1Alpha1' to JSON representation.
 */
export declare function toJson_RuntimeClassSpecV1Alpha1(
  obj: RuntimeClassSpecV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * Overhead structure represents the resource overhead associated with running a pod.
 *
 * @schema io.k8s.api.node.v1beta1.Overhead
 */
export interface OverheadV1Beta1 {
  /**
   * PodFixed represents the fixed resource overhead associated with running a pod.
   *
   * @schema io.k8s.api.node.v1beta1.Overhead#podFixed
   */
  readonly podFixed?: {
    [key: string]: Quantity;
  };
}
/**
 * Converts an object of type 'OverheadV1Beta1' to JSON representation.
 */
export declare function toJson_OverheadV1Beta1(
  obj: OverheadV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * Scheduling specifies the scheduling constraints for nodes supporting a RuntimeClass.
 *
 * @schema io.k8s.api.node.v1beta1.Scheduling
 */
export interface SchedulingV1Beta1 {
  /**
   * nodeSelector lists labels that must be present on nodes that support this RuntimeClass. Pods using this RuntimeClass can only be scheduled to a node matched by this selector. The RuntimeClass nodeSelector is merged with a pod's existing nodeSelector. Any conflicts will cause the pod to be rejected in admission.
   *
   * @schema io.k8s.api.node.v1beta1.Scheduling#nodeSelector
   */
  readonly nodeSelector?: {
    [key: string]: string;
  };
  /**
   * tolerations are appended (excluding duplicates) to pods running with this RuntimeClass during admission, effectively unioning the set of nodes tolerated by the pod and the RuntimeClass.
   *
   * @schema io.k8s.api.node.v1beta1.Scheduling#tolerations
   */
  readonly tolerations?: Toleration[];
}
/**
 * Converts an object of type 'SchedulingV1Beta1' to JSON representation.
 */
export declare function toJson_SchedulingV1Beta1(
  obj: SchedulingV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * DeleteOptions may be provided when deleting an API object.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions
 */
export interface DeleteOptions {
  /**
   * APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * When present, indicates that modifications should not be persisted. An invalid or unrecognized dryRun directive will result in an error response and no further processing of the request. Valid values are: - All: all dry run stages will be processed
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions#dryRun
   */
  readonly dryRun?: string[];
  /**
   * The duration in seconds before the object should be deleted. Value must be non-negative integer. The value zero indicates delete immediately. If this value is nil, the default grace period for the specified type will be used. Defaults to a per object value if not specified. zero means delete immediately.
   *
   * @default a per object value if not specified. zero means delete immediately.
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions#gracePeriodSeconds
   */
  readonly gracePeriodSeconds?: number;
  /**
   * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions#kind
   */
  readonly kind?: IoK8SApimachineryPkgApisMetaV1DeleteOptionsKind;
  /**
   * Deprecated: please use the PropagationPolicy, this field will be deprecated in 1.7. Should the dependent objects be orphaned. If true/false, the "orphan" finalizer will be added to/removed from the object's finalizers list. Either this field or PropagationPolicy may be set, but not both.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions#orphanDependents
   */
  readonly orphanDependents?: boolean;
  /**
   * Must be fulfilled before a deletion is carried out. If not possible, a 409 Conflict status will be returned.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions#preconditions
   */
  readonly preconditions?: Preconditions;
  /**
   * Whether and how garbage collection will be performed. Either this field or OrphanDependents may be set, but not both. The default policy is decided by the existing finalizer set in the metadata.finalizers and the resource-specific default policy. Acceptable values are: 'Orphan' - orphan the dependents; 'Background' - allow the garbage collector to delete the dependents in the background; 'Foreground' - a cascading policy that deletes all dependents in the foreground.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.DeleteOptions#propagationPolicy
   */
  readonly propagationPolicy?: string;
}
/**
 * Converts an object of type 'DeleteOptions' to JSON representation.
 */
export declare function toJson_DeleteOptions(
  obj: DeleteOptions | undefined,
): Record<string, any> | undefined;
/**
 * PodDisruptionBudgetSpec is a description of a PodDisruptionBudget.
 *
 * @schema io.k8s.api.policy.v1.PodDisruptionBudgetSpec
 */
export interface PodDisruptionBudgetSpec {
  /**
   * An eviction is allowed if at most "maxUnavailable" pods selected by "selector" are unavailable after the eviction, i.e. even in absence of the evicted pod. For example, one can prevent all voluntary evictions by specifying 0. This is a mutually exclusive setting with "minAvailable".
   *
   * @schema io.k8s.api.policy.v1.PodDisruptionBudgetSpec#maxUnavailable
   */
  readonly maxUnavailable?: IntOrString;
  /**
   * An eviction is allowed if at least "minAvailable" pods selected by "selector" will still be available after the eviction, i.e. even in the absence of the evicted pod.  So for example you can prevent all voluntary evictions by specifying "100%".
   *
   * @schema io.k8s.api.policy.v1.PodDisruptionBudgetSpec#minAvailable
   */
  readonly minAvailable?: IntOrString;
  /**
   * Label query over pods whose evictions are managed by the disruption budget. A null selector will match no pods, while an empty ({}) selector will select all pods within the namespace.
   *
   * @schema io.k8s.api.policy.v1.PodDisruptionBudgetSpec#selector
   */
  readonly selector?: LabelSelector;
}
/**
 * Converts an object of type 'PodDisruptionBudgetSpec' to JSON representation.
 */
export declare function toJson_PodDisruptionBudgetSpec(
  obj: PodDisruptionBudgetSpec | undefined,
): Record<string, any> | undefined;
/**
 * PodDisruptionBudgetSpec is a description of a PodDisruptionBudget.
 *
 * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetSpec
 */
export interface PodDisruptionBudgetSpecV1Beta1 {
  /**
   * An eviction is allowed if at most "maxUnavailable" pods selected by "selector" are unavailable after the eviction, i.e. even in absence of the evicted pod. For example, one can prevent all voluntary evictions by specifying 0. This is a mutually exclusive setting with "minAvailable".
   *
   * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetSpec#maxUnavailable
   */
  readonly maxUnavailable?: IntOrString;
  /**
   * An eviction is allowed if at least "minAvailable" pods selected by "selector" will still be available after the eviction, i.e. even in the absence of the evicted pod.  So for example you can prevent all voluntary evictions by specifying "100%".
   *
   * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetSpec#minAvailable
   */
  readonly minAvailable?: IntOrString;
  /**
   * Label query over pods whose evictions are managed by the disruption budget. A null selector selects no pods. An empty selector ({}) also selects no pods, which differs from standard behavior of selecting all pods. In policy/v1, an empty selector will select all pods in the namespace.
   *
   * @schema io.k8s.api.policy.v1beta1.PodDisruptionBudgetSpec#selector
   */
  readonly selector?: LabelSelector;
}
/**
 * Converts an object of type 'PodDisruptionBudgetSpecV1Beta1' to JSON representation.
 */
export declare function toJson_PodDisruptionBudgetSpecV1Beta1(
  obj: PodDisruptionBudgetSpecV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * PodSecurityPolicySpec defines the policy enforced.
 *
 * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec
 */
export interface PodSecurityPolicySpecV1Beta1 {
  /**
   * allowPrivilegeEscalation determines if a pod can request to allow privilege escalation. If unspecified, defaults to true.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#allowPrivilegeEscalation
   */
  readonly allowPrivilegeEscalation?: boolean;
  /**
   * AllowedCSIDrivers is an allowlist of inline CSI drivers that must be explicitly set to be embedded within a pod spec. An empty value indicates that any CSI driver can be used for inline ephemeral volumes. This is a beta field, and is only honored if the API server enables the CSIInlineVolume feature gate.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#allowedCSIDrivers
   */
  readonly allowedCsiDrivers?: AllowedCsiDriverV1Beta1[];
  /**
   * allowedCapabilities is a list of capabilities that can be requested to add to the container. Capabilities in this field may be added at the pod author's discretion. You must not list a capability in both allowedCapabilities and requiredDropCapabilities.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#allowedCapabilities
   */
  readonly allowedCapabilities?: string[];
  /**
   * allowedFlexVolumes is an allowlist of Flexvolumes.  Empty or nil indicates that all Flexvolumes may be used.  This parameter is effective only when the usage of the Flexvolumes is allowed in the "volumes" field.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#allowedFlexVolumes
   */
  readonly allowedFlexVolumes?: AllowedFlexVolumeV1Beta1[];
  /**
   * allowedHostPaths is an allowlist of host paths. Empty indicates that all host paths may be used.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#allowedHostPaths
   */
  readonly allowedHostPaths?: AllowedHostPathV1Beta1[];
  /**
   * AllowedProcMountTypes is an allowlist of allowed ProcMountTypes. Empty or nil indicates that only the DefaultProcMountType may be used. This requires the ProcMountType feature flag to be enabled.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#allowedProcMountTypes
   */
  readonly allowedProcMountTypes?: string[];
  /**
   * allowedUnsafeSysctls is a list of explicitly allowed unsafe sysctls, defaults to none. Each entry is either a plain sysctl name or ends in "*" in which case it is considered as a prefix of allowed sysctls. Single * means all unsafe sysctls are allowed. Kubelet has to allowlist all allowed unsafe sysctls explicitly to avoid rejection.
   *
   * Examples: e.g. "foo/*" allows "foo/bar", "foo/baz", etc. e.g. "foo.*" allows "foo.bar", "foo.baz", etc.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#allowedUnsafeSysctls
   */
  readonly allowedUnsafeSysctls?: string[];
  /**
   * defaultAddCapabilities is the default set of capabilities that will be added to the container unless the pod spec specifically drops the capability.  You may not list a capability in both defaultAddCapabilities and requiredDropCapabilities. Capabilities added here are implicitly allowed, and need not be included in the allowedCapabilities list.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#defaultAddCapabilities
   */
  readonly defaultAddCapabilities?: string[];
  /**
   * defaultAllowPrivilegeEscalation controls the default setting for whether a process can gain more privileges than its parent process.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#defaultAllowPrivilegeEscalation
   */
  readonly defaultAllowPrivilegeEscalation?: boolean;
  /**
   * forbiddenSysctls is a list of explicitly forbidden sysctls, defaults to none. Each entry is either a plain sysctl name or ends in "*" in which case it is considered as a prefix of forbidden sysctls. Single * means all sysctls are forbidden.
   *
   * Examples: e.g. "foo/*" forbids "foo/bar", "foo/baz", etc. e.g. "foo.*" forbids "foo.bar", "foo.baz", etc.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#forbiddenSysctls
   */
  readonly forbiddenSysctls?: string[];
  /**
   * fsGroup is the strategy that will dictate what fs group is used by the SecurityContext.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#fsGroup
   */
  readonly fsGroup: FsGroupStrategyOptionsV1Beta1;
  /**
   * hostIPC determines if the policy allows the use of HostIPC in the pod spec.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#hostIPC
   */
  readonly hostIpc?: boolean;
  /**
   * hostNetwork determines if the policy allows the use of HostNetwork in the pod spec.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#hostNetwork
   */
  readonly hostNetwork?: boolean;
  /**
   * hostPID determines if the policy allows the use of HostPID in the pod spec.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#hostPID
   */
  readonly hostPid?: boolean;
  /**
   * hostPorts determines which host port ranges are allowed to be exposed.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#hostPorts
   */
  readonly hostPorts?: HostPortRangeV1Beta1[];
  /**
   * privileged determines if a pod can request to be run as privileged.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#privileged
   */
  readonly privileged?: boolean;
  /**
   * readOnlyRootFilesystem when set to true will force containers to run with a read only root file system.  If the container specifically requests to run with a non-read only root file system the PSP should deny the pod. If set to false the container may run with a read only root file system if it wishes but it will not be forced to.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#readOnlyRootFilesystem
   */
  readonly readOnlyRootFilesystem?: boolean;
  /**
   * requiredDropCapabilities are the capabilities that will be dropped from the container.  These are required to be dropped and cannot be added.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#requiredDropCapabilities
   */
  readonly requiredDropCapabilities?: string[];
  /**
   * RunAsGroup is the strategy that will dictate the allowable RunAsGroup values that may be set. If this field is omitted, the pod's RunAsGroup can take any value. This field requires the RunAsGroup feature gate to be enabled.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#runAsGroup
   */
  readonly runAsGroup?: RunAsGroupStrategyOptionsV1Beta1;
  /**
   * runAsUser is the strategy that will dictate the allowable RunAsUser values that may be set.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#runAsUser
   */
  readonly runAsUser: RunAsUserStrategyOptionsV1Beta1;
  /**
   * runtimeClass is the strategy that will dictate the allowable RuntimeClasses for a pod. If this field is omitted, the pod's runtimeClassName field is unrestricted. Enforcement of this field depends on the RuntimeClass feature gate being enabled.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#runtimeClass
   */
  readonly runtimeClass?: RuntimeClassStrategyOptionsV1Beta1;
  /**
   * seLinux is the strategy that will dictate the allowable labels that may be set.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#seLinux
   */
  readonly seLinux: SeLinuxStrategyOptionsV1Beta1;
  /**
   * supplementalGroups is the strategy that will dictate what supplemental groups are used by the SecurityContext.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#supplementalGroups
   */
  readonly supplementalGroups: SupplementalGroupsStrategyOptionsV1Beta1;
  /**
   * volumes is an allowlist of volume plugins. Empty indicates that no volumes may be used. To allow all volumes you may use '*'.
   *
   * @schema io.k8s.api.policy.v1beta1.PodSecurityPolicySpec#volumes
   */
  readonly volumes?: string[];
}
/**
 * Converts an object of type 'PodSecurityPolicySpecV1Beta1' to JSON representation.
 */
export declare function toJson_PodSecurityPolicySpecV1Beta1(
  obj: PodSecurityPolicySpecV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * AggregationRule describes how to locate ClusterRoles to aggregate into the ClusterRole
 *
 * @schema io.k8s.api.rbac.v1.AggregationRule
 */
export interface AggregationRule {
  /**
   * ClusterRoleSelectors holds a list of selectors which will be used to find ClusterRoles and create the rules. If any of the selectors match, then the ClusterRole's permissions will be added
   *
   * @schema io.k8s.api.rbac.v1.AggregationRule#clusterRoleSelectors
   */
  readonly clusterRoleSelectors?: LabelSelector[];
}
/**
 * Converts an object of type 'AggregationRule' to JSON representation.
 */
export declare function toJson_AggregationRule(
  obj: AggregationRule | undefined,
): Record<string, any> | undefined;
/**
 * PolicyRule holds information that describes a policy rule, but does not contain information about who the rule applies to or which namespace the rule applies to.
 *
 * @schema io.k8s.api.rbac.v1.PolicyRule
 */
export interface PolicyRule {
  /**
   * APIGroups is the name of the APIGroup that contains the resources.  If multiple API groups are specified, any action requested against one of the enumerated resources in any API group will be allowed.
   *
   * @schema io.k8s.api.rbac.v1.PolicyRule#apiGroups
   */
  readonly apiGroups?: string[];
  /**
   * NonResourceURLs is a set of partial urls that a user should have access to.  *s are allowed, but only as the full, final step in the path Since non-resource URLs are not namespaced, this field is only applicable for ClusterRoles referenced from a ClusterRoleBinding. Rules can either apply to API resources (such as "pods" or "secrets") or non-resource URL paths (such as "/api"),  but not both.
   *
   * @schema io.k8s.api.rbac.v1.PolicyRule#nonResourceURLs
   */
  readonly nonResourceUrLs?: string[];
  /**
   * ResourceNames is an optional white list of names that the rule applies to.  An empty set means that everything is allowed.
   *
   * @schema io.k8s.api.rbac.v1.PolicyRule#resourceNames
   */
  readonly resourceNames?: string[];
  /**
   * Resources is a list of resources this rule applies to. '*' represents all resources.
   *
   * @schema io.k8s.api.rbac.v1.PolicyRule#resources
   */
  readonly resources?: string[];
  /**
   * Verbs is a list of Verbs that apply to ALL the ResourceKinds and AttributeRestrictions contained in this rule. '*' represents all verbs.
   *
   * @schema io.k8s.api.rbac.v1.PolicyRule#verbs
   */
  readonly verbs: string[];
}
/**
 * Converts an object of type 'PolicyRule' to JSON representation.
 */
export declare function toJson_PolicyRule(
  obj: PolicyRule | undefined,
): Record<string, any> | undefined;
/**
 * RoleRef contains information that points to the role being used
 *
 * @schema io.k8s.api.rbac.v1.RoleRef
 */
export interface RoleRef {
  /**
   * APIGroup is the group for the resource being referenced
   *
   * @schema io.k8s.api.rbac.v1.RoleRef#apiGroup
   */
  readonly apiGroup: string;
  /**
   * Kind is the type of resource being referenced
   *
   * @schema io.k8s.api.rbac.v1.RoleRef#kind
   */
  readonly kind: string;
  /**
   * Name is the name of resource being referenced
   *
   * @schema io.k8s.api.rbac.v1.RoleRef#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'RoleRef' to JSON representation.
 */
export declare function toJson_RoleRef(
  obj: RoleRef | undefined,
): Record<string, any> | undefined;
/**
 * Subject contains a reference to the object or user identities a role binding applies to.  This can either hold a direct API object reference, or a value for non-objects such as user and group names.
 *
 * @schema io.k8s.api.rbac.v1.Subject
 */
export interface Subject {
  /**
   * APIGroup holds the API group of the referenced subject. Defaults to "" for ServiceAccount subjects. Defaults to "rbac.authorization.k8s.io" for User and Group subjects.
   *
   * @default for ServiceAccount subjects. Defaults to "rbac.authorization.k8s.io" for User and Group subjects.
   * @schema io.k8s.api.rbac.v1.Subject#apiGroup
   */
  readonly apiGroup?: string;
  /**
   * Kind of object being referenced. Values defined by this API group are "User", "Group", and "ServiceAccount". If the Authorizer does not recognized the kind value, the Authorizer should report an error.
   *
   * @schema io.k8s.api.rbac.v1.Subject#kind
   */
  readonly kind: string;
  /**
   * Name of the object being referenced.
   *
   * @schema io.k8s.api.rbac.v1.Subject#name
   */
  readonly name: string;
  /**
   * Namespace of the referenced object.  If the object kind is non-namespace, such as "User" or "Group", and this value is not empty the Authorizer should report an error.
   *
   * @schema io.k8s.api.rbac.v1.Subject#namespace
   */
  readonly namespace?: string;
}
/**
 * Converts an object of type 'Subject' to JSON representation.
 */
export declare function toJson_Subject(
  obj: Subject | undefined,
): Record<string, any> | undefined;
/**
 * AggregationRule describes how to locate ClusterRoles to aggregate into the ClusterRole
 *
 * @schema io.k8s.api.rbac.v1alpha1.AggregationRule
 */
export interface AggregationRuleV1Alpha1 {
  /**
   * ClusterRoleSelectors holds a list of selectors which will be used to find ClusterRoles and create the rules. If any of the selectors match, then the ClusterRole's permissions will be added
   *
   * @schema io.k8s.api.rbac.v1alpha1.AggregationRule#clusterRoleSelectors
   */
  readonly clusterRoleSelectors?: LabelSelector[];
}
/**
 * Converts an object of type 'AggregationRuleV1Alpha1' to JSON representation.
 */
export declare function toJson_AggregationRuleV1Alpha1(
  obj: AggregationRuleV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * PolicyRule holds information that describes a policy rule, but does not contain information about who the rule applies to or which namespace the rule applies to.
 *
 * @schema io.k8s.api.rbac.v1alpha1.PolicyRule
 */
export interface PolicyRuleV1Alpha1 {
  /**
   * APIGroups is the name of the APIGroup that contains the resources.  If multiple API groups are specified, any action requested against one of the enumerated resources in any API group will be allowed.
   *
   * @schema io.k8s.api.rbac.v1alpha1.PolicyRule#apiGroups
   */
  readonly apiGroups?: string[];
  /**
   * NonResourceURLs is a set of partial urls that a user should have access to.  *s are allowed, but only as the full, final step in the path Since non-resource URLs are not namespaced, this field is only applicable for ClusterRoles referenced from a ClusterRoleBinding. Rules can either apply to API resources (such as "pods" or "secrets") or non-resource URL paths (such as "/api"),  but not both.
   *
   * @schema io.k8s.api.rbac.v1alpha1.PolicyRule#nonResourceURLs
   */
  readonly nonResourceUrLs?: string[];
  /**
   * ResourceNames is an optional white list of names that the rule applies to.  An empty set means that everything is allowed.
   *
   * @schema io.k8s.api.rbac.v1alpha1.PolicyRule#resourceNames
   */
  readonly resourceNames?: string[];
  /**
   * Resources is a list of resources this rule applies to. '*' represents all resources.
   *
   * @schema io.k8s.api.rbac.v1alpha1.PolicyRule#resources
   */
  readonly resources?: string[];
  /**
   * Verbs is a list of Verbs that apply to ALL the ResourceKinds and AttributeRestrictions contained in this rule. '*' represents all verbs.
   *
   * @schema io.k8s.api.rbac.v1alpha1.PolicyRule#verbs
   */
  readonly verbs: string[];
}
/**
 * Converts an object of type 'PolicyRuleV1Alpha1' to JSON representation.
 */
export declare function toJson_PolicyRuleV1Alpha1(
  obj: PolicyRuleV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * RoleRef contains information that points to the role being used
 *
 * @schema io.k8s.api.rbac.v1alpha1.RoleRef
 */
export interface RoleRefV1Alpha1 {
  /**
   * APIGroup is the group for the resource being referenced
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleRef#apiGroup
   */
  readonly apiGroup: string;
  /**
   * Kind is the type of resource being referenced
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleRef#kind
   */
  readonly kind: string;
  /**
   * Name is the name of resource being referenced
   *
   * @schema io.k8s.api.rbac.v1alpha1.RoleRef#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'RoleRefV1Alpha1' to JSON representation.
 */
export declare function toJson_RoleRefV1Alpha1(
  obj: RoleRefV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * Subject contains a reference to the object or user identities a role binding applies to.  This can either hold a direct API object reference, or a value for non-objects such as user and group names.
 *
 * @schema io.k8s.api.rbac.v1alpha1.Subject
 */
export interface SubjectV1Alpha1 {
  /**
   * APIVersion holds the API group and version of the referenced subject. Defaults to "v1" for ServiceAccount subjects. Defaults to "rbac.authorization.k8s.io/v1alpha1" for User and Group subjects.
   *
   * @default v1" for ServiceAccount subjects. Defaults to "rbac.authorization.k8s.io/v1alpha1" for User and Group subjects.
   * @schema io.k8s.api.rbac.v1alpha1.Subject#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * Kind of object being referenced. Values defined by this API group are "User", "Group", and "ServiceAccount". If the Authorizer does not recognized the kind value, the Authorizer should report an error.
   *
   * @schema io.k8s.api.rbac.v1alpha1.Subject#kind
   */
  readonly kind: string;
  /**
   * Name of the object being referenced.
   *
   * @schema io.k8s.api.rbac.v1alpha1.Subject#name
   */
  readonly name: string;
  /**
   * Namespace of the referenced object.  If the object kind is non-namespace, such as "User" or "Group", and this value is not empty the Authorizer should report an error.
   *
   * @schema io.k8s.api.rbac.v1alpha1.Subject#namespace
   */
  readonly namespace?: string;
}
/**
 * Converts an object of type 'SubjectV1Alpha1' to JSON representation.
 */
export declare function toJson_SubjectV1Alpha1(
  obj: SubjectV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * CSIDriverSpec is the specification of a CSIDriver.
 *
 * @schema io.k8s.api.storage.v1.CSIDriverSpec
 */
export interface CsiDriverSpec {
  /**
   * attachRequired indicates this CSI volume driver requires an attach operation (because it implements the CSI ControllerPublishVolume() method), and that the Kubernetes attach detach controller should call the attach volume interface which checks the volumeattachment status and waits until the volume is attached before proceeding to mounting. The CSI external-attacher coordinates with CSI volume driver and updates the volumeattachment status when the attach operation is complete. If the CSIDriverRegistry feature gate is enabled and the value is specified to false, the attach operation will be skipped. Otherwise the attach operation will be called.
   *
   * This field is immutable.
   *
   * @schema io.k8s.api.storage.v1.CSIDriverSpec#attachRequired
   */
  readonly attachRequired?: boolean;
  /**
   * Defines if the underlying volume supports changing ownership and permission of the volume before being mounted. Refer to the specific FSGroupPolicy values for additional details. This field is beta, and is only honored by servers that enable the CSIVolumeFSGroupPolicy feature gate.
   *
   * This field is immutable.
   *
   * Defaults to ReadWriteOnceWithFSType, which will examine each volume to determine if Kubernetes should modify ownership and permissions of the volume. With the default policy the defined fsGroup will only be applied if a fstype is defined and the volume's access mode contains ReadWriteOnce.
   *
   * @default ReadWriteOnceWithFSType, which will examine each volume to determine if Kubernetes should modify ownership and permissions of the volume. With the default policy the defined fsGroup will only be applied if a fstype is defined and the volume's access mode contains ReadWriteOnce.
   * @schema io.k8s.api.storage.v1.CSIDriverSpec#fsGroupPolicy
   */
  readonly fsGroupPolicy?: string;
  /**
   * If set to true, podInfoOnMount indicates this CSI volume driver requires additional pod information (like podName, podUID, etc.) during mount operations. If set to false, pod information will not be passed on mount. Default is false. The CSI driver specifies podInfoOnMount as part of driver deployment. If true, Kubelet will pass pod information as VolumeContext in the CSI NodePublishVolume() calls. The CSI driver is responsible for parsing and validating the information passed in as VolumeContext. The following VolumeConext will be passed if podInfoOnMount is set to true. This list might grow, but the prefix will be used. "csi.storage.k8s.io/pod.name": pod.Name "csi.storage.k8s.io/pod.namespace": pod.Namespace "csi.storage.k8s.io/pod.uid": string(pod.UID) "csi.storage.k8s.io/ephemeral": "true" if the volume is an ephemeral inline volume
   * defined by a CSIVolumeSource, otherwise "false"
   *
   * "csi.storage.k8s.io/ephemeral" is a new feature in Kubernetes 1.16. It is only required for drivers which support both the "Persistent" and "Ephemeral" VolumeLifecycleMode. Other drivers can leave pod info disabled and/or ignore this field. As Kubernetes 1.15 doesn't support this field, drivers can only support one mode when deployed on such a cluster and the deployment determines which mode that is, for example via a command line parameter of the driver.
   *
   * This field is immutable.
   *
   * @default false. The CSI driver specifies podInfoOnMount as part of driver deployment. If true, Kubelet will pass pod information as VolumeContext in the CSI NodePublishVolume() calls. The CSI driver is responsible for parsing and validating the information passed in as VolumeContext. The following VolumeConext will be passed if podInfoOnMount is set to true. This list might grow, but the prefix will be used. "csi.storage.k8s.io/pod.name": pod.Name "csi.storage.k8s.io/pod.namespace": pod.Namespace "csi.storage.k8s.io/pod.uid": string(pod.UID) "csi.storage.k8s.io/ephemeral": "true" if the volume is an ephemeral inline volume
   * @schema io.k8s.api.storage.v1.CSIDriverSpec#podInfoOnMount
   */
  readonly podInfoOnMount?: boolean;
  /**
   * RequiresRepublish indicates the CSI driver wants `NodePublishVolume` being periodically called to reflect any possible change in the mounted volume. This field defaults to false.
   *
   * Note: After a successful initial NodePublishVolume call, subsequent calls to NodePublishVolume should only update the contents of the volume. New mount points will not be seen by a running container.
   *
   * @schema io.k8s.api.storage.v1.CSIDriverSpec#requiresRepublish
   */
  readonly requiresRepublish?: boolean;
  /**
   * If set to true, storageCapacity indicates that the CSI volume driver wants pod scheduling to consider the storage capacity that the driver deployment will report by creating CSIStorageCapacity objects with capacity information.
   *
   * The check can be enabled immediately when deploying a driver. In that case, provisioning new volumes with late binding will pause until the driver deployment has published some suitable CSIStorageCapacity object.
   *
   * Alternatively, the driver can be deployed with the field unset or false and it can be flipped later when storage capacity information has been published.
   *
   * This field is immutable.
   *
   * This is a beta field and only available when the CSIStorageCapacity feature is enabled. The default is false.
   *
   * @schema io.k8s.api.storage.v1.CSIDriverSpec#storageCapacity
   */
  readonly storageCapacity?: boolean;
  /**
   * TokenRequests indicates the CSI driver needs pods' service account tokens it is mounting volume for to do necessary authentication. Kubelet will pass the tokens in VolumeContext in the CSI NodePublishVolume calls. The CSI driver should parse and validate the following VolumeContext: "csi.storage.k8s.io/serviceAccount.tokens": {
   * "<audience>": {
   * "token": <token>,
   * "expirationTimestamp": <expiration timestamp in RFC3339>,
   * },
   * ...
   * }
   *
   * Note: Audience in each TokenRequest should be different and at most one token is empty string. To receive a new token after expiry, RequiresRepublish can be used to trigger NodePublishVolume periodically.
   *
   * @schema io.k8s.api.storage.v1.CSIDriverSpec#tokenRequests
   */
  readonly tokenRequests?: TokenRequest[];
  /**
   * volumeLifecycleModes defines what kind of volumes this CSI volume driver supports. The default if the list is empty is "Persistent", which is the usage defined by the CSI specification and implemented in Kubernetes via the usual PV/PVC mechanism. The other mode is "Ephemeral". In this mode, volumes are defined inline inside the pod spec with CSIVolumeSource and their lifecycle is tied to the lifecycle of that pod. A driver has to be aware of this because it is only going to get a NodePublishVolume call for such a volume. For more information about implementing this mode, see https://kubernetes-csi.github.io/docs/ephemeral-local-volumes.html A driver can support one or more of these modes and more modes may be added in the future. This field is beta.
   *
   * This field is immutable.
   *
   * @schema io.k8s.api.storage.v1.CSIDriverSpec#volumeLifecycleModes
   */
  readonly volumeLifecycleModes?: string[];
}
/**
 * Converts an object of type 'CsiDriverSpec' to JSON representation.
 */
export declare function toJson_CsiDriverSpec(
  obj: CsiDriverSpec | undefined,
): Record<string, any> | undefined;
/**
 * CSINodeSpec holds information about the specification of all CSI drivers installed on a node
 *
 * @schema io.k8s.api.storage.v1.CSINodeSpec
 */
export interface CsiNodeSpec {
  /**
   * drivers is a list of information of all CSI Drivers existing on a node. If all drivers in the list are uninstalled, this can become empty.
   *
   * @schema io.k8s.api.storage.v1.CSINodeSpec#drivers
   */
  readonly drivers: CsiNodeDriver[];
}
/**
 * Converts an object of type 'CsiNodeSpec' to JSON representation.
 */
export declare function toJson_CsiNodeSpec(
  obj: CsiNodeSpec | undefined,
): Record<string, any> | undefined;
/**
 * A topology selector term represents the result of label queries. A null or empty topology selector term matches no objects. The requirements of them are ANDed. It provides a subset of functionality as NodeSelectorTerm. This is an alpha feature and may change in the future.
 *
 * @schema io.k8s.api.core.v1.TopologySelectorTerm
 */
export interface TopologySelectorTerm {
  /**
   * A list of topology selector requirements by labels.
   *
   * @schema io.k8s.api.core.v1.TopologySelectorTerm#matchLabelExpressions
   */
  readonly matchLabelExpressions?: TopologySelectorLabelRequirement[];
}
/**
 * Converts an object of type 'TopologySelectorTerm' to JSON representation.
 */
export declare function toJson_TopologySelectorTerm(
  obj: TopologySelectorTerm | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachmentSpec is the specification of a VolumeAttachment request.
 *
 * @schema io.k8s.api.storage.v1.VolumeAttachmentSpec
 */
export interface VolumeAttachmentSpec {
  /**
   * Attacher indicates the name of the volume driver that MUST handle this request. This is the name returned by GetPluginName().
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachmentSpec#attacher
   */
  readonly attacher: string;
  /**
   * The node that the volume should be attached to.
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachmentSpec#nodeName
   */
  readonly nodeName: string;
  /**
   * Source represents the volume that should be attached.
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachmentSpec#source
   */
  readonly source: VolumeAttachmentSource;
}
/**
 * Converts an object of type 'VolumeAttachmentSpec' to JSON representation.
 */
export declare function toJson_VolumeAttachmentSpec(
  obj: VolumeAttachmentSpec | undefined,
): Record<string, any> | undefined;
/**
 * @schema io.k8s.apimachinery.pkg.api.resource.Quantity
 */
export declare class Quantity {
  readonly value: any;
  static fromString(value: string): Quantity;
  static fromNumber(value: number): Quantity;
  private constructor();
}
/**
 * A label selector is a label query over a set of resources. The result of matchLabels and matchExpressions are ANDed. An empty label selector matches all objects. A null label selector matches no objects.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelector
 */
export interface LabelSelector {
  /**
   * matchExpressions is a list of label selector requirements. The requirements are ANDed.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelector#matchExpressions
   */
  readonly matchExpressions?: LabelSelectorRequirement[];
  /**
   * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelector#matchLabels
   */
  readonly matchLabels?: {
    [key: string]: string;
  };
}
/**
 * Converts an object of type 'LabelSelector' to JSON representation.
 */
export declare function toJson_LabelSelector(
  obj: LabelSelector | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachmentSpec is the specification of a VolumeAttachment request.
 *
 * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentSpec
 */
export interface VolumeAttachmentSpecV1Alpha1 {
  /**
   * Attacher indicates the name of the volume driver that MUST handle this request. This is the name returned by GetPluginName().
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentSpec#attacher
   */
  readonly attacher: string;
  /**
   * The node that the volume should be attached to.
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentSpec#nodeName
   */
  readonly nodeName: string;
  /**
   * Source represents the volume that should be attached.
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentSpec#source
   */
  readonly source: VolumeAttachmentSourceV1Alpha1;
}
/**
 * Converts an object of type 'VolumeAttachmentSpecV1Alpha1' to JSON representation.
 */
export declare function toJson_VolumeAttachmentSpecV1Alpha1(
  obj: VolumeAttachmentSpecV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceDefinitionSpec describes how a user wants their resource to appear
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionSpec
 */
export interface CustomResourceDefinitionSpec {
  /**
   * conversion defines conversion settings for the CRD.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionSpec#conversion
   */
  readonly conversion?: CustomResourceConversion;
  /**
   * group is the API group of the defined custom resource. The custom resources are served under `/apis/<group>/...`. Must match the name of the CustomResourceDefinition (in the form `<names.plural>.<group>`).
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionSpec#group
   */
  readonly group: string;
  /**
   * names specify the resource and kind names for the custom resource.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionSpec#names
   */
  readonly names: CustomResourceDefinitionNames;
  /**
   * preserveUnknownFields indicates that object fields which are not specified in the OpenAPI schema should be preserved when persisting to storage. apiVersion, kind, metadata and known fields inside metadata are always preserved. This field is deprecated in favor of setting `x-preserve-unknown-fields` to true in `spec.versions[*].schema.openAPIV3Schema`. See https://kubernetes.io/docs/tasks/access-kubernetes-api/custom-resources/custom-resource-definitions/#pruning-versus-preserving-unknown-fields for details.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionSpec#preserveUnknownFields
   */
  readonly preserveUnknownFields?: boolean;
  /**
   * scope indicates whether the defined custom resource is cluster- or namespace-scoped. Allowed values are `Cluster` and `Namespaced`.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionSpec#scope
   */
  readonly scope: string;
  /**
   * versions is the list of all API versions of the defined custom resource. Version names are used to compute the order in which served versions are listed in API discovery. If the version string is "kube-like", it will sort above non "kube-like" version strings, which are ordered lexicographically. "Kube-like" versions start with a "v", then are followed by a number (the major version), then optionally the string "alpha" or "beta" and another number (the minor version). These are sorted first by GA > beta > alpha (where GA is a version with no suffix such as beta or alpha), and then by comparing major version, then minor version. An example sorted list of versions: v10, v2, v1, v11beta2, v10beta3, v3beta1, v12alpha1, v11alpha2, foo1, foo10.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionSpec#versions
   */
  readonly versions: CustomResourceDefinitionVersion[];
}
/**
 * Converts an object of type 'CustomResourceDefinitionSpec' to JSON representation.
 */
export declare function toJson_CustomResourceDefinitionSpec(
  obj: CustomResourceDefinitionSpec | undefined,
): Record<string, any> | undefined;
/**
 * StatusDetails is a set of additional properties that MAY be set by the server to provide additional information about a response. The Reason field of a Status object defines what attributes will be set. Clients must ignore fields that do not match the defined type of each attribute, and should assume that any attribute may be empty, invalid, or under defined.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusDetails
 */
export interface StatusDetails {
  /**
   * The Causes array includes more details associated with the StatusReason failure. Not all StatusReasons may provide detailed causes.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusDetails#causes
   */
  readonly causes?: StatusCause[];
  /**
   * The group attribute of the resource associated with the status StatusReason.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusDetails#group
   */
  readonly group?: string;
  /**
   * The kind attribute of the resource associated with the status StatusReason. On some operations may differ from the requested resource Kind. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusDetails#kind
   */
  readonly kind?: string;
  /**
   * The name attribute of the resource associated with the status StatusReason (when there is a single name which can be described).
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusDetails#name
   */
  readonly name?: string;
  /**
   * If specified, the time in seconds before the operation should be retried. Some errors may indicate the client must take an alternate action - for those errors this field may indicate how long to wait before taking the alternate action.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusDetails#retryAfterSeconds
   */
  readonly retryAfterSeconds?: number;
  /**
   * UID of the resource. (when there is a single resource which can be described). More info: http://kubernetes.io/docs/user-guide/identifiers#uids
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusDetails#uid
   */
  readonly uid?: string;
}
/**
 * Converts an object of type 'StatusDetails' to JSON representation.
 */
export declare function toJson_StatusDetails(
  obj: StatusDetails | undefined,
): Record<string, any> | undefined;
/**
 * APIServiceSpec contains information for locating and communicating with a server. Only https is supported, though you are able to disable certificate verification.
 *
 * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec
 */
export interface ApiServiceSpec {
  /**
   * CABundle is a PEM encoded CA bundle which will be used to validate an API server's serving certificate. If unspecified, system trust roots on the apiserver are used.
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec#caBundle
   */
  readonly caBundle?: string;
  /**
   * Group is the API group name this server hosts
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec#group
   */
  readonly group?: string;
  /**
   * GroupPriorityMininum is the priority this group should have at least. Higher priority means that the group is preferred by clients over lower priority ones. Note that other versions of this group might specify even higher GroupPriorityMininum values such that the whole group gets a higher priority. The primary sort is based on GroupPriorityMinimum, ordered highest number to lowest (20 before 10). The secondary sort is based on the alphabetical comparison of the name of the object.  (v1.bar before v1.foo) We'd recommend something like: *.k8s.io (except extensions) at 18000 and PaaSes (OpenShift, Deis) are recommended to be in the 2000s
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec#groupPriorityMinimum
   */
  readonly groupPriorityMinimum: number;
  /**
   * InsecureSkipTLSVerify disables TLS certificate verification when communicating with this server. This is strongly discouraged.  You should use the CABundle instead.
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec#insecureSkipTLSVerify
   */
  readonly insecureSkipTlsVerify?: boolean;
  /**
   * Service is a reference to the service for this API server.  It must communicate on port 443. If the Service is nil, that means the handling for the API groupversion is handled locally on this server. The call will simply delegate to the normal handler chain to be fulfilled.
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec#service
   */
  readonly service?: ServiceReference;
  /**
   * Version is the API version this server hosts.  For example, "v1"
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec#version
   */
  readonly version?: string;
  /**
   * VersionPriority controls the ordering of this API version inside of its group.  Must be greater than zero. The primary sort is based on VersionPriority, ordered highest to lowest (20 before 10). Since it's inside of a group, the number can be small, probably in the 10s. In case of equal version priorities, the version string will be used to compute the order inside a group. If the version string is "kube-like", it will sort above non "kube-like" version strings, which are ordered lexicographically. "Kube-like" versions start with a "v", then are followed by a number (the major version), then optionally the string "alpha" or "beta" and another number (the minor version). These are sorted first by GA > beta > alpha (where GA is a version with no suffix such as beta or alpha), and then by comparing major version, then minor version. An example sorted list of versions: v10, v2, v1, v11beta2, v10beta3, v3beta1, v12alpha1, v11alpha2, foo1, foo10.
   *
   * @schema io.k8s.kube-aggregator.pkg.apis.apiregistration.v1.APIServiceSpec#versionPriority
   */
  readonly versionPriority: number;
}
/**
 * Converts an object of type 'ApiServiceSpec' to JSON representation.
 */
export declare function toJson_ApiServiceSpec(
  obj: ApiServiceSpec | undefined,
): Record<string, any> | undefined;
/**
 * ManagedFieldsEntry is a workflow-id, a FieldSet and the group version of the resource that the fieldset applies to.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry
 */
export interface ManagedFieldsEntry {
  /**
   * APIVersion defines the version of this resource that this field set applies to. The format is "group/version" just like the top-level APIVersion field. It is necessary to track the version of a field set because it cannot be automatically converted.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * FieldsType is the discriminator for the different fields format and version. There is currently only one possible value: "FieldsV1"
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry#fieldsType
   */
  readonly fieldsType?: string;
  /**
   * FieldsV1 holds the first JSON version format as described in the "FieldsV1" type.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry#fieldsV1
   */
  readonly fieldsV1?: any;
  /**
   * Manager is an identifier of the workflow managing these fields.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry#manager
   */
  readonly manager?: string;
  /**
   * Operation is the type of operation which lead to this ManagedFieldsEntry being created. The only valid values for this field are 'Apply' and 'Update'.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry#operation
   */
  readonly operation?: string;
  /**
   * Subresource is the name of the subresource used to update that object, or empty string if the object was updated through the main resource. The value of this field is used to distinguish between managers, even if they share the same name. For example, a status update will be distinct from a regular update using the same manager name. Note that the APIVersion field is not related to the Subresource field and it always corresponds to the version of the main resource.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry#subresource
   */
  readonly subresource?: string;
  /**
   * Time is timestamp of when these fields were set. It should always be empty if Operation is 'Apply'
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.ManagedFieldsEntry#time
   */
  readonly time?: Date;
}
/**
 * Converts an object of type 'ManagedFieldsEntry' to JSON representation.
 */
export declare function toJson_ManagedFieldsEntry(
  obj: ManagedFieldsEntry | undefined,
): Record<string, any> | undefined;
/**
 * OwnerReference contains enough information to let you identify an owning object. An owning object must be in the same namespace as the dependent, or be cluster-scoped, so there is no namespace field.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference
 */
export interface OwnerReference {
  /**
   * API version of the referent.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference#apiVersion
   */
  readonly apiVersion: string;
  /**
   * If true, AND if the owner has the "foregroundDeletion" finalizer, then the owner cannot be deleted from the key-value store until this reference is removed. Defaults to false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned.
   *
   * @default false. To set this field, a user needs "delete" permission of the owner, otherwise 422 (Unprocessable Entity) will be returned.
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference#blockOwnerDeletion
   */
  readonly blockOwnerDeletion?: boolean;
  /**
   * If true, this reference points to the managing controller.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference#controller
   */
  readonly controller?: boolean;
  /**
   * Kind of the referent. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference#kind
   */
  readonly kind: string;
  /**
   * Name of the referent. More info: http://kubernetes.io/docs/user-guide/identifiers#names
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference#name
   */
  readonly name: string;
  /**
   * UID of the referent. More info: http://kubernetes.io/docs/user-guide/identifiers#uids
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference#uid
   */
  readonly uid: string;
}
/**
 * Converts an object of type 'OwnerReference' to JSON representation.
 */
export declare function toJson_OwnerReference(
  obj: OwnerReference | undefined,
): Record<string, any> | undefined;
/**
 * WebhookClientConfig contains the information to make a TLS connection with the webhook
 *
 * @schema io.k8s.api.admissionregistration.v1.WebhookClientConfig
 */
export interface WebhookClientConfig {
  /**
   * `caBundle` is a PEM encoded CA bundle which will be used to validate the webhook's server certificate. If unspecified, system trust roots on the apiserver are used.
   *
   * @schema io.k8s.api.admissionregistration.v1.WebhookClientConfig#caBundle
   */
  readonly caBundle?: string;
  /**
   * `service` is a reference to the service for this webhook. Either `service` or `url` must be specified.
   *
   * If the webhook is running within the cluster, then you should use `service`.
   *
   * @schema io.k8s.api.admissionregistration.v1.WebhookClientConfig#service
   */
  readonly service?: ServiceReference;
  /**
   * `url` gives the location of the webhook, in standard URL form (`scheme://host:port/path`). Exactly one of `url` or `service` must be specified.
   *
   * The `host` should not refer to a service running in the cluster; use the `service` field instead. The host might be resolved via external DNS in some apiservers (e.g., `kube-apiserver` cannot resolve in-cluster DNS as that would be a layering violation). `host` may also be an IP address.
   *
   * Please note that using `localhost` or `127.0.0.1` as a `host` is risky unless you take great care to run this webhook on all hosts which run an apiserver which might need to make calls to this webhook. Such installs are likely to be non-portable, i.e., not easy to turn up in a new cluster.
   *
   * The scheme must be "https"; the URL must begin with "https://".
   *
   * A path is optional, and if present may be any string permissible in a URL. You may use the path to pass an arbitrary string to the webhook, for example, a cluster identifier.
   *
   * Attempting to use a user or basic auth e.g. "user:password@" is not allowed. Fragments ("#...") and query parameters ("?...") are not allowed, either.
   *
   * @schema io.k8s.api.admissionregistration.v1.WebhookClientConfig#url
   */
  readonly url?: string;
}
/**
 * Converts an object of type 'WebhookClientConfig' to JSON representation.
 */
export declare function toJson_WebhookClientConfig(
  obj: WebhookClientConfig | undefined,
): Record<string, any> | undefined;
/**
 * RuleWithOperations is a tuple of Operations and Resources. It is recommended to make sure that all the tuple expansions are valid.
 *
 * @schema io.k8s.api.admissionregistration.v1.RuleWithOperations
 */
export interface RuleWithOperations {
  /**
   * APIGroups is the API groups the resources belong to. '*' is all groups. If '*' is present, the length of the slice must be one. Required.
   *
   * @schema io.k8s.api.admissionregistration.v1.RuleWithOperations#apiGroups
   */
  readonly apiGroups?: string[];
  /**
   * APIVersions is the API versions the resources belong to. '*' is all versions. If '*' is present, the length of the slice must be one. Required.
   *
   * @schema io.k8s.api.admissionregistration.v1.RuleWithOperations#apiVersions
   */
  readonly apiVersions?: string[];
  /**
   * Operations is the operations the admission hook cares about - CREATE, UPDATE, DELETE, CONNECT or * for all of those operations and any future admission operations that are added. If '*' is present, the length of the slice must be one. Required.
   *
   * @schema io.k8s.api.admissionregistration.v1.RuleWithOperations#operations
   */
  readonly operations?: string[];
  /**
   * Resources is a list of resources this rule applies to.
   *
   * For example: 'pods' means pods. 'pods/log' means the log subresource of pods. '*' means all resources, but not subresources. 'pods/*' means all subresources of pods. '_/scale' means all scale subresources. '_/*' means all resources and their subresources.
   *
   * If wildcard is present, the validation rule will ensure resources do not overlap with each other.
   *
   * Depending on the enclosing object, subresources might not be allowed. Required.
   *
   * @schema io.k8s.api.admissionregistration.v1.RuleWithOperations#resources
   */
  readonly resources?: string[];
  /**
   * scope specifies the scope of this rule. Valid values are "Cluster", "Namespaced", and "*" "Cluster" means that only cluster-scoped resources will match this rule. Namespace API objects are cluster-scoped. "Namespaced" means that only namespaced resources will match this rule. "*" means that there are no scope restrictions. Subresources match the scope of their parent resource. Default is "*".
   *
   * @default .
   * @schema io.k8s.api.admissionregistration.v1.RuleWithOperations#scope
   */
  readonly scope?: string;
}
/**
 * Converts an object of type 'RuleWithOperations' to JSON representation.
 */
export declare function toJson_RuleWithOperations(
  obj: RuleWithOperations | undefined,
): Record<string, any> | undefined;
/**
 * DaemonSetUpdateStrategy is a struct used to control the update strategy for a DaemonSet.
 *
 * @schema io.k8s.api.apps.v1.DaemonSetUpdateStrategy
 */
export interface DaemonSetUpdateStrategy {
  /**
   * Rolling update config params. Present only if type = "RollingUpdate".
   *
   * @schema io.k8s.api.apps.v1.DaemonSetUpdateStrategy#rollingUpdate
   */
  readonly rollingUpdate?: RollingUpdateDaemonSet;
  /**
   * Type of daemon set update. Can be "RollingUpdate" or "OnDelete". Default is RollingUpdate.
   *
   * @default RollingUpdate.
   * @schema io.k8s.api.apps.v1.DaemonSetUpdateStrategy#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'DaemonSetUpdateStrategy' to JSON representation.
 */
export declare function toJson_DaemonSetUpdateStrategy(
  obj: DaemonSetUpdateStrategy | undefined,
): Record<string, any> | undefined;
/**
 * DeploymentStrategy describes how to replace existing pods with new ones.
 *
 * @schema io.k8s.api.apps.v1.DeploymentStrategy
 */
export interface DeploymentStrategy {
  /**
   * Rolling update config params. Present only if DeploymentStrategyType = RollingUpdate.
   *
   * @schema io.k8s.api.apps.v1.DeploymentStrategy#rollingUpdate
   */
  readonly rollingUpdate?: RollingUpdateDeployment;
  /**
   * Type of deployment. Can be "Recreate" or "RollingUpdate". Default is RollingUpdate.
   *
   * @default RollingUpdate.
   * @schema io.k8s.api.apps.v1.DeploymentStrategy#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'DeploymentStrategy' to JSON representation.
 */
export declare function toJson_DeploymentStrategy(
  obj: DeploymentStrategy | undefined,
): Record<string, any> | undefined;
/**
 * StatefulSetUpdateStrategy indicates the strategy that the StatefulSet controller will use to perform updates. It includes any additional parameters necessary to perform the update for the indicated strategy.
 *
 * @schema io.k8s.api.apps.v1.StatefulSetUpdateStrategy
 */
export interface StatefulSetUpdateStrategy {
  /**
   * RollingUpdate is used to communicate parameters when Type is RollingUpdateStatefulSetStrategyType.
   *
   * @schema io.k8s.api.apps.v1.StatefulSetUpdateStrategy#rollingUpdate
   */
  readonly rollingUpdate?: RollingUpdateStatefulSetStrategy;
  /**
   * Type indicates the type of the StatefulSetUpdateStrategy. Default is RollingUpdate.
   *
   * @default RollingUpdate.
   * @schema io.k8s.api.apps.v1.StatefulSetUpdateStrategy#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'StatefulSetUpdateStrategy' to JSON representation.
 */
export declare function toJson_StatefulSetUpdateStrategy(
  obj: StatefulSetUpdateStrategy | undefined,
): Record<string, any> | undefined;
/**
 * BoundObjectReference is a reference to an object that a token is bound to.
 *
 * @schema io.k8s.api.authentication.v1.BoundObjectReference
 */
export interface BoundObjectReference {
  /**
   * API version of the referent.
   *
   * @schema io.k8s.api.authentication.v1.BoundObjectReference#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * Kind of the referent. Valid kinds are 'Pod' and 'Secret'.
   *
   * @schema io.k8s.api.authentication.v1.BoundObjectReference#kind
   */
  readonly kind?: string;
  /**
   * Name of the referent.
   *
   * @schema io.k8s.api.authentication.v1.BoundObjectReference#name
   */
  readonly name?: string;
  /**
   * UID of the referent.
   *
   * @schema io.k8s.api.authentication.v1.BoundObjectReference#uid
   */
  readonly uid?: string;
}
/**
 * Converts an object of type 'BoundObjectReference' to JSON representation.
 */
export declare function toJson_BoundObjectReference(
  obj: BoundObjectReference | undefined,
): Record<string, any> | undefined;
/**
 * NonResourceAttributes includes the authorization attributes available for non-resource requests to the Authorizer interface
 *
 * @schema io.k8s.api.authorization.v1.NonResourceAttributes
 */
export interface NonResourceAttributes {
  /**
   * Path is the URL path of the request
   *
   * @schema io.k8s.api.authorization.v1.NonResourceAttributes#path
   */
  readonly path?: string;
  /**
   * Verb is the standard HTTP verb
   *
   * @schema io.k8s.api.authorization.v1.NonResourceAttributes#verb
   */
  readonly verb?: string;
}
/**
 * Converts an object of type 'NonResourceAttributes' to JSON representation.
 */
export declare function toJson_NonResourceAttributes(
  obj: NonResourceAttributes | undefined,
): Record<string, any> | undefined;
/**
 * ResourceAttributes includes the authorization attributes available for resource requests to the Authorizer interface
 *
 * @schema io.k8s.api.authorization.v1.ResourceAttributes
 */
export interface ResourceAttributes {
  /**
   * Group is the API Group of the Resource.  "*" means all.
   *
   * @schema io.k8s.api.authorization.v1.ResourceAttributes#group
   */
  readonly group?: string;
  /**
   * Name is the name of the resource being requested for a "get" or deleted for a "delete". "" (empty) means all.
   *
   * @schema io.k8s.api.authorization.v1.ResourceAttributes#name
   */
  readonly name?: string;
  /**
   * Namespace is the namespace of the action being requested.  Currently, there is no distinction between no namespace and all namespaces "" (empty) is defaulted for LocalSubjectAccessReviews "" (empty) is empty for cluster-scoped resources "" (empty) means "all" for namespace scoped resources from a SubjectAccessReview or SelfSubjectAccessReview
   *
   * @schema io.k8s.api.authorization.v1.ResourceAttributes#namespace
   */
  readonly namespace?: string;
  /**
   * Resource is one of the existing resource types.  "*" means all.
   *
   * @schema io.k8s.api.authorization.v1.ResourceAttributes#resource
   */
  readonly resource?: string;
  /**
   * Subresource is one of the existing resource types.  "" means none.
   *
   * @schema io.k8s.api.authorization.v1.ResourceAttributes#subresource
   */
  readonly subresource?: string;
  /**
   * Verb is a kubernetes resource API verb, like: get, list, watch, create, update, delete, proxy.  "*" means all.
   *
   * @schema io.k8s.api.authorization.v1.ResourceAttributes#verb
   */
  readonly verb?: string;
  /**
   * Version is the API Version of the Resource.  "*" means all.
   *
   * @schema io.k8s.api.authorization.v1.ResourceAttributes#version
   */
  readonly version?: string;
}
/**
 * Converts an object of type 'ResourceAttributes' to JSON representation.
 */
export declare function toJson_ResourceAttributes(
  obj: ResourceAttributes | undefined,
): Record<string, any> | undefined;
/**
 * CrossVersionObjectReference contains enough information to let you identify the referred resource.
 *
 * @schema io.k8s.api.autoscaling.v1.CrossVersionObjectReference
 */
export interface CrossVersionObjectReference {
  /**
   * API version of the referent
   *
   * @schema io.k8s.api.autoscaling.v1.CrossVersionObjectReference#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * Kind of the referent; More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
   *
   * @schema io.k8s.api.autoscaling.v1.CrossVersionObjectReference#kind
   */
  readonly kind: string;
  /**
   * Name of the referent; More info: http://kubernetes.io/docs/user-guide/identifiers#names
   *
   * @schema io.k8s.api.autoscaling.v1.CrossVersionObjectReference#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'CrossVersionObjectReference' to JSON representation.
 */
export declare function toJson_CrossVersionObjectReference(
  obj: CrossVersionObjectReference | undefined,
): Record<string, any> | undefined;
/**
 * MetricSpec specifies how to scale based on a single metric (only `type` and one other matching field should be set at once).
 *
 * @schema io.k8s.api.autoscaling.v2beta1.MetricSpec
 */
export interface MetricSpecV2Beta1 {
  /**
   * container resource refers to a resource metric (such as those specified in requests and limits) known to Kubernetes describing a single container in each pod of the current scale target (e.g. CPU or memory). Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source. This is an alpha feature and can be enabled by the HPAContainerMetrics feature flag.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.MetricSpec#containerResource
   */
  readonly containerResource?: ContainerResourceMetricSourceV2Beta1;
  /**
   * external refers to a global metric that is not associated with any Kubernetes object. It allows autoscaling based on information coming from components running outside of cluster (for example length of queue in cloud messaging service, or QPS from loadbalancer running outside of cluster).
   *
   * @schema io.k8s.api.autoscaling.v2beta1.MetricSpec#external
   */
  readonly external?: ExternalMetricSourceV2Beta1;
  /**
   * object refers to a metric describing a single kubernetes object (for example, hits-per-second on an Ingress object).
   *
   * @schema io.k8s.api.autoscaling.v2beta1.MetricSpec#object
   */
  readonly object?: ObjectMetricSourceV2Beta1;
  /**
   * pods refers to a metric describing each pod in the current scale target (for example, transactions-processed-per-second).  The values will be averaged together before being compared to the target value.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.MetricSpec#pods
   */
  readonly pods?: PodsMetricSourceV2Beta1;
  /**
   * resource refers to a resource metric (such as those specified in requests and limits) known to Kubernetes describing each pod in the current scale target (e.g. CPU or memory). Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.MetricSpec#resource
   */
  readonly resource?: ResourceMetricSourceV2Beta1;
  /**
   * type is the type of metric source.  It should be one of "ContainerResource", "External", "Object", "Pods" or "Resource", each mapping to a matching field in the object. Note: "ContainerResource" type is available on when the feature-gate HPAContainerMetrics is enabled
   *
   * @schema io.k8s.api.autoscaling.v2beta1.MetricSpec#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'MetricSpecV2Beta1' to JSON representation.
 */
export declare function toJson_MetricSpecV2Beta1(
  obj: MetricSpecV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * CrossVersionObjectReference contains enough information to let you identify the referred resource.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.CrossVersionObjectReference
 */
export interface CrossVersionObjectReferenceV2Beta1 {
  /**
   * API version of the referent
   *
   * @schema io.k8s.api.autoscaling.v2beta1.CrossVersionObjectReference#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * Kind of the referent; More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
   *
   * @schema io.k8s.api.autoscaling.v2beta1.CrossVersionObjectReference#kind
   */
  readonly kind: string;
  /**
   * Name of the referent; More info: http://kubernetes.io/docs/user-guide/identifiers#names
   *
   * @schema io.k8s.api.autoscaling.v2beta1.CrossVersionObjectReference#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'CrossVersionObjectReferenceV2Beta1' to JSON representation.
 */
export declare function toJson_CrossVersionObjectReferenceV2Beta1(
  obj: CrossVersionObjectReferenceV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * HorizontalPodAutoscalerBehavior configures the scaling behavior of the target in both Up and Down directions (scaleUp and scaleDown fields respectively).
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerBehavior
 */
export interface HorizontalPodAutoscalerBehaviorV2Beta2 {
  /**
   * scaleDown is scaling policy for scaling Down. If not set, the default value is to allow to scale down to minReplicas pods, with a 300 second stabilization window (i.e., the highest recommendation for the last 300sec is used).
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerBehavior#scaleDown
   */
  readonly scaleDown?: HpaScalingRulesV2Beta2;
  /**
   * scaleUp is scaling policy for scaling Up. If not set, the default value is the higher of:
   * * increase no more than 4 pods per 60 seconds
   * * double the number of pods per 60 seconds
   * No stabilization is used.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HorizontalPodAutoscalerBehavior#scaleUp
   */
  readonly scaleUp?: HpaScalingRulesV2Beta2;
}
/**
 * Converts an object of type 'HorizontalPodAutoscalerBehaviorV2Beta2' to JSON representation.
 */
export declare function toJson_HorizontalPodAutoscalerBehaviorV2Beta2(
  obj: HorizontalPodAutoscalerBehaviorV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * MetricSpec specifies how to scale based on a single metric (only `type` and one other matching field should be set at once).
 *
 * @schema io.k8s.api.autoscaling.v2beta2.MetricSpec
 */
export interface MetricSpecV2Beta2 {
  /**
   * container resource refers to a resource metric (such as those specified in requests and limits) known to Kubernetes describing a single container in each pod of the current scale target (e.g. CPU or memory). Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source. This is an alpha feature and can be enabled by the HPAContainerMetrics feature flag.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricSpec#containerResource
   */
  readonly containerResource?: ContainerResourceMetricSourceV2Beta2;
  /**
   * external refers to a global metric that is not associated with any Kubernetes object. It allows autoscaling based on information coming from components running outside of cluster (for example length of queue in cloud messaging service, or QPS from loadbalancer running outside of cluster).
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricSpec#external
   */
  readonly external?: ExternalMetricSourceV2Beta2;
  /**
   * object refers to a metric describing a single kubernetes object (for example, hits-per-second on an Ingress object).
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricSpec#object
   */
  readonly object?: ObjectMetricSourceV2Beta2;
  /**
   * pods refers to a metric describing each pod in the current scale target (for example, transactions-processed-per-second).  The values will be averaged together before being compared to the target value.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricSpec#pods
   */
  readonly pods?: PodsMetricSourceV2Beta2;
  /**
   * resource refers to a resource metric (such as those specified in requests and limits) known to Kubernetes describing each pod in the current scale target (e.g. CPU or memory). Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricSpec#resource
   */
  readonly resource?: ResourceMetricSourceV2Beta2;
  /**
   * type is the type of metric source.  It should be one of "ContainerResource", "External", "Object", "Pods" or "Resource", each mapping to a matching field in the object. Note: "ContainerResource" type is available on when the feature-gate HPAContainerMetrics is enabled
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricSpec#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'MetricSpecV2Beta2' to JSON representation.
 */
export declare function toJson_MetricSpecV2Beta2(
  obj: MetricSpecV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * CrossVersionObjectReference contains enough information to let you identify the referred resource.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.CrossVersionObjectReference
 */
export interface CrossVersionObjectReferenceV2Beta2 {
  /**
   * API version of the referent
   *
   * @schema io.k8s.api.autoscaling.v2beta2.CrossVersionObjectReference#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * Kind of the referent; More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
   *
   * @schema io.k8s.api.autoscaling.v2beta2.CrossVersionObjectReference#kind
   */
  readonly kind: string;
  /**
   * Name of the referent; More info: http://kubernetes.io/docs/user-guide/identifiers#names
   *
   * @schema io.k8s.api.autoscaling.v2beta2.CrossVersionObjectReference#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'CrossVersionObjectReferenceV2Beta2' to JSON representation.
 */
export declare function toJson_CrossVersionObjectReferenceV2Beta2(
  obj: CrossVersionObjectReferenceV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * JobTemplateSpec describes the data a Job should have when created from a template
 *
 * @schema io.k8s.api.batch.v1.JobTemplateSpec
 */
export interface JobTemplateSpec {
  /**
   * Standard object's metadata of the jobs created from this template. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1.JobTemplateSpec#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of the job. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.batch.v1.JobTemplateSpec#spec
   */
  readonly spec?: JobSpec;
}
/**
 * Converts an object of type 'JobTemplateSpec' to JSON representation.
 */
export declare function toJson_JobTemplateSpec(
  obj: JobTemplateSpec | undefined,
): Record<string, any> | undefined;
/**
 * JobTemplateSpec describes the data a Job should have when created from a template
 *
 * @schema io.k8s.api.batch.v1beta1.JobTemplateSpec
 */
export interface JobTemplateSpecV1Beta1 {
  /**
   * Standard object's metadata of the jobs created from this template. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
   *
   * @schema io.k8s.api.batch.v1beta1.JobTemplateSpec#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * Specification of the desired behavior of the job. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status
   *
   * @schema io.k8s.api.batch.v1beta1.JobTemplateSpec#spec
   */
  readonly spec?: JobSpec;
}
/**
 * Converts an object of type 'JobTemplateSpecV1Beta1' to JSON representation.
 */
export declare function toJson_JobTemplateSpecV1Beta1(
  obj: JobTemplateSpecV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * EndpointAddress is a tuple that describes single IP address.
 *
 * @schema io.k8s.api.core.v1.EndpointAddress
 */
export interface EndpointAddress {
  /**
   * The Hostname of this endpoint
   *
   * @schema io.k8s.api.core.v1.EndpointAddress#hostname
   */
  readonly hostname?: string;
  /**
   * The IP of this endpoint. May not be loopback (127.0.0.0/8), link-local (169.254.0.0/16), or link-local multicast ((224.0.0.0/24). IPv6 is also accepted but not fully supported on all platforms. Also, certain kubernetes components, like kube-proxy, are not IPv6 ready.
   *
   * @schema io.k8s.api.core.v1.EndpointAddress#ip
   */
  readonly ip: string;
  /**
   * Optional: Node hosting this endpoint. This can be used to determine endpoints local to a node.
   *
   * @schema io.k8s.api.core.v1.EndpointAddress#nodeName
   */
  readonly nodeName?: string;
  /**
   * Reference to object providing the endpoint.
   *
   * @schema io.k8s.api.core.v1.EndpointAddress#targetRef
   */
  readonly targetRef?: ObjectReference;
}
/**
 * Converts an object of type 'EndpointAddress' to JSON representation.
 */
export declare function toJson_EndpointAddress(
  obj: EndpointAddress | undefined,
): Record<string, any> | undefined;
/**
 * LimitRangeItem defines a min/max usage limit for any resource that matches on kind.
 *
 * @schema io.k8s.api.core.v1.LimitRangeItem
 */
export interface LimitRangeItem {
  /**
   * Default resource requirement limit value by resource name if resource limit is omitted.
   *
   * @schema io.k8s.api.core.v1.LimitRangeItem#default
   */
  readonly default?: {
    [key: string]: Quantity;
  };
  /**
   * DefaultRequest is the default resource requirement request value by resource name if resource request is omitted.
   *
   * @schema io.k8s.api.core.v1.LimitRangeItem#defaultRequest
   */
  readonly defaultRequest?: {
    [key: string]: Quantity;
  };
  /**
   * Max usage constraints on this kind by resource name.
   *
   * @schema io.k8s.api.core.v1.LimitRangeItem#max
   */
  readonly max?: {
    [key: string]: Quantity;
  };
  /**
   * MaxLimitRequestRatio if specified, the named resource must have a request and limit that are both non-zero where limit divided by request is less than or equal to the enumerated value; this represents the max burst for the named resource.
   *
   * @schema io.k8s.api.core.v1.LimitRangeItem#maxLimitRequestRatio
   */
  readonly maxLimitRequestRatio?: {
    [key: string]: Quantity;
  };
  /**
   * Min usage constraints on this kind by resource name.
   *
   * @schema io.k8s.api.core.v1.LimitRangeItem#min
   */
  readonly min?: {
    [key: string]: Quantity;
  };
  /**
   * Type of resource that this limit applies to.
   *
   * @schema io.k8s.api.core.v1.LimitRangeItem#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'LimitRangeItem' to JSON representation.
 */
export declare function toJson_LimitRangeItem(
  obj: LimitRangeItem | undefined,
): Record<string, any> | undefined;
/**
 * NodeConfigSource specifies a source of node configuration. Exactly one subfield (excluding metadata) must be non-nil. This API is deprecated since 1.22
 *
 * @schema io.k8s.api.core.v1.NodeConfigSource
 */
export interface NodeConfigSource {
  /**
   * ConfigMap is a reference to a Node's ConfigMap
   *
   * @schema io.k8s.api.core.v1.NodeConfigSource#configMap
   */
  readonly configMap?: ConfigMapNodeConfigSource;
}
/**
 * Converts an object of type 'NodeConfigSource' to JSON representation.
 */
export declare function toJson_NodeConfigSource(
  obj: NodeConfigSource | undefined,
): Record<string, any> | undefined;
/**
 * The node this Taint is attached to has the "effect" on any pod that does not tolerate the Taint.
 *
 * @schema io.k8s.api.core.v1.Taint
 */
export interface Taint {
  /**
   * Required. The effect of the taint on pods that do not tolerate the taint. Valid effects are NoSchedule, PreferNoSchedule and NoExecute.
   *
   * @schema io.k8s.api.core.v1.Taint#effect
   */
  readonly effect: string;
  /**
   * Required. The taint key to be applied to a node.
   *
   * @schema io.k8s.api.core.v1.Taint#key
   */
  readonly key: string;
  /**
   * TimeAdded represents the time at which the taint was added. It is only written for NoExecute taints.
   *
   * @schema io.k8s.api.core.v1.Taint#timeAdded
   */
  readonly timeAdded?: Date;
  /**
   * The taint value corresponding to the taint key.
   *
   * @schema io.k8s.api.core.v1.Taint#value
   */
  readonly value?: string;
}
/**
 * Converts an object of type 'Taint' to JSON representation.
 */
export declare function toJson_Taint(
  obj: Taint | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Persistent Disk resource in AWS.
 *
 * An AWS EBS disk must exist before mounting to a container. The disk must also be in the same AWS zone as the kubelet. An AWS EBS disk can only be mounted as read/write once. AWS EBS volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.AWSElasticBlockStoreVolumeSource
 */
export interface AwsElasticBlockStoreVolumeSource {
  /**
   * Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
   *
   * @schema io.k8s.api.core.v1.AWSElasticBlockStoreVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * The partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as "1". Similarly, the volume partition for /dev/sda is "0" (or you can leave the property empty).
   *
   * @schema io.k8s.api.core.v1.AWSElasticBlockStoreVolumeSource#partition
   */
  readonly partition?: number;
  /**
   * Specify "true" to force and set the ReadOnly property in VolumeMounts to "true". If omitted, the default is "false". More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
   *
   * @schema io.k8s.api.core.v1.AWSElasticBlockStoreVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Unique ID of the persistent disk resource in AWS (Amazon EBS volume). More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
   *
   * @schema io.k8s.api.core.v1.AWSElasticBlockStoreVolumeSource#volumeID
   */
  readonly volumeId: string;
}
/**
 * Converts an object of type 'AwsElasticBlockStoreVolumeSource' to JSON representation.
 */
export declare function toJson_AwsElasticBlockStoreVolumeSource(
  obj: AwsElasticBlockStoreVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod.
 *
 * @schema io.k8s.api.core.v1.AzureDiskVolumeSource
 */
export interface AzureDiskVolumeSource {
  /**
   * Host Caching mode: None, Read Only, Read Write.
   *
   * @schema io.k8s.api.core.v1.AzureDiskVolumeSource#cachingMode
   */
  readonly cachingMode?: string;
  /**
   * The Name of the data disk in the blob storage
   *
   * @schema io.k8s.api.core.v1.AzureDiskVolumeSource#diskName
   */
  readonly diskName: string;
  /**
   * The URI the data disk in the blob storage
   *
   * @schema io.k8s.api.core.v1.AzureDiskVolumeSource#diskURI
   */
  readonly diskUri: string;
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
   *
   * @schema io.k8s.api.core.v1.AzureDiskVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Expected values Shared: multiple blob disks per storage account  Dedicated: single blob disk per storage account  Managed: azure managed data disk (only in managed availability set). defaults to shared
   *
   * @schema io.k8s.api.core.v1.AzureDiskVolumeSource#kind
   */
  readonly kind?: string;
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.AzureDiskVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
}
/**
 * Converts an object of type 'AzureDiskVolumeSource' to JSON representation.
 */
export declare function toJson_AzureDiskVolumeSource(
  obj: AzureDiskVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * AzureFile represents an Azure File Service mount on the host and bind mount to the pod.
 *
 * @schema io.k8s.api.core.v1.AzureFilePersistentVolumeSource
 */
export interface AzureFilePersistentVolumeSource {
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.AzureFilePersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * the name of secret that contains Azure Storage Account Name and Key
   *
   * @schema io.k8s.api.core.v1.AzureFilePersistentVolumeSource#secretName
   */
  readonly secretName: string;
  /**
   * the namespace of the secret that contains Azure Storage Account Name and Key default is the same as the Pod
   *
   * @schema io.k8s.api.core.v1.AzureFilePersistentVolumeSource#secretNamespace
   */
  readonly secretNamespace?: string;
  /**
   * Share Name
   *
   * @schema io.k8s.api.core.v1.AzureFilePersistentVolumeSource#shareName
   */
  readonly shareName: string;
}
/**
 * Converts an object of type 'AzureFilePersistentVolumeSource' to JSON representation.
 */
export declare function toJson_AzureFilePersistentVolumeSource(
  obj: AzureFilePersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Ceph Filesystem mount that lasts the lifetime of a pod Cephfs volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.CephFSPersistentVolumeSource
 */
export interface CephFsPersistentVolumeSource {
  /**
   * Required: Monitors is a collection of Ceph monitors More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSPersistentVolumeSource#monitors
   */
  readonly monitors: string[];
  /**
   * Optional: Used as the mounted root, rather than the full Ceph tree, default is /
   *
   * @schema io.k8s.api.core.v1.CephFSPersistentVolumeSource#path
   */
  readonly path?: string;
  /**
   * Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.CephFSPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Optional: SecretFile is the path to key ring for User, default is /etc/ceph/user.secret More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSPersistentVolumeSource#secretFile
   */
  readonly secretFile?: string;
  /**
   * Optional: SecretRef is reference to the authentication secret for User, default is empty. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSPersistentVolumeSource#secretRef
   */
  readonly secretRef?: SecretReference;
  /**
   * Optional: User is the rados user name, default is admin More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSPersistentVolumeSource#user
   */
  readonly user?: string;
}
/**
 * Converts an object of type 'CephFsPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_CephFsPersistentVolumeSource(
  obj: CephFsPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a cinder volume resource in Openstack. A Cinder volume must exist before mounting to a container. The volume must also be in the same region as the kubelet. Cinder volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.CinderPersistentVolumeSource
 */
export interface CinderPersistentVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @schema io.k8s.api.core.v1.CinderPersistentVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   * @schema io.k8s.api.core.v1.CinderPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Optional: points to a secret object containing parameters used to connect to OpenStack.
   *
   * @schema io.k8s.api.core.v1.CinderPersistentVolumeSource#secretRef
   */
  readonly secretRef?: SecretReference;
  /**
   * volume id used to identify the volume in cinder. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @schema io.k8s.api.core.v1.CinderPersistentVolumeSource#volumeID
   */
  readonly volumeId: string;
}
/**
 * Converts an object of type 'CinderPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_CinderPersistentVolumeSource(
  obj: CinderPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents storage that is managed by an external CSI volume driver (Beta feature)
 *
 * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource
 */
export interface CsiPersistentVolumeSource {
  /**
   * ControllerExpandSecretRef is a reference to the secret object containing sensitive information to pass to the CSI driver to complete the CSI ControllerExpandVolume call. This is an alpha field and requires enabling ExpandCSIVolumes feature gate. This field is optional, and may be empty if no secret is required. If the secret object contains more than one secret, all secrets are passed.
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#controllerExpandSecretRef
   */
  readonly controllerExpandSecretRef?: SecretReference;
  /**
   * ControllerPublishSecretRef is a reference to the secret object containing sensitive information to pass to the CSI driver to complete the CSI ControllerPublishVolume and ControllerUnpublishVolume calls. This field is optional, and may be empty if no secret is required. If the secret object contains more than one secret, all secrets are passed.
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#controllerPublishSecretRef
   */
  readonly controllerPublishSecretRef?: SecretReference;
  /**
   * Driver is the name of the driver to use for this volume. Required.
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#driver
   */
  readonly driver: string;
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs".
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * NodePublishSecretRef is a reference to the secret object containing sensitive information to pass to the CSI driver to complete the CSI NodePublishVolume and NodeUnpublishVolume calls. This field is optional, and may be empty if no secret is required. If the secret object contains more than one secret, all secrets are passed.
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#nodePublishSecretRef
   */
  readonly nodePublishSecretRef?: SecretReference;
  /**
   * NodeStageSecretRef is a reference to the secret object containing sensitive information to pass to the CSI driver to complete the CSI NodeStageVolume and NodeStageVolume and NodeUnstageVolume calls. This field is optional, and may be empty if no secret is required. If the secret object contains more than one secret, all secrets are passed.
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#nodeStageSecretRef
   */
  readonly nodeStageSecretRef?: SecretReference;
  /**
   * Optional: The value to pass to ControllerPublishVolumeRequest. Defaults to false (read/write).
   *
   * @default false (read/write).
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Attributes of the volume to publish.
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#volumeAttributes
   */
  readonly volumeAttributes?: {
    [key: string]: string;
  };
  /**
   * VolumeHandle is the unique volume name returned by the CSI volume plugin’s CreateVolume to refer to the volume on all subsequent calls. Required.
   *
   * @schema io.k8s.api.core.v1.CSIPersistentVolumeSource#volumeHandle
   */
  readonly volumeHandle: string;
}
/**
 * Converts an object of type 'CsiPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_CsiPersistentVolumeSource(
  obj: CsiPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Fibre Channel volume. Fibre Channel volumes can only be mounted as read/write once. Fibre Channel volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.FCVolumeSource
 */
export interface FcVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
   *
   * @schema io.k8s.api.core.v1.FCVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Optional: FC target lun number
   *
   * @schema io.k8s.api.core.v1.FCVolumeSource#lun
   */
  readonly lun?: number;
  /**
   * Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.FCVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Optional: FC target worldwide names (WWNs)
   *
   * @schema io.k8s.api.core.v1.FCVolumeSource#targetWWNs
   */
  readonly targetWwNs?: string[];
  /**
   * Optional: FC volume world wide identifiers (wwids) Either wwids or combination of targetWWNs and lun must be set, but not both simultaneously.
   *
   * @schema io.k8s.api.core.v1.FCVolumeSource#wwids
   */
  readonly wwids?: string[];
}
/**
 * Converts an object of type 'FcVolumeSource' to JSON representation.
 */
export declare function toJson_FcVolumeSource(
  obj: FcVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * FlexPersistentVolumeSource represents a generic persistent volume resource that is provisioned/attached using an exec based plugin.
 *
 * @schema io.k8s.api.core.v1.FlexPersistentVolumeSource
 */
export interface FlexPersistentVolumeSource {
  /**
   * Driver is the name of the driver to use for this volume.
   *
   * @schema io.k8s.api.core.v1.FlexPersistentVolumeSource#driver
   */
  readonly driver: string;
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". The default filesystem depends on FlexVolume script.
   *
   * @schema io.k8s.api.core.v1.FlexPersistentVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Optional: Extra command options if any.
   *
   * @schema io.k8s.api.core.v1.FlexPersistentVolumeSource#options
   */
  readonly options?: {
    [key: string]: string;
  };
  /**
   * Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.FlexPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Optional: SecretRef is reference to the secret object containing sensitive information to pass to the plugin scripts. This may be empty if no secret object is specified. If the secret object contains more than one secret, all secrets are passed to the plugin scripts.
   *
   * @schema io.k8s.api.core.v1.FlexPersistentVolumeSource#secretRef
   */
  readonly secretRef?: SecretReference;
}
/**
 * Converts an object of type 'FlexPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_FlexPersistentVolumeSource(
  obj: FlexPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Flocker volume mounted by the Flocker agent. One and only one of datasetName and datasetUUID should be set. Flocker volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.FlockerVolumeSource
 */
export interface FlockerVolumeSource {
  /**
   * Name of the dataset stored as metadata -> name on the dataset for Flocker should be considered as deprecated
   *
   * @schema io.k8s.api.core.v1.FlockerVolumeSource#datasetName
   */
  readonly datasetName?: string;
  /**
   * UUID of the dataset. This is unique identifier of a Flocker dataset
   *
   * @schema io.k8s.api.core.v1.FlockerVolumeSource#datasetUUID
   */
  readonly datasetUuid?: string;
}
/**
 * Converts an object of type 'FlockerVolumeSource' to JSON representation.
 */
export declare function toJson_FlockerVolumeSource(
  obj: FlockerVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Persistent Disk resource in Google Compute Engine.
 *
 * A GCE PD must exist before mounting to a container. The disk must also be in the same GCE project and zone as the kubelet. A GCE PD can only be mounted as read/write once or read-only many times. GCE PDs support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.GCEPersistentDiskVolumeSource
 */
export interface GcePersistentDiskVolumeSource {
  /**
   * Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
   *
   * @schema io.k8s.api.core.v1.GCEPersistentDiskVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * The partition in the volume that you want to mount. If omitted, the default is to mount by volume name. Examples: For volume /dev/sda1, you specify the partition as "1". Similarly, the volume partition for /dev/sda is "0" (or you can leave the property empty). More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
   *
   * @schema io.k8s.api.core.v1.GCEPersistentDiskVolumeSource#partition
   */
  readonly partition?: number;
  /**
   * Unique name of the PD resource in GCE. Used to identify the disk in GCE. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
   *
   * @schema io.k8s.api.core.v1.GCEPersistentDiskVolumeSource#pdName
   */
  readonly pdName: string;
  /**
   * ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
   *
   * @default false. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
   * @schema io.k8s.api.core.v1.GCEPersistentDiskVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
}
/**
 * Converts an object of type 'GcePersistentDiskVolumeSource' to JSON representation.
 */
export declare function toJson_GcePersistentDiskVolumeSource(
  obj: GcePersistentDiskVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Glusterfs mount that lasts the lifetime of a pod. Glusterfs volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.GlusterfsPersistentVolumeSource
 */
export interface GlusterfsPersistentVolumeSource {
  /**
   * EndpointsName is the endpoint name that details Glusterfs topology. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   *
   * @schema io.k8s.api.core.v1.GlusterfsPersistentVolumeSource#endpoints
   */
  readonly endpoints: string;
  /**
   * EndpointsNamespace is the namespace that contains Glusterfs endpoint. If this field is empty, the EndpointNamespace defaults to the same namespace as the bound PVC. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   *
   * @schema io.k8s.api.core.v1.GlusterfsPersistentVolumeSource#endpointsNamespace
   */
  readonly endpointsNamespace?: string;
  /**
   * Path is the Glusterfs volume path. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   *
   * @schema io.k8s.api.core.v1.GlusterfsPersistentVolumeSource#path
   */
  readonly path: string;
  /**
   * ReadOnly here will force the Glusterfs volume to be mounted with read-only permissions. Defaults to false. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   *
   * @default false. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   * @schema io.k8s.api.core.v1.GlusterfsPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
}
/**
 * Converts an object of type 'GlusterfsPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_GlusterfsPersistentVolumeSource(
  obj: GlusterfsPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a host path mapped into a pod. Host path volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.HostPathVolumeSource
 */
export interface HostPathVolumeSource {
  /**
   * Path of the directory on the host. If the path is a symlink, it will follow the link to the real path. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
   *
   * @schema io.k8s.api.core.v1.HostPathVolumeSource#path
   */
  readonly path: string;
  /**
   * Type for HostPath Volume Defaults to "" More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
   *
   * @default More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
   * @schema io.k8s.api.core.v1.HostPathVolumeSource#type
   */
  readonly type?: string;
}
/**
 * Converts an object of type 'HostPathVolumeSource' to JSON representation.
 */
export declare function toJson_HostPathVolumeSource(
  obj: HostPathVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * ISCSIPersistentVolumeSource represents an ISCSI disk. ISCSI volumes can only be mounted as read/write once. ISCSI volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource
 */
export interface IscsiPersistentVolumeSource {
  /**
   * whether support iSCSI Discovery CHAP authentication
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#chapAuthDiscovery
   */
  readonly chapAuthDiscovery?: boolean;
  /**
   * whether support iSCSI Session CHAP authentication
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#chapAuthSession
   */
  readonly chapAuthSession?: boolean;
  /**
   * Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#iscsi
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Custom iSCSI Initiator Name. If initiatorName is specified with iscsiInterface simultaneously, new iSCSI interface <target portal>:<volume name> will be created for the connection.
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#initiatorName
   */
  readonly initiatorName?: string;
  /**
   * Target iSCSI Qualified Name.
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#iqn
   */
  readonly iqn: string;
  /**
   * iSCSI Interface Name that uses an iSCSI transport. Defaults to 'default' (tcp).
   *
   * @default default' (tcp).
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#iscsiInterface
   */
  readonly iscsiInterface?: string;
  /**
   * iSCSI Target Lun number.
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#lun
   */
  readonly lun: number;
  /**
   * iSCSI Target Portal List. The Portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#portals
   */
  readonly portals?: string[];
  /**
   * ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * CHAP Secret for iSCSI target and initiator authentication
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#secretRef
   */
  readonly secretRef?: SecretReference;
  /**
   * iSCSI Target Portal. The Portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
   *
   * @schema io.k8s.api.core.v1.ISCSIPersistentVolumeSource#targetPortal
   */
  readonly targetPortal: string;
}
/**
 * Converts an object of type 'IscsiPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_IscsiPersistentVolumeSource(
  obj: IscsiPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Local represents directly-attached storage with node affinity (Beta feature)
 *
 * @schema io.k8s.api.core.v1.LocalVolumeSource
 */
export interface LocalVolumeSource {
  /**
   * Filesystem type to mount. It applies only when the Path is a block device. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". The default value is to auto-select a fileystem if unspecified.
   *
   * @schema io.k8s.api.core.v1.LocalVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * The full path to the volume on the node. It can be either a directory or block device (disk, partition, ...).
   *
   * @schema io.k8s.api.core.v1.LocalVolumeSource#path
   */
  readonly path: string;
}
/**
 * Converts an object of type 'LocalVolumeSource' to JSON representation.
 */
export declare function toJson_LocalVolumeSource(
  obj: LocalVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents an NFS mount that lasts the lifetime of a pod. NFS volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.NFSVolumeSource
 */
export interface NfsVolumeSource {
  /**
   * Path that is exported by the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
   *
   * @schema io.k8s.api.core.v1.NFSVolumeSource#path
   */
  readonly path: string;
  /**
   * ReadOnly here will force the NFS export to be mounted with read-only permissions. Defaults to false. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
   *
   * @default false. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
   * @schema io.k8s.api.core.v1.NFSVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Server is the hostname or IP address of the NFS server. More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
   *
   * @schema io.k8s.api.core.v1.NFSVolumeSource#server
   */
  readonly server: string;
}
/**
 * Converts an object of type 'NfsVolumeSource' to JSON representation.
 */
export declare function toJson_NfsVolumeSource(
  obj: NfsVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * VolumeNodeAffinity defines constraints that limit what nodes this volume can be accessed from.
 *
 * @schema io.k8s.api.core.v1.VolumeNodeAffinity
 */
export interface VolumeNodeAffinity {
  /**
   * Required specifies hard node constraints that must be met.
   *
   * @schema io.k8s.api.core.v1.VolumeNodeAffinity#required
   */
  readonly required?: NodeSelector;
}
/**
 * Converts an object of type 'VolumeNodeAffinity' to JSON representation.
 */
export declare function toJson_VolumeNodeAffinity(
  obj: VolumeNodeAffinity | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Photon Controller persistent disk resource.
 *
 * @schema io.k8s.api.core.v1.PhotonPersistentDiskVolumeSource
 */
export interface PhotonPersistentDiskVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
   *
   * @schema io.k8s.api.core.v1.PhotonPersistentDiskVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * ID that identifies Photon Controller persistent disk
   *
   * @schema io.k8s.api.core.v1.PhotonPersistentDiskVolumeSource#pdID
   */
  readonly pdId: string;
}
/**
 * Converts an object of type 'PhotonPersistentDiskVolumeSource' to JSON representation.
 */
export declare function toJson_PhotonPersistentDiskVolumeSource(
  obj: PhotonPersistentDiskVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * PortworxVolumeSource represents a Portworx volume resource.
 *
 * @schema io.k8s.api.core.v1.PortworxVolumeSource
 */
export interface PortworxVolumeSource {
  /**
   * FSType represents the filesystem type to mount Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs". Implicitly inferred to be "ext4" if unspecified.
   *
   * @schema io.k8s.api.core.v1.PortworxVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.PortworxVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * VolumeID uniquely identifies a Portworx volume
   *
   * @schema io.k8s.api.core.v1.PortworxVolumeSource#volumeID
   */
  readonly volumeId: string;
}
/**
 * Converts an object of type 'PortworxVolumeSource' to JSON representation.
 */
export declare function toJson_PortworxVolumeSource(
  obj: PortworxVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Quobyte mount that lasts the lifetime of a pod. Quobyte volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.QuobyteVolumeSource
 */
export interface QuobyteVolumeSource {
  /**
   * Group to map volume access to Default is no group
   *
   * @default no group
   * @schema io.k8s.api.core.v1.QuobyteVolumeSource#group
   */
  readonly group?: string;
  /**
   * ReadOnly here will force the Quobyte volume to be mounted with read-only permissions. Defaults to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.QuobyteVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Registry represents a single or multiple Quobyte Registry services specified as a string as host:port pair (multiple entries are separated with commas) which acts as the central registry for volumes
   *
   * @schema io.k8s.api.core.v1.QuobyteVolumeSource#registry
   */
  readonly registry: string;
  /**
   * Tenant owning the given Quobyte volume in the Backend Used with dynamically provisioned Quobyte volumes, value is set by the plugin
   *
   * @schema io.k8s.api.core.v1.QuobyteVolumeSource#tenant
   */
  readonly tenant?: string;
  /**
   * User to map volume access to Defaults to serivceaccount user
   *
   * @default serivceaccount user
   * @schema io.k8s.api.core.v1.QuobyteVolumeSource#user
   */
  readonly user?: string;
  /**
   * Volume is a string that references an already created Quobyte volume by name.
   *
   * @schema io.k8s.api.core.v1.QuobyteVolumeSource#volume
   */
  readonly volume: string;
}
/**
 * Converts an object of type 'QuobyteVolumeSource' to JSON representation.
 */
export declare function toJson_QuobyteVolumeSource(
  obj: QuobyteVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Rados Block Device mount that lasts the lifetime of a pod. RBD volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource
 */
export interface RbdPersistentVolumeSource {
  /**
   * Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#rbd
   *
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * The rados image name. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#image
   */
  readonly image: string;
  /**
   * Keyring is the path to key ring for RBDUser. Default is /etc/ceph/keyring. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default etc/ceph/keyring. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#keyring
   */
  readonly keyring?: string;
  /**
   * A collection of Ceph monitors. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#monitors
   */
  readonly monitors: string[];
  /**
   * The rados pool name. Default is rbd. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default rbd. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#pool
   */
  readonly pool?: string;
  /**
   * ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default false. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * SecretRef is name of the authentication secret for RBDUser. If provided overrides keyring. Default is nil. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default nil. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#secretRef
   */
  readonly secretRef?: SecretReference;
  /**
   * The rados user name. Default is admin. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default admin. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDPersistentVolumeSource#user
   */
  readonly user?: string;
}
/**
 * Converts an object of type 'RbdPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_RbdPersistentVolumeSource(
  obj: RbdPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * ScaleIOPersistentVolumeSource represents a persistent ScaleIO volume
 *
 * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource
 */
export interface ScaleIoPersistentVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Default is "xfs"
   *
   * @default xfs"
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * The host address of the ScaleIO API Gateway.
   *
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#gateway
   */
  readonly gateway: string;
  /**
   * The name of the ScaleIO Protection Domain for the configured storage.
   *
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#protectionDomain
   */
  readonly protectionDomain?: string;
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * SecretRef references to the secret for ScaleIO user and other sensitive information. If this is not provided, Login operation will fail.
   *
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#secretRef
   */
  readonly secretRef: SecretReference;
  /**
   * Flag to enable/disable SSL communication with Gateway, default false
   *
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#sslEnabled
   */
  readonly sslEnabled?: boolean;
  /**
   * Indicates whether the storage for a volume should be ThickProvisioned or ThinProvisioned. Default is ThinProvisioned.
   *
   * @default ThinProvisioned.
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#storageMode
   */
  readonly storageMode?: string;
  /**
   * The ScaleIO Storage Pool associated with the protection domain.
   *
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#storagePool
   */
  readonly storagePool?: string;
  /**
   * The name of the storage system as configured in ScaleIO.
   *
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#system
   */
  readonly system: string;
  /**
   * The name of a volume already created in the ScaleIO system that is associated with this volume source.
   *
   * @schema io.k8s.api.core.v1.ScaleIOPersistentVolumeSource#volumeName
   */
  readonly volumeName?: string;
}
/**
 * Converts an object of type 'ScaleIoPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_ScaleIoPersistentVolumeSource(
  obj: ScaleIoPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a StorageOS persistent volume resource.
 *
 * @schema io.k8s.api.core.v1.StorageOSPersistentVolumeSource
 */
export interface StorageOsPersistentVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
   *
   * @schema io.k8s.api.core.v1.StorageOSPersistentVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.StorageOSPersistentVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * SecretRef specifies the secret to use for obtaining the StorageOS API credentials.  If not specified, default values will be attempted.
   *
   * @schema io.k8s.api.core.v1.StorageOSPersistentVolumeSource#secretRef
   */
  readonly secretRef?: ObjectReference;
  /**
   * VolumeName is the human-readable name of the StorageOS volume.  Volume names are only unique within a namespace.
   *
   * @schema io.k8s.api.core.v1.StorageOSPersistentVolumeSource#volumeName
   */
  readonly volumeName?: string;
  /**
   * VolumeNamespace specifies the scope of the volume within StorageOS.  If no namespace is specified then the Pod's namespace will be used.  This allows the Kubernetes name scoping to be mirrored within StorageOS for tighter integration. Set VolumeName to any name to override the default behaviour. Set to "default" if you are not using namespaces within StorageOS. Namespaces that do not pre-exist within StorageOS will be created.
   *
   * @schema io.k8s.api.core.v1.StorageOSPersistentVolumeSource#volumeNamespace
   */
  readonly volumeNamespace?: string;
}
/**
 * Converts an object of type 'StorageOsPersistentVolumeSource' to JSON representation.
 */
export declare function toJson_StorageOsPersistentVolumeSource(
  obj: StorageOsPersistentVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a vSphere volume resource.
 *
 * @schema io.k8s.api.core.v1.VsphereVirtualDiskVolumeSource
 */
export interface VsphereVirtualDiskVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
   *
   * @schema io.k8s.api.core.v1.VsphereVirtualDiskVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Storage Policy Based Management (SPBM) profile ID associated with the StoragePolicyName.
   *
   * @schema io.k8s.api.core.v1.VsphereVirtualDiskVolumeSource#storagePolicyID
   */
  readonly storagePolicyId?: string;
  /**
   * Storage Policy Based Management (SPBM) profile name.
   *
   * @schema io.k8s.api.core.v1.VsphereVirtualDiskVolumeSource#storagePolicyName
   */
  readonly storagePolicyName?: string;
  /**
   * Path that identifies vSphere volume vmdk
   *
   * @schema io.k8s.api.core.v1.VsphereVirtualDiskVolumeSource#volumePath
   */
  readonly volumePath: string;
}
/**
 * Converts an object of type 'VsphereVirtualDiskVolumeSource' to JSON representation.
 */
export declare function toJson_VsphereVirtualDiskVolumeSource(
  obj: VsphereVirtualDiskVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * TypedLocalObjectReference contains enough information to let you locate the typed referenced object inside the same namespace.
 *
 * @schema io.k8s.api.core.v1.TypedLocalObjectReference
 */
export interface TypedLocalObjectReference {
  /**
   * APIGroup is the group for the resource being referenced. If APIGroup is not specified, the specified Kind must be in the core API group. For any other third-party types, APIGroup is required.
   *
   * @schema io.k8s.api.core.v1.TypedLocalObjectReference#apiGroup
   */
  readonly apiGroup?: string;
  /**
   * Kind is the type of resource being referenced
   *
   * @schema io.k8s.api.core.v1.TypedLocalObjectReference#kind
   */
  readonly kind: string;
  /**
   * Name is the name of resource being referenced
   *
   * @schema io.k8s.api.core.v1.TypedLocalObjectReference#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'TypedLocalObjectReference' to JSON representation.
 */
export declare function toJson_TypedLocalObjectReference(
  obj: TypedLocalObjectReference | undefined,
): Record<string, any> | undefined;
/**
 * ResourceRequirements describes the compute resource requirements.
 *
 * @schema io.k8s.api.core.v1.ResourceRequirements
 */
export interface ResourceRequirements {
  /**
   * Limits describes the maximum amount of compute resources allowed. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
   *
   * @schema io.k8s.api.core.v1.ResourceRequirements#limits
   */
  readonly limits?: {
    [key: string]: Quantity;
  };
  /**
   * Requests describes the minimum amount of compute resources required. If Requests is omitted for a container, it defaults to Limits if that is explicitly specified, otherwise to an implementation-defined value. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
   *
   * @schema io.k8s.api.core.v1.ResourceRequirements#requests
   */
  readonly requests?: {
    [key: string]: Quantity;
  };
}
/**
 * Converts an object of type 'ResourceRequirements' to JSON representation.
 */
export declare function toJson_ResourceRequirements(
  obj: ResourceRequirements | undefined,
): Record<string, any> | undefined;
/**
 * Affinity is a group of affinity scheduling rules.
 *
 * @schema io.k8s.api.core.v1.Affinity
 */
export interface Affinity {
  /**
   * Describes node affinity scheduling rules for the pod.
   *
   * @schema io.k8s.api.core.v1.Affinity#nodeAffinity
   */
  readonly nodeAffinity?: NodeAffinity;
  /**
   * Describes pod affinity scheduling rules (e.g. co-locate this pod in the same node, zone, etc. as some other pod(s)).
   *
   * @schema io.k8s.api.core.v1.Affinity#podAffinity
   */
  readonly podAffinity?: PodAffinity;
  /**
   * Describes pod anti-affinity scheduling rules (e.g. avoid putting this pod in the same node, zone, etc. as some other pod(s)).
   *
   * @schema io.k8s.api.core.v1.Affinity#podAntiAffinity
   */
  readonly podAntiAffinity?: PodAntiAffinity;
}
/**
 * Converts an object of type 'Affinity' to JSON representation.
 */
export declare function toJson_Affinity(
  obj: Affinity | undefined,
): Record<string, any> | undefined;
/**
 * A single application container that you want to run within a pod.
 *
 * @schema io.k8s.api.core.v1.Container
 */
export interface Container {
  /**
   * Arguments to the entrypoint. The docker image's CMD is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
   *
   * @schema io.k8s.api.core.v1.Container#args
   */
  readonly args?: string[];
  /**
   * Entrypoint array. Not executed within a shell. The docker image's ENTRYPOINT is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
   *
   * @schema io.k8s.api.core.v1.Container#command
   */
  readonly command?: string[];
  /**
   * List of environment variables to set in the container. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.Container#env
   */
  readonly env?: EnvVar[];
  /**
   * List of sources to populate environment variables in the container. The keys defined within a source must be a C_IDENTIFIER. All invalid keys will be reported as an event when the container is starting. When a key exists in multiple sources, the value associated with the last source will take precedence. Values defined by an Env with a duplicate key will take precedence. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.Container#envFrom
   */
  readonly envFrom?: EnvFromSource[];
  /**
   * Docker image name. More info: https://kubernetes.io/docs/concepts/containers/images This field is optional to allow higher level config management to default or override container images in workload controllers like Deployments and StatefulSets.
   *
   * @schema io.k8s.api.core.v1.Container#image
   */
  readonly image?: string;
  /**
   * Image pull policy. One of Always, Never, IfNotPresent. Defaults to Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
   *
   * @default Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
   * @schema io.k8s.api.core.v1.Container#imagePullPolicy
   */
  readonly imagePullPolicy?: string;
  /**
   * Actions that the management system should take in response to container lifecycle events. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.Container#lifecycle
   */
  readonly lifecycle?: Lifecycle;
  /**
   * Periodic probe of container liveness. Container will be restarted if the probe fails. Cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
   *
   * @schema io.k8s.api.core.v1.Container#livenessProbe
   */
  readonly livenessProbe?: Probe;
  /**
   * Name of the container specified as a DNS_LABEL. Each container in a pod must have a unique name (DNS_LABEL). Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.Container#name
   */
  readonly name: string;
  /**
   * List of ports to expose from the container. Exposing a port here gives the system additional information about the network connections a container uses, but is primarily informational. Not specifying a port here DOES NOT prevent that port from being exposed. Any port which is listening on the default "0.0.0.0" address inside a container will be accessible from the network. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.Container#ports
   */
  readonly ports?: ContainerPort[];
  /**
   * Periodic probe of container service readiness. Container will be removed from service endpoints if the probe fails. Cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
   *
   * @schema io.k8s.api.core.v1.Container#readinessProbe
   */
  readonly readinessProbe?: Probe;
  /**
   * Compute Resources required by this container. Cannot be updated. More info: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
   *
   * @schema io.k8s.api.core.v1.Container#resources
   */
  readonly resources?: ResourceRequirements;
  /**
   * SecurityContext defines the security options the container should be run with. If set, the fields of SecurityContext override the equivalent fields of PodSecurityContext. More info: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/
   *
   * @schema io.k8s.api.core.v1.Container#securityContext
   */
  readonly securityContext?: SecurityContext;
  /**
   * StartupProbe indicates that the Pod has successfully initialized. If specified, no other probes are executed until this completes successfully. If this probe fails, the Pod will be restarted, just as if the livenessProbe failed. This can be used to provide different probe parameters at the beginning of a Pod's lifecycle, when it might take a long time to load data or warm a cache, than during steady-state operation. This cannot be updated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
   *
   * @schema io.k8s.api.core.v1.Container#startupProbe
   */
  readonly startupProbe?: Probe;
  /**
   * Whether this container should allocate a buffer for stdin in the container runtime. If this is not set, reads from stdin in the container will always result in EOF. Default is false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.Container#stdin
   */
  readonly stdin?: boolean;
  /**
   * Whether the container runtime should close the stdin channel after it has been opened by a single attach. When stdin is true the stdin stream will remain open across multiple attach sessions. If stdinOnce is set to true, stdin is opened on container start, is empty until the first client attaches to stdin, and then remains open and accepts data until the client disconnects, at which time stdin is closed and remains closed until the container is restarted. If this flag is false, a container processes that reads from stdin will never receive an EOF. Default is false
   *
   * @default false
   * @schema io.k8s.api.core.v1.Container#stdinOnce
   */
  readonly stdinOnce?: boolean;
  /**
   * Optional: Path at which the file to which the container's termination message will be written is mounted into the container's filesystem. Message written is intended to be brief final status, such as an assertion failure message. Will be truncated by the node if greater than 4096 bytes. The total message length across all containers will be limited to 12kb. Defaults to /dev/termination-log. Cannot be updated.
   *
   * @default dev/termination-log. Cannot be updated.
   * @schema io.k8s.api.core.v1.Container#terminationMessagePath
   */
  readonly terminationMessagePath?: string;
  /**
   * Indicate how the termination message should be populated. File will use the contents of terminationMessagePath to populate the container status message on both success and failure. FallbackToLogsOnError will use the last chunk of container log output if the termination message file is empty and the container exited with an error. The log output is limited to 2048 bytes or 80 lines, whichever is smaller. Defaults to File. Cannot be updated.
   *
   * @default File. Cannot be updated.
   * @schema io.k8s.api.core.v1.Container#terminationMessagePolicy
   */
  readonly terminationMessagePolicy?: string;
  /**
   * Whether this container should allocate a TTY for itself, also requires 'stdin' to be true. Default is false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.Container#tty
   */
  readonly tty?: boolean;
  /**
   * volumeDevices is the list of block devices to be used by the container.
   *
   * @schema io.k8s.api.core.v1.Container#volumeDevices
   */
  readonly volumeDevices?: VolumeDevice[];
  /**
   * Pod volumes to mount into the container's filesystem. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.Container#volumeMounts
   */
  readonly volumeMounts?: VolumeMount[];
  /**
   * Container's working directory. If not specified, the container runtime's default will be used, which might be configured in the container image. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.Container#workingDir
   */
  readonly workingDir?: string;
}
/**
 * Converts an object of type 'Container' to JSON representation.
 */
export declare function toJson_Container(
  obj: Container | undefined,
): Record<string, any> | undefined;
/**
 * PodDNSConfig defines the DNS parameters of a pod in addition to those generated from DNSPolicy.
 *
 * @schema io.k8s.api.core.v1.PodDNSConfig
 */
export interface PodDnsConfig {
  /**
   * A list of DNS name server IP addresses. This will be appended to the base nameservers generated from DNSPolicy. Duplicated nameservers will be removed.
   *
   * @schema io.k8s.api.core.v1.PodDNSConfig#nameservers
   */
  readonly nameservers?: string[];
  /**
   * A list of DNS resolver options. This will be merged with the base options generated from DNSPolicy. Duplicated entries will be removed. Resolution options given in Options will override those that appear in the base DNSPolicy.
   *
   * @schema io.k8s.api.core.v1.PodDNSConfig#options
   */
  readonly options?: PodDnsConfigOption[];
  /**
   * A list of DNS search domains for host-name lookup. This will be appended to the base search paths generated from DNSPolicy. Duplicated search paths will be removed.
   *
   * @schema io.k8s.api.core.v1.PodDNSConfig#searches
   */
  readonly searches?: string[];
}
/**
 * Converts an object of type 'PodDnsConfig' to JSON representation.
 */
export declare function toJson_PodDnsConfig(
  obj: PodDnsConfig | undefined,
): Record<string, any> | undefined;
/**
 * An EphemeralContainer is a container that may be added temporarily to an existing pod for user-initiated activities such as debugging. Ephemeral containers have no resource or scheduling guarantees, and they will not be restarted when they exit or when a pod is removed or restarted. If an ephemeral container causes a pod to exceed its resource allocation, the pod may be evicted. Ephemeral containers may not be added by directly updating the pod spec. They must be added via the pod's ephemeralcontainers subresource, and they will appear in the pod spec once added. This is an alpha feature enabled by the EphemeralContainers feature flag.
 *
 * @schema io.k8s.api.core.v1.EphemeralContainer
 */
export interface EphemeralContainer {
  /**
   * Arguments to the entrypoint. The docker image's CMD is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#args
   */
  readonly args?: string[];
  /**
   * Entrypoint array. Not executed within a shell. The docker image's ENTRYPOINT is used if this is not provided. Variable references $(VAR_NAME) are expanded using the container's environment. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Cannot be updated. More info: https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/#running-a-command-in-a-shell
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#command
   */
  readonly command?: string[];
  /**
   * List of environment variables to set in the container. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#env
   */
  readonly env?: EnvVar[];
  /**
   * List of sources to populate environment variables in the container. The keys defined within a source must be a C_IDENTIFIER. All invalid keys will be reported as an event when the container is starting. When a key exists in multiple sources, the value associated with the last source will take precedence. Values defined by an Env with a duplicate key will take precedence. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#envFrom
   */
  readonly envFrom?: EnvFromSource[];
  /**
   * Docker image name. More info: https://kubernetes.io/docs/concepts/containers/images
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#image
   */
  readonly image?: string;
  /**
   * Image pull policy. One of Always, Never, IfNotPresent. Defaults to Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
   *
   * @default Always if :latest tag is specified, or IfNotPresent otherwise. Cannot be updated. More info: https://kubernetes.io/docs/concepts/containers/images#updating-images
   * @schema io.k8s.api.core.v1.EphemeralContainer#imagePullPolicy
   */
  readonly imagePullPolicy?: string;
  /**
   * Lifecycle is not allowed for ephemeral containers.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#lifecycle
   */
  readonly lifecycle?: Lifecycle;
  /**
   * Probes are not allowed for ephemeral containers.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#livenessProbe
   */
  readonly livenessProbe?: Probe;
  /**
   * Name of the ephemeral container specified as a DNS_LABEL. This name must be unique among all containers, init containers and ephemeral containers.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#name
   */
  readonly name: string;
  /**
   * Ports are not allowed for ephemeral containers.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#ports
   */
  readonly ports?: ContainerPort[];
  /**
   * Probes are not allowed for ephemeral containers.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#readinessProbe
   */
  readonly readinessProbe?: Probe;
  /**
   * Resources are not allowed for ephemeral containers. Ephemeral containers use spare resources already allocated to the pod.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#resources
   */
  readonly resources?: ResourceRequirements;
  /**
   * Optional: SecurityContext defines the security options the ephemeral container should be run with. If set, the fields of SecurityContext override the equivalent fields of PodSecurityContext.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#securityContext
   */
  readonly securityContext?: SecurityContext;
  /**
   * Probes are not allowed for ephemeral containers.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#startupProbe
   */
  readonly startupProbe?: Probe;
  /**
   * Whether this container should allocate a buffer for stdin in the container runtime. If this is not set, reads from stdin in the container will always result in EOF. Default is false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.EphemeralContainer#stdin
   */
  readonly stdin?: boolean;
  /**
   * Whether the container runtime should close the stdin channel after it has been opened by a single attach. When stdin is true the stdin stream will remain open across multiple attach sessions. If stdinOnce is set to true, stdin is opened on container start, is empty until the first client attaches to stdin, and then remains open and accepts data until the client disconnects, at which time stdin is closed and remains closed until the container is restarted. If this flag is false, a container processes that reads from stdin will never receive an EOF. Default is false
   *
   * @default false
   * @schema io.k8s.api.core.v1.EphemeralContainer#stdinOnce
   */
  readonly stdinOnce?: boolean;
  /**
   * If set, the name of the container from PodSpec that this ephemeral container targets. The ephemeral container will be run in the namespaces (IPC, PID, etc) of this container. If not set then the ephemeral container is run in whatever namespaces are shared for the pod. Note that the container runtime must support this feature.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#targetContainerName
   */
  readonly targetContainerName?: string;
  /**
   * Optional: Path at which the file to which the container's termination message will be written is mounted into the container's filesystem. Message written is intended to be brief final status, such as an assertion failure message. Will be truncated by the node if greater than 4096 bytes. The total message length across all containers will be limited to 12kb. Defaults to /dev/termination-log. Cannot be updated.
   *
   * @default dev/termination-log. Cannot be updated.
   * @schema io.k8s.api.core.v1.EphemeralContainer#terminationMessagePath
   */
  readonly terminationMessagePath?: string;
  /**
   * Indicate how the termination message should be populated. File will use the contents of terminationMessagePath to populate the container status message on both success and failure. FallbackToLogsOnError will use the last chunk of container log output if the termination message file is empty and the container exited with an error. The log output is limited to 2048 bytes or 80 lines, whichever is smaller. Defaults to File. Cannot be updated.
   *
   * @default File. Cannot be updated.
   * @schema io.k8s.api.core.v1.EphemeralContainer#terminationMessagePolicy
   */
  readonly terminationMessagePolicy?: string;
  /**
   * Whether this container should allocate a TTY for itself, also requires 'stdin' to be true. Default is false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.EphemeralContainer#tty
   */
  readonly tty?: boolean;
  /**
   * volumeDevices is the list of block devices to be used by the container.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#volumeDevices
   */
  readonly volumeDevices?: VolumeDevice[];
  /**
   * Pod volumes to mount into the container's filesystem. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#volumeMounts
   */
  readonly volumeMounts?: VolumeMount[];
  /**
   * Container's working directory. If not specified, the container runtime's default will be used, which might be configured in the container image. Cannot be updated.
   *
   * @schema io.k8s.api.core.v1.EphemeralContainer#workingDir
   */
  readonly workingDir?: string;
}
/**
 * Converts an object of type 'EphemeralContainer' to JSON representation.
 */
export declare function toJson_EphemeralContainer(
  obj: EphemeralContainer | undefined,
): Record<string, any> | undefined;
/**
 * HostAlias holds the mapping between IP and hostnames that will be injected as an entry in the pod's hosts file.
 *
 * @schema io.k8s.api.core.v1.HostAlias
 */
export interface HostAlias {
  /**
   * Hostnames for the above IP address.
   *
   * @schema io.k8s.api.core.v1.HostAlias#hostnames
   */
  readonly hostnames?: string[];
  /**
   * IP address of the host file entry.
   *
   * @schema io.k8s.api.core.v1.HostAlias#ip
   */
  readonly ip?: string;
}
/**
 * Converts an object of type 'HostAlias' to JSON representation.
 */
export declare function toJson_HostAlias(
  obj: HostAlias | undefined,
): Record<string, any> | undefined;
/**
 * PodReadinessGate contains the reference to a pod condition
 *
 * @schema io.k8s.api.core.v1.PodReadinessGate
 */
export interface PodReadinessGate {
  /**
   * ConditionType refers to a condition in the pod's condition list with matching type.
   *
   * @schema io.k8s.api.core.v1.PodReadinessGate#conditionType
   */
  readonly conditionType: string;
}
/**
 * Converts an object of type 'PodReadinessGate' to JSON representation.
 */
export declare function toJson_PodReadinessGate(
  obj: PodReadinessGate | undefined,
): Record<string, any> | undefined;
/**
 * PodSecurityContext holds pod-level security attributes and common container settings. Some fields are also present in container.securityContext.  Field values of container.securityContext take precedence over field values of PodSecurityContext.
 *
 * @schema io.k8s.api.core.v1.PodSecurityContext
 */
export interface PodSecurityContext {
  /**
   * A special supplemental group that applies to all containers in a pod. Some volume types allow the Kubelet to change the ownership of that volume to be owned by the pod:
   *
   * 1. The owning GID will be the FSGroup 2. The setgid bit is set (new files created in the volume will be owned by FSGroup) 3. The permission bits are OR'd with rw-rw----
   *
   * If unset, the Kubelet will not modify the ownership and permissions of any volume.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#fsGroup
   */
  readonly fsGroup?: number;
  /**
   * fsGroupChangePolicy defines behavior of changing ownership and permission of the volume before being exposed inside Pod. This field will only apply to volume types which support fsGroup based ownership(and permissions). It will have no effect on ephemeral volume types such as: secret, configmaps and emptydir. Valid values are "OnRootMismatch" and "Always". If not specified, "Always" is used.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#fsGroupChangePolicy
   */
  readonly fsGroupChangePolicy?: string;
  /**
   * The GID to run the entrypoint of the container process. Uses runtime default if unset. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#runAsGroup
   */
  readonly runAsGroup?: number;
  /**
   * Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#runAsNonRoot
   */
  readonly runAsNonRoot?: boolean;
  /**
   * The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container.
   *
   * @default user specified in image metadata if unspecified. May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container.
   * @schema io.k8s.api.core.v1.PodSecurityContext#runAsUser
   */
  readonly runAsUser?: number;
  /**
   * The SELinux context to be applied to all containers. If unspecified, the container runtime will allocate a random SELinux context for each container.  May also be set in SecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence for that container.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#seLinuxOptions
   */
  readonly seLinuxOptions?: SeLinuxOptions;
  /**
   * The seccomp options to use by the containers in this pod.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#seccompProfile
   */
  readonly seccompProfile?: SeccompProfile;
  /**
   * A list of groups applied to the first process run in each container, in addition to the container's primary GID.  If unspecified, no groups will be added to any container.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#supplementalGroups
   */
  readonly supplementalGroups?: number[];
  /**
   * Sysctls hold a list of namespaced sysctls used for the pod. Pods with unsupported sysctls (by the container runtime) might fail to launch.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#sysctls
   */
  readonly sysctls?: Sysctl[];
  /**
   * The Windows specific settings applied to all containers. If unspecified, the options within a container's SecurityContext will be used. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @schema io.k8s.api.core.v1.PodSecurityContext#windowsOptions
   */
  readonly windowsOptions?: WindowsSecurityContextOptions;
}
/**
 * Converts an object of type 'PodSecurityContext' to JSON representation.
 */
export declare function toJson_PodSecurityContext(
  obj: PodSecurityContext | undefined,
): Record<string, any> | undefined;
/**
 * The pod this Toleration is attached to tolerates any taint that matches the triple <key,value,effect> using the matching operator <operator>.
 *
 * @schema io.k8s.api.core.v1.Toleration
 */
export interface Toleration {
  /**
   * Effect indicates the taint effect to match. Empty means match all taint effects. When specified, allowed values are NoSchedule, PreferNoSchedule and NoExecute.
   *
   * @schema io.k8s.api.core.v1.Toleration#effect
   */
  readonly effect?: string;
  /**
   * Key is the taint key that the toleration applies to. Empty means match all taint keys. If the key is empty, operator must be Exists; this combination means to match all values and all keys.
   *
   * @schema io.k8s.api.core.v1.Toleration#key
   */
  readonly key?: string;
  /**
   * Operator represents a key's relationship to the value. Valid operators are Exists and Equal. Defaults to Equal. Exists is equivalent to wildcard for value, so that a pod can tolerate all taints of a particular category.
   *
   * @default Equal. Exists is equivalent to wildcard for value, so that a pod can tolerate all taints of a particular category.
   * @schema io.k8s.api.core.v1.Toleration#operator
   */
  readonly operator?: string;
  /**
   * TolerationSeconds represents the period of time the toleration (which must be of effect NoExecute, otherwise this field is ignored) tolerates the taint. By default, it is not set, which means tolerate the taint forever (do not evict). Zero and negative values will be treated as 0 (evict immediately) by the system.
   *
   * @schema io.k8s.api.core.v1.Toleration#tolerationSeconds
   */
  readonly tolerationSeconds?: number;
  /**
   * Value is the taint value the toleration matches to. If the operator is Exists, the value should be empty, otherwise just a regular string.
   *
   * @schema io.k8s.api.core.v1.Toleration#value
   */
  readonly value?: string;
}
/**
 * Converts an object of type 'Toleration' to JSON representation.
 */
export declare function toJson_Toleration(
  obj: Toleration | undefined,
): Record<string, any> | undefined;
/**
 * TopologySpreadConstraint specifies how to spread matching pods among the given topology.
 *
 * @schema io.k8s.api.core.v1.TopologySpreadConstraint
 */
export interface TopologySpreadConstraint {
  /**
   * LabelSelector is used to find matching pods. Pods that match this label selector are counted to determine the number of pods in their corresponding topology domain.
   *
   * @schema io.k8s.api.core.v1.TopologySpreadConstraint#labelSelector
   */
  readonly labelSelector?: LabelSelector;
  /**
   * MaxSkew describes the degree to which pods may be unevenly distributed. When `whenUnsatisfiable=DoNotSchedule`, it is the maximum permitted difference between the number of matching pods in the target topology and the global minimum. For example, in a 3-zone cluster, MaxSkew is set to 1, and pods with the same labelSelector spread as 1/1/0: | zone1 | zone2 | zone3 | |   P   |   P   |       | - if MaxSkew is 1, incoming pod can only be scheduled to zone3 to become 1/1/1; scheduling it onto zone1(zone2) would make the ActualSkew(2-0) on zone1(zone2) violate MaxSkew(1). - if MaxSkew is 2, incoming pod can be scheduled onto any zone. When `whenUnsatisfiable=ScheduleAnyway`, it is used to give higher precedence to topologies that satisfy it. It's a required field. Default value is 1 and 0 is not allowed.
   *
   * @schema io.k8s.api.core.v1.TopologySpreadConstraint#maxSkew
   */
  readonly maxSkew: number;
  /**
   * TopologyKey is the key of node labels. Nodes that have a label with this key and identical values are considered to be in the same topology. We consider each <key, value> as a "bucket", and try to put balanced number of pods into each bucket. It's a required field.
   *
   * @schema io.k8s.api.core.v1.TopologySpreadConstraint#topologyKey
   */
  readonly topologyKey: string;
  /**
   * WhenUnsatisfiable indicates how to deal with a pod if it doesn't satisfy the spread constraint. - DoNotSchedule (default) tells the scheduler not to schedule it. - ScheduleAnyway tells the scheduler to schedule the pod in any location,
   * but giving higher precedence to topologies that would help reduce the
   * skew.
   * A constraint is considered "Unsatisfiable" for an incoming pod if and only if every possible node assigment for that pod would violate "MaxSkew" on some topology. For example, in a 3-zone cluster, MaxSkew is set to 1, and pods with the same labelSelector spread as 3/1/1: | zone1 | zone2 | zone3 | | P P P |   P   |   P   | If WhenUnsatisfiable is set to DoNotSchedule, incoming pod can only be scheduled to zone2(zone3) to become 3/2/1(3/1/2) as ActualSkew(2-1) on zone2(zone3) satisfies MaxSkew(1). In other words, the cluster can still be imbalanced, but scheduler won't make it *more* imbalanced. It's a required field.
   *
   * @schema io.k8s.api.core.v1.TopologySpreadConstraint#whenUnsatisfiable
   */
  readonly whenUnsatisfiable: string;
}
/**
 * Converts an object of type 'TopologySpreadConstraint' to JSON representation.
 */
export declare function toJson_TopologySpreadConstraint(
  obj: TopologySpreadConstraint | undefined,
): Record<string, any> | undefined;
/**
 * Volume represents a named volume in a pod that may be accessed by any container in the pod.
 *
 * @schema io.k8s.api.core.v1.Volume
 */
export interface Volume {
  /**
   * AWSElasticBlockStore represents an AWS Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes#awselasticblockstore
   *
   * @schema io.k8s.api.core.v1.Volume#awsElasticBlockStore
   */
  readonly awsElasticBlockStore?: AwsElasticBlockStoreVolumeSource;
  /**
   * AzureDisk represents an Azure Data Disk mount on the host and bind mount to the pod.
   *
   * @schema io.k8s.api.core.v1.Volume#azureDisk
   */
  readonly azureDisk?: AzureDiskVolumeSource;
  /**
   * AzureFile represents an Azure File Service mount on the host and bind mount to the pod.
   *
   * @schema io.k8s.api.core.v1.Volume#azureFile
   */
  readonly azureFile?: AzureFileVolumeSource;
  /**
   * CephFS represents a Ceph FS mount on the host that shares a pod's lifetime
   *
   * @schema io.k8s.api.core.v1.Volume#cephfs
   */
  readonly cephfs?: CephFsVolumeSource;
  /**
   * Cinder represents a cinder volume attached and mounted on kubelets host machine. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @schema io.k8s.api.core.v1.Volume#cinder
   */
  readonly cinder?: CinderVolumeSource;
  /**
   * ConfigMap represents a configMap that should populate this volume
   *
   * @schema io.k8s.api.core.v1.Volume#configMap
   */
  readonly configMap?: ConfigMapVolumeSource;
  /**
   * CSI (Container Storage Interface) represents ephemeral storage that is handled by certain external CSI drivers (Beta feature).
   *
   * @schema io.k8s.api.core.v1.Volume#csi
   */
  readonly csi?: CsiVolumeSource;
  /**
   * DownwardAPI represents downward API about the pod that should populate this volume
   *
   * @schema io.k8s.api.core.v1.Volume#downwardAPI
   */
  readonly downwardApi?: DownwardApiVolumeSource;
  /**
   * EmptyDir represents a temporary directory that shares a pod's lifetime. More info: https://kubernetes.io/docs/concepts/storage/volumes#emptydir
   *
   * @schema io.k8s.api.core.v1.Volume#emptyDir
   */
  readonly emptyDir?: EmptyDirVolumeSource;
  /**
   * Ephemeral represents a volume that is handled by a cluster storage driver. The volume's lifecycle is tied to the pod that defines it - it will be created before the pod starts, and deleted when the pod is removed.
   *
   * Use this if: a) the volume is only needed while the pod runs, b) features of normal volumes like restoring from snapshot or capacity
   * tracking are needed,
   * c) the storage driver is specified through a storage class, and d) the storage driver supports dynamic volume provisioning through
   * a PersistentVolumeClaim (see EphemeralVolumeSource for more
   * information on the connection between this volume type
   * and PersistentVolumeClaim).
   *
   * Use PersistentVolumeClaim or one of the vendor-specific APIs for volumes that persist for longer than the lifecycle of an individual pod.
   *
   * Use CSI for light-weight local ephemeral volumes if the CSI driver is meant to be used that way - see the documentation of the driver for more information.
   *
   * A pod can use both types of ephemeral volumes and persistent volumes at the same time.
   *
   * This is a beta feature and only available when the GenericEphemeralVolume feature gate is enabled.
   *
   * @schema io.k8s.api.core.v1.Volume#ephemeral
   */
  readonly ephemeral?: EphemeralVolumeSource;
  /**
   * FC represents a Fibre Channel resource that is attached to a kubelet's host machine and then exposed to the pod.
   *
   * @schema io.k8s.api.core.v1.Volume#fc
   */
  readonly fc?: FcVolumeSource;
  /**
   * FlexVolume represents a generic volume resource that is provisioned/attached using an exec based plugin.
   *
   * @schema io.k8s.api.core.v1.Volume#flexVolume
   */
  readonly flexVolume?: FlexVolumeSource;
  /**
   * Flocker represents a Flocker volume attached to a kubelet's host machine. This depends on the Flocker control service being running
   *
   * @schema io.k8s.api.core.v1.Volume#flocker
   */
  readonly flocker?: FlockerVolumeSource;
  /**
   * GCEPersistentDisk represents a GCE Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://kubernetes.io/docs/concepts/storage/volumes#gcepersistentdisk
   *
   * @schema io.k8s.api.core.v1.Volume#gcePersistentDisk
   */
  readonly gcePersistentDisk?: GcePersistentDiskVolumeSource;
  /**
   * GitRepo represents a git repository at a particular revision. DEPRECATED: GitRepo is deprecated. To provision a container with a git repo, mount an EmptyDir into an InitContainer that clones the repo using git, then mount the EmptyDir into the Pod's container.
   *
   * @schema io.k8s.api.core.v1.Volume#gitRepo
   */
  readonly gitRepo?: GitRepoVolumeSource;
  /**
   * Glusterfs represents a Glusterfs mount on the host that shares a pod's lifetime. More info: https://examples.k8s.io/volumes/glusterfs/README.md
   *
   * @schema io.k8s.api.core.v1.Volume#glusterfs
   */
  readonly glusterfs?: GlusterfsVolumeSource;
  /**
   * HostPath represents a pre-existing file or directory on the host machine that is directly exposed to the container. This is generally used for system agents or other privileged things that are allowed to see the host machine. Most containers will NOT need this. More info: https://kubernetes.io/docs/concepts/storage/volumes#hostpath
   *
   * @schema io.k8s.api.core.v1.Volume#hostPath
   */
  readonly hostPath?: HostPathVolumeSource;
  /**
   * ISCSI represents an ISCSI Disk resource that is attached to a kubelet's host machine and then exposed to the pod. More info: https://examples.k8s.io/volumes/iscsi/README.md
   *
   * @schema io.k8s.api.core.v1.Volume#iscsi
   */
  readonly iscsi?: IscsiVolumeSource;
  /**
   * Volume's name. Must be a DNS_LABEL and unique within the pod. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.Volume#name
   */
  readonly name: string;
  /**
   * NFS represents an NFS mount on the host that shares a pod's lifetime More info: https://kubernetes.io/docs/concepts/storage/volumes#nfs
   *
   * @schema io.k8s.api.core.v1.Volume#nfs
   */
  readonly nfs?: NfsVolumeSource;
  /**
   * PersistentVolumeClaimVolumeSource represents a reference to a PersistentVolumeClaim in the same namespace. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims
   *
   * @schema io.k8s.api.core.v1.Volume#persistentVolumeClaim
   */
  readonly persistentVolumeClaim?: PersistentVolumeClaimVolumeSource;
  /**
   * PhotonPersistentDisk represents a PhotonController persistent disk attached and mounted on kubelets host machine
   *
   * @schema io.k8s.api.core.v1.Volume#photonPersistentDisk
   */
  readonly photonPersistentDisk?: PhotonPersistentDiskVolumeSource;
  /**
   * PortworxVolume represents a portworx volume attached and mounted on kubelets host machine
   *
   * @schema io.k8s.api.core.v1.Volume#portworxVolume
   */
  readonly portworxVolume?: PortworxVolumeSource;
  /**
   * Items for all in one resources secrets, configmaps, and downward API
   *
   * @schema io.k8s.api.core.v1.Volume#projected
   */
  readonly projected?: ProjectedVolumeSource;
  /**
   * Quobyte represents a Quobyte mount on the host that shares a pod's lifetime
   *
   * @schema io.k8s.api.core.v1.Volume#quobyte
   */
  readonly quobyte?: QuobyteVolumeSource;
  /**
   * RBD represents a Rados Block Device mount on the host that shares a pod's lifetime. More info: https://examples.k8s.io/volumes/rbd/README.md
   *
   * @schema io.k8s.api.core.v1.Volume#rbd
   */
  readonly rbd?: RbdVolumeSource;
  /**
   * ScaleIO represents a ScaleIO persistent volume attached and mounted on Kubernetes nodes.
   *
   * @schema io.k8s.api.core.v1.Volume#scaleIO
   */
  readonly scaleIo?: ScaleIoVolumeSource;
  /**
   * Secret represents a secret that should populate this volume. More info: https://kubernetes.io/docs/concepts/storage/volumes#secret
   *
   * @schema io.k8s.api.core.v1.Volume#secret
   */
  readonly secret?: SecretVolumeSource;
  /**
   * StorageOS represents a StorageOS volume attached and mounted on Kubernetes nodes.
   *
   * @schema io.k8s.api.core.v1.Volume#storageos
   */
  readonly storageos?: StorageOsVolumeSource;
  /**
   * VsphereVolume represents a vSphere volume attached and mounted on kubelets host machine
   *
   * @schema io.k8s.api.core.v1.Volume#vsphereVolume
   */
  readonly vsphereVolume?: VsphereVirtualDiskVolumeSource;
}
/**
 * Converts an object of type 'Volume' to JSON representation.
 */
export declare function toJson_Volume(
  obj: Volume | undefined,
): Record<string, any> | undefined;
/**
 * A scope selector represents the AND of the selectors represented by the scoped-resource selector requirements.
 *
 * @schema io.k8s.api.core.v1.ScopeSelector
 */
export interface ScopeSelector {
  /**
   * A list of scope selector requirements by scope of the resources.
   *
   * @schema io.k8s.api.core.v1.ScopeSelector#matchExpressions
   */
  readonly matchExpressions?: ScopedResourceSelectorRequirement[];
}
/**
 * Converts an object of type 'ScopeSelector' to JSON representation.
 */
export declare function toJson_ScopeSelector(
  obj: ScopeSelector | undefined,
): Record<string, any> | undefined;
/**
 * ServicePort contains information on service's port.
 *
 * @schema io.k8s.api.core.v1.ServicePort
 */
export interface ServicePort {
  /**
   * The application protocol for this port. This field follows standard Kubernetes label syntax. Un-prefixed names are reserved for IANA standard service names (as per RFC-6335 and http://www.iana.org/assignments/service-names). Non-standard protocols should use prefixed names such as mycompany.com/my-custom-protocol.
   *
   * @schema io.k8s.api.core.v1.ServicePort#appProtocol
   */
  readonly appProtocol?: string;
  /**
   * The name of this port within the service. This must be a DNS_LABEL. All ports within a ServiceSpec must have unique names. When considering the endpoints for a Service, this must match the 'name' field in the EndpointPort. Optional if only one ServicePort is defined on this service.
   *
   * @schema io.k8s.api.core.v1.ServicePort#name
   */
  readonly name?: string;
  /**
   * The port on each node on which this service is exposed when type is NodePort or LoadBalancer.  Usually assigned by the system. If a value is specified, in-range, and not in use it will be used, otherwise the operation will fail.  If not specified, a port will be allocated if this Service requires one.  If this field is specified when creating a Service which does not need it, creation will fail. This field will be wiped when updating a Service to no longer need it (e.g. changing type from NodePort to ClusterIP). More info: https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport
   *
   * @schema io.k8s.api.core.v1.ServicePort#nodePort
   */
  readonly nodePort?: number;
  /**
   * The port that will be exposed by this service.
   *
   * @schema io.k8s.api.core.v1.ServicePort#port
   */
  readonly port: number;
  /**
   * The IP protocol for this port. Supports "TCP", "UDP", and "SCTP". Default is TCP.
   *
   * @default TCP.
   * @schema io.k8s.api.core.v1.ServicePort#protocol
   */
  readonly protocol?: string;
  /**
   * Number or name of the port to access on the pods targeted by the service. Number must be in the range 1 to 65535. Name must be an IANA_SVC_NAME. If this is a string, it will be looked up as a named port in the target Pod's container ports. If this is not specified, the value of the 'port' field is used (an identity map). This field is ignored for services with clusterIP=None, and should be omitted or set equal to the 'port' field. More info: https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service
   *
   * @schema io.k8s.api.core.v1.ServicePort#targetPort
   */
  readonly targetPort?: IntOrString;
}
/**
 * Converts an object of type 'ServicePort' to JSON representation.
 */
export declare function toJson_ServicePort(
  obj: ServicePort | undefined,
): Record<string, any> | undefined;
/**
 * SessionAffinityConfig represents the configurations of session affinity.
 *
 * @schema io.k8s.api.core.v1.SessionAffinityConfig
 */
export interface SessionAffinityConfig {
  /**
   * clientIP contains the configurations of Client IP based session affinity.
   *
   * @schema io.k8s.api.core.v1.SessionAffinityConfig#clientIP
   */
  readonly clientIp?: ClientIpConfig;
}
/**
 * Converts an object of type 'SessionAffinityConfig' to JSON representation.
 */
export declare function toJson_SessionAffinityConfig(
  obj: SessionAffinityConfig | undefined,
): Record<string, any> | undefined;
/**
 * EndpointConditions represents the current condition of an endpoint.
 *
 * @schema io.k8s.api.discovery.v1.EndpointConditions
 */
export interface EndpointConditions {
  /**
   * ready indicates that this endpoint is prepared to receive traffic, according to whatever system is managing the endpoint. A nil value indicates an unknown state. In most cases consumers should interpret this unknown state as ready. For compatibility reasons, ready should never be "true" for terminating endpoints.
   *
   * @schema io.k8s.api.discovery.v1.EndpointConditions#ready
   */
  readonly ready?: boolean;
  /**
   * serving is identical to ready except that it is set regardless of the terminating state of endpoints. This condition should be set to true for a ready endpoint that is terminating. If nil, consumers should defer to the ready condition. This field can be enabled with the EndpointSliceTerminatingCondition feature gate.
   *
   * @schema io.k8s.api.discovery.v1.EndpointConditions#serving
   */
  readonly serving?: boolean;
  /**
   * terminating indicates that this endpoint is terminating. A nil value indicates an unknown state. Consumers should interpret this unknown state to mean that the endpoint is not terminating. This field can be enabled with the EndpointSliceTerminatingCondition feature gate.
   *
   * @schema io.k8s.api.discovery.v1.EndpointConditions#terminating
   */
  readonly terminating?: boolean;
}
/**
 * Converts an object of type 'EndpointConditions' to JSON representation.
 */
export declare function toJson_EndpointConditions(
  obj: EndpointConditions | undefined,
): Record<string, any> | undefined;
/**
 * EndpointHints provides hints describing how an endpoint should be consumed.
 *
 * @schema io.k8s.api.discovery.v1.EndpointHints
 */
export interface EndpointHints {
  /**
   * forZones indicates the zone(s) this endpoint should be consumed by to enable topology aware routing.
   *
   * @schema io.k8s.api.discovery.v1.EndpointHints#forZones
   */
  readonly forZones?: ForZone[];
}
/**
 * Converts an object of type 'EndpointHints' to JSON representation.
 */
export declare function toJson_EndpointHints(
  obj: EndpointHints | undefined,
): Record<string, any> | undefined;
/**
 * EndpointConditions represents the current condition of an endpoint.
 *
 * @schema io.k8s.api.discovery.v1beta1.EndpointConditions
 */
export interface EndpointConditionsV1Beta1 {
  /**
   * ready indicates that this endpoint is prepared to receive traffic, according to whatever system is managing the endpoint. A nil value indicates an unknown state. In most cases consumers should interpret this unknown state as ready. For compatibility reasons, ready should never be "true" for terminating endpoints.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointConditions#ready
   */
  readonly ready?: boolean;
  /**
   * serving is identical to ready except that it is set regardless of the terminating state of endpoints. This condition should be set to true for a ready endpoint that is terminating. If nil, consumers should defer to the ready condition. This field can be enabled with the EndpointSliceTerminatingCondition feature gate.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointConditions#serving
   */
  readonly serving?: boolean;
  /**
   * terminating indicates that this endpoint is terminating. A nil value indicates an unknown state. Consumers should interpret this unknown state to mean that the endpoint is not terminating. This field can be enabled with the EndpointSliceTerminatingCondition feature gate.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointConditions#terminating
   */
  readonly terminating?: boolean;
}
/**
 * Converts an object of type 'EndpointConditionsV1Beta1' to JSON representation.
 */
export declare function toJson_EndpointConditionsV1Beta1(
  obj: EndpointConditionsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * EndpointHints provides hints describing how an endpoint should be consumed.
 *
 * @schema io.k8s.api.discovery.v1beta1.EndpointHints
 */
export interface EndpointHintsV1Beta1 {
  /**
   * forZones indicates the zone(s) this endpoint should be consumed by to enable topology aware routing. May contain a maximum of 8 entries.
   *
   * @schema io.k8s.api.discovery.v1beta1.EndpointHints#forZones
   */
  readonly forZones?: ForZoneV1Beta1[];
}
/**
 * Converts an object of type 'EndpointHintsV1Beta1' to JSON representation.
 */
export declare function toJson_EndpointHintsV1Beta1(
  obj: EndpointHintsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * FlowDistinguisherMethod specifies the method of a flow distinguisher.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.FlowDistinguisherMethod
 */
export interface FlowDistinguisherMethodV1Beta1 {
  /**
   * `type` is the type of flow distinguisher method The supported types are "ByUser" and "ByNamespace". Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.FlowDistinguisherMethod#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'FlowDistinguisherMethodV1Beta1' to JSON representation.
 */
export declare function toJson_FlowDistinguisherMethodV1Beta1(
  obj: FlowDistinguisherMethodV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * PriorityLevelConfigurationReference contains information that points to the "request-priority" being used.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationReference
 */
export interface PriorityLevelConfigurationReferenceV1Beta1 {
  /**
   * `name` is the name of the priority level configuration being referenced Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PriorityLevelConfigurationReference#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'PriorityLevelConfigurationReferenceV1Beta1' to JSON representation.
 */
export declare function toJson_PriorityLevelConfigurationReferenceV1Beta1(
  obj: PriorityLevelConfigurationReferenceV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * PolicyRulesWithSubjects prescribes a test that applies to a request to an apiserver. The test considers the subject making the request, the verb being requested, and the resource to be acted upon. This PolicyRulesWithSubjects matches a request if and only if both (a) at least one member of subjects matches the request and (b) at least one member of resourceRules or nonResourceRules matches the request.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.PolicyRulesWithSubjects
 */
export interface PolicyRulesWithSubjectsV1Beta1 {
  /**
   * `nonResourceRules` is a list of NonResourcePolicyRules that identify matching requests according to their verb and the target non-resource URL.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PolicyRulesWithSubjects#nonResourceRules
   */
  readonly nonResourceRules?: NonResourcePolicyRuleV1Beta1[];
  /**
   * `resourceRules` is a slice of ResourcePolicyRules that identify matching requests according to their verb and the target resource. At least one of `resourceRules` and `nonResourceRules` has to be non-empty.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PolicyRulesWithSubjects#resourceRules
   */
  readonly resourceRules?: ResourcePolicyRuleV1Beta1[];
  /**
   * subjects is the list of normal user, serviceaccount, or group that this rule cares about. There must be at least one member in this slice. A slice that includes both the system:authenticated and system:unauthenticated user groups matches every request. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.PolicyRulesWithSubjects#subjects
   */
  readonly subjects: SubjectV1Beta1[];
}
/**
 * Converts an object of type 'PolicyRulesWithSubjectsV1Beta1' to JSON representation.
 */
export declare function toJson_PolicyRulesWithSubjectsV1Beta1(
  obj: PolicyRulesWithSubjectsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * LimitedPriorityLevelConfiguration specifies how to handle requests that are subject to limits. It addresses two issues:
 * * How are requests for this priority level limited?
 * * What should be done with requests that exceed the limit?
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.LimitedPriorityLevelConfiguration
 */
export interface LimitedPriorityLevelConfigurationV1Beta1 {
  /**
   * `assuredConcurrencyShares` (ACS) configures the execution limit, which is a limit on the number of requests of this priority level that may be exeucting at a given time.  ACS must be a positive number. The server's concurrency limit (SCL) is divided among the concurrency-controlled priority levels in proportion to their assured concurrency shares. This produces the assured concurrency value (ACV) --- the number of requests that may be executing at a time --- for each such priority level:
   *
   * ACV(l) = ceil( SCL * ACS(l) / ( sum[priority levels k] ACS(k) ) )
   *
   * bigger numbers of ACS mean more reserved concurrent requests (at the expense of every other PL). This field has a default value of 30.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.LimitedPriorityLevelConfiguration#assuredConcurrencyShares
   */
  readonly assuredConcurrencyShares?: number;
  /**
   * `limitResponse` indicates what to do with requests that can not be executed right now
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.LimitedPriorityLevelConfiguration#limitResponse
   */
  readonly limitResponse?: LimitResponseV1Beta1;
}
/**
 * Converts an object of type 'LimitedPriorityLevelConfigurationV1Beta1' to JSON representation.
 */
export declare function toJson_LimitedPriorityLevelConfigurationV1Beta1(
  obj: LimitedPriorityLevelConfigurationV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * IngressBackend describes all endpoints for a given service and port.
 *
 * @schema io.k8s.api.networking.v1.IngressBackend
 */
export interface IngressBackend {
  /**
   * Resource is an ObjectRef to another Kubernetes resource in the namespace of the Ingress object. If resource is specified, a service.Name and service.Port must not be specified. This is a mutually exclusive setting with "Service".
   *
   * @schema io.k8s.api.networking.v1.IngressBackend#resource
   */
  readonly resource?: TypedLocalObjectReference;
  /**
   * Service references a Service as a Backend. This is a mutually exclusive setting with "Resource".
   *
   * @schema io.k8s.api.networking.v1.IngressBackend#service
   */
  readonly service?: IngressServiceBackend;
}
/**
 * Converts an object of type 'IngressBackend' to JSON representation.
 */
export declare function toJson_IngressBackend(
  obj: IngressBackend | undefined,
): Record<string, any> | undefined;
/**
 * IngressRule represents the rules mapping the paths under a specified host to the related backend services. Incoming requests are first evaluated for a host match, then routed to the backend associated with the matching IngressRuleValue.
 *
 * @schema io.k8s.api.networking.v1.IngressRule
 */
export interface IngressRule {
  /**
   * Host is the fully qualified domain name of a network host, as defined by RFC 3986. Note the following deviations from the "host" part of the URI as defined in RFC 3986: 1. IPs are not allowed. Currently an IngressRuleValue can only apply to
   * the IP in the Spec of the parent Ingress.
   * 2. The `:` delimiter is not respected because ports are not allowed.
   * Currently the port of an Ingress is implicitly :80 for http and
   * :443 for https.
   * Both these may change in the future. Incoming requests are matched against the host before the IngressRuleValue. If the host is unspecified, the Ingress routes all traffic based on the specified IngressRuleValue.
   *
   * Host can be "precise" which is a domain name without the terminating dot of a network host (e.g. "foo.bar.com") or "wildcard", which is a domain name prefixed with a single wildcard label (e.g. "*.foo.com"). The wildcard character '*' must appear by itself as the first DNS label and matches only a single label. You cannot have a wildcard label by itself (e.g. Host == "*"). Requests will be matched against the Host field in the following way: 1. If Host is precise, the request matches this rule if the http host header is equal to Host. 2. If Host is a wildcard, then the request matches this rule if the http host header is to equal to the suffix (removing the first label) of the wildcard rule.
   *
   * @schema io.k8s.api.networking.v1.IngressRule#host
   */
  readonly host?: string;
  /**
   * @schema io.k8s.api.networking.v1.IngressRule#http
   */
  readonly http?: HttpIngressRuleValue;
}
/**
 * Converts an object of type 'IngressRule' to JSON representation.
 */
export declare function toJson_IngressRule(
  obj: IngressRule | undefined,
): Record<string, any> | undefined;
/**
 * IngressTLS describes the transport layer security associated with an Ingress.
 *
 * @schema io.k8s.api.networking.v1.IngressTLS
 */
export interface IngressTls {
  /**
   * Hosts are a list of hosts included in the TLS certificate. The values in this list must match the name/s used in the tlsSecret. Defaults to the wildcard host setting for the loadbalancer controller fulfilling this Ingress, if left unspecified.
   *
   * @default the wildcard host setting for the loadbalancer controller fulfilling this Ingress, if left unspecified.
   * @schema io.k8s.api.networking.v1.IngressTLS#hosts
   */
  readonly hosts?: string[];
  /**
   * SecretName is the name of the secret used to terminate TLS traffic on port 443. Field is left optional to allow TLS routing based on SNI hostname alone. If the SNI host in a listener conflicts with the "Host" header field used by an IngressRule, the SNI host is used for termination and value of the Host header is used for routing.
   *
   * @schema io.k8s.api.networking.v1.IngressTLS#secretName
   */
  readonly secretName?: string;
}
/**
 * Converts an object of type 'IngressTls' to JSON representation.
 */
export declare function toJson_IngressTls(
  obj: IngressTls | undefined,
): Record<string, any> | undefined;
/**
 * IngressClassParametersReference identifies an API object. This can be used to specify a cluster or namespace-scoped resource.
 *
 * @schema io.k8s.api.networking.v1.IngressClassParametersReference
 */
export interface IngressClassParametersReference {
  /**
   * APIGroup is the group for the resource being referenced. If APIGroup is not specified, the specified Kind must be in the core API group. For any other third-party types, APIGroup is required.
   *
   * @schema io.k8s.api.networking.v1.IngressClassParametersReference#apiGroup
   */
  readonly apiGroup?: string;
  /**
   * Kind is the type of resource being referenced.
   *
   * @schema io.k8s.api.networking.v1.IngressClassParametersReference#kind
   */
  readonly kind: string;
  /**
   * Name is the name of resource being referenced.
   *
   * @schema io.k8s.api.networking.v1.IngressClassParametersReference#name
   */
  readonly name: string;
  /**
   * Namespace is the namespace of the resource being referenced. This field is required when scope is set to "Namespace" and must be unset when scope is set to "Cluster".
   *
   * @schema io.k8s.api.networking.v1.IngressClassParametersReference#namespace
   */
  readonly namespace?: string;
  /**
   * Scope represents if this refers to a cluster or namespace scoped resource. This may be set to "Cluster" (default) or "Namespace". Field can be enabled with IngressClassNamespacedParams feature gate.
   *
   * @schema io.k8s.api.networking.v1.IngressClassParametersReference#scope
   */
  readonly scope?: string;
}
/**
 * Converts an object of type 'IngressClassParametersReference' to JSON representation.
 */
export declare function toJson_IngressClassParametersReference(
  obj: IngressClassParametersReference | undefined,
): Record<string, any> | undefined;
/**
 * NetworkPolicyEgressRule describes a particular set of traffic that is allowed out of pods matched by a NetworkPolicySpec's podSelector. The traffic must match both ports and to. This type is beta-level in 1.8
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicyEgressRule
 */
export interface NetworkPolicyEgressRule {
  /**
   * List of destination ports for outgoing traffic. Each item in this list is combined using a logical OR. If this field is empty or missing, this rule matches all ports (traffic not restricted by port). If this field is present and contains at least one item, then this rule allows traffic only if the traffic matches at least one port in the list.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyEgressRule#ports
   */
  readonly ports?: NetworkPolicyPort[];
  /**
   * List of destinations for outgoing traffic of pods selected for this rule. Items in this list are combined using a logical OR operation. If this field is empty or missing, this rule matches all destinations (traffic not restricted by destination). If this field is present and contains at least one item, this rule allows traffic only if the traffic matches at least one item in the to list.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyEgressRule#to
   */
  readonly to?: NetworkPolicyPeer[];
}
/**
 * Converts an object of type 'NetworkPolicyEgressRule' to JSON representation.
 */
export declare function toJson_NetworkPolicyEgressRule(
  obj: NetworkPolicyEgressRule | undefined,
): Record<string, any> | undefined;
/**
 * NetworkPolicyIngressRule describes a particular set of traffic that is allowed to the pods matched by a NetworkPolicySpec's podSelector. The traffic must match both ports and from.
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicyIngressRule
 */
export interface NetworkPolicyIngressRule {
  /**
   * List of sources which should be able to access the pods selected for this rule. Items in this list are combined using a logical OR operation. If this field is empty or missing, this rule matches all sources (traffic not restricted by source). If this field is present and contains at least one item, this rule allows traffic only if the traffic matches at least one item in the from list.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyIngressRule#from
   */
  readonly from?: NetworkPolicyPeer[];
  /**
   * List of ports which should be made accessible on the pods selected for this rule. Each item in this list is combined using a logical OR. If this field is empty or missing, this rule matches all ports (traffic not restricted by port). If this field is present and contains at least one item, then this rule allows traffic only if the traffic matches at least one port in the list.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyIngressRule#ports
   */
  readonly ports?: NetworkPolicyPort[];
}
/**
 * Converts an object of type 'NetworkPolicyIngressRule' to JSON representation.
 */
export declare function toJson_NetworkPolicyIngressRule(
  obj: NetworkPolicyIngressRule | undefined,
): Record<string, any> | undefined;
/**
 * Overhead structure represents the resource overhead associated with running a pod.
 *
 * @schema io.k8s.api.node.v1alpha1.Overhead
 */
export interface OverheadV1Alpha1 {
  /**
   * PodFixed represents the fixed resource overhead associated with running a pod.
   *
   * @schema io.k8s.api.node.v1alpha1.Overhead#podFixed
   */
  readonly podFixed?: {
    [key: string]: Quantity;
  };
}
/**
 * Converts an object of type 'OverheadV1Alpha1' to JSON representation.
 */
export declare function toJson_OverheadV1Alpha1(
  obj: OverheadV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * Scheduling specifies the scheduling constraints for nodes supporting a RuntimeClass.
 *
 * @schema io.k8s.api.node.v1alpha1.Scheduling
 */
export interface SchedulingV1Alpha1 {
  /**
   * nodeSelector lists labels that must be present on nodes that support this RuntimeClass. Pods using this RuntimeClass can only be scheduled to a node matched by this selector. The RuntimeClass nodeSelector is merged with a pod's existing nodeSelector. Any conflicts will cause the pod to be rejected in admission.
   *
   * @schema io.k8s.api.node.v1alpha1.Scheduling#nodeSelector
   */
  readonly nodeSelector?: {
    [key: string]: string;
  };
  /**
   * tolerations are appended (excluding duplicates) to pods running with this RuntimeClass during admission, effectively unioning the set of nodes tolerated by the pod and the RuntimeClass.
   *
   * @schema io.k8s.api.node.v1alpha1.Scheduling#tolerations
   */
  readonly tolerations?: Toleration[];
}
/**
 * Converts an object of type 'SchedulingV1Alpha1' to JSON representation.
 */
export declare function toJson_SchedulingV1Alpha1(
  obj: SchedulingV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds
 *
 * @schema IoK8SApimachineryPkgApisMetaV1DeleteOptionsKind
 */
export declare enum IoK8SApimachineryPkgApisMetaV1DeleteOptionsKind {
  /** DeleteOptions */
  DELETE_OPTIONS = 'DeleteOptions',
}
/**
 * Preconditions must be fulfilled before an operation (update, delete, etc.) is carried out.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Preconditions
 */
export interface Preconditions {
  /**
   * Specifies the target ResourceVersion
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Preconditions#resourceVersion
   */
  readonly resourceVersion?: string;
  /**
   * Specifies the target UID.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.Preconditions#uid
   */
  readonly uid?: string;
}
/**
 * Converts an object of type 'Preconditions' to JSON representation.
 */
export declare function toJson_Preconditions(
  obj: Preconditions | undefined,
): Record<string, any> | undefined;
/**
 * @schema io.k8s.apimachinery.pkg.util.intstr.IntOrString
 */
export declare class IntOrString {
  readonly value: any;
  static fromString(value: string): IntOrString;
  static fromNumber(value: number): IntOrString;
  private constructor();
}
/**
 * AllowedCSIDriver represents a single inline CSI Driver that is allowed to be used.
 *
 * @schema io.k8s.api.policy.v1beta1.AllowedCSIDriver
 */
export interface AllowedCsiDriverV1Beta1 {
  /**
   * Name is the registered name of the CSI driver
   *
   * @schema io.k8s.api.policy.v1beta1.AllowedCSIDriver#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'AllowedCsiDriverV1Beta1' to JSON representation.
 */
export declare function toJson_AllowedCsiDriverV1Beta1(
  obj: AllowedCsiDriverV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * AllowedFlexVolume represents a single Flexvolume that is allowed to be used.
 *
 * @schema io.k8s.api.policy.v1beta1.AllowedFlexVolume
 */
export interface AllowedFlexVolumeV1Beta1 {
  /**
   * driver is the name of the Flexvolume driver.
   *
   * @schema io.k8s.api.policy.v1beta1.AllowedFlexVolume#driver
   */
  readonly driver: string;
}
/**
 * Converts an object of type 'AllowedFlexVolumeV1Beta1' to JSON representation.
 */
export declare function toJson_AllowedFlexVolumeV1Beta1(
  obj: AllowedFlexVolumeV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * AllowedHostPath defines the host volume conditions that will be enabled by a policy for pods to use. It requires the path prefix to be defined.
 *
 * @schema io.k8s.api.policy.v1beta1.AllowedHostPath
 */
export interface AllowedHostPathV1Beta1 {
  /**
   * pathPrefix is the path prefix that the host volume must match. It does not support `*`. Trailing slashes are trimmed when validating the path prefix with a host path.
   *
   * Examples: `/foo` would allow `/foo`, `/foo/` and `/foo/bar` `/foo` would not allow `/food` or `/etc/foo`
   *
   * @schema io.k8s.api.policy.v1beta1.AllowedHostPath#pathPrefix
   */
  readonly pathPrefix?: string;
  /**
   * when set to true, will allow host volumes matching the pathPrefix only if all volume mounts are readOnly.
   *
   * @schema io.k8s.api.policy.v1beta1.AllowedHostPath#readOnly
   */
  readonly readOnly?: boolean;
}
/**
 * Converts an object of type 'AllowedHostPathV1Beta1' to JSON representation.
 */
export declare function toJson_AllowedHostPathV1Beta1(
  obj: AllowedHostPathV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * FSGroupStrategyOptions defines the strategy type and options used to create the strategy.
 *
 * @schema io.k8s.api.policy.v1beta1.FSGroupStrategyOptions
 */
export interface FsGroupStrategyOptionsV1Beta1 {
  /**
   * ranges are the allowed ranges of fs groups.  If you would like to force a single fs group then supply a single range with the same start and end. Required for MustRunAs.
   *
   * @schema io.k8s.api.policy.v1beta1.FSGroupStrategyOptions#ranges
   */
  readonly ranges?: IdRangeV1Beta1[];
  /**
   * rule is the strategy that will dictate what FSGroup is used in the SecurityContext.
   *
   * @schema io.k8s.api.policy.v1beta1.FSGroupStrategyOptions#rule
   */
  readonly rule?: string;
}
/**
 * Converts an object of type 'FsGroupStrategyOptionsV1Beta1' to JSON representation.
 */
export declare function toJson_FsGroupStrategyOptionsV1Beta1(
  obj: FsGroupStrategyOptionsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * HostPortRange defines a range of host ports that will be enabled by a policy for pods to use.  It requires both the start and end to be defined.
 *
 * @schema io.k8s.api.policy.v1beta1.HostPortRange
 */
export interface HostPortRangeV1Beta1 {
  /**
   * max is the end of the range, inclusive.
   *
   * @schema io.k8s.api.policy.v1beta1.HostPortRange#max
   */
  readonly max: number;
  /**
   * min is the start of the range, inclusive.
   *
   * @schema io.k8s.api.policy.v1beta1.HostPortRange#min
   */
  readonly min: number;
}
/**
 * Converts an object of type 'HostPortRangeV1Beta1' to JSON representation.
 */
export declare function toJson_HostPortRangeV1Beta1(
  obj: HostPortRangeV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * RunAsGroupStrategyOptions defines the strategy type and any options used to create the strategy.
 *
 * @schema io.k8s.api.policy.v1beta1.RunAsGroupStrategyOptions
 */
export interface RunAsGroupStrategyOptionsV1Beta1 {
  /**
   * ranges are the allowed ranges of gids that may be used. If you would like to force a single gid then supply a single range with the same start and end. Required for MustRunAs.
   *
   * @schema io.k8s.api.policy.v1beta1.RunAsGroupStrategyOptions#ranges
   */
  readonly ranges?: IdRangeV1Beta1[];
  /**
   * rule is the strategy that will dictate the allowable RunAsGroup values that may be set.
   *
   * @schema io.k8s.api.policy.v1beta1.RunAsGroupStrategyOptions#rule
   */
  readonly rule: string;
}
/**
 * Converts an object of type 'RunAsGroupStrategyOptionsV1Beta1' to JSON representation.
 */
export declare function toJson_RunAsGroupStrategyOptionsV1Beta1(
  obj: RunAsGroupStrategyOptionsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * RunAsUserStrategyOptions defines the strategy type and any options used to create the strategy.
 *
 * @schema io.k8s.api.policy.v1beta1.RunAsUserStrategyOptions
 */
export interface RunAsUserStrategyOptionsV1Beta1 {
  /**
   * ranges are the allowed ranges of uids that may be used. If you would like to force a single uid then supply a single range with the same start and end. Required for MustRunAs.
   *
   * @schema io.k8s.api.policy.v1beta1.RunAsUserStrategyOptions#ranges
   */
  readonly ranges?: IdRangeV1Beta1[];
  /**
   * rule is the strategy that will dictate the allowable RunAsUser values that may be set.
   *
   * @schema io.k8s.api.policy.v1beta1.RunAsUserStrategyOptions#rule
   */
  readonly rule: string;
}
/**
 * Converts an object of type 'RunAsUserStrategyOptionsV1Beta1' to JSON representation.
 */
export declare function toJson_RunAsUserStrategyOptionsV1Beta1(
  obj: RunAsUserStrategyOptionsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * RuntimeClassStrategyOptions define the strategy that will dictate the allowable RuntimeClasses for a pod.
 *
 * @schema io.k8s.api.policy.v1beta1.RuntimeClassStrategyOptions
 */
export interface RuntimeClassStrategyOptionsV1Beta1 {
  /**
   * allowedRuntimeClassNames is an allowlist of RuntimeClass names that may be specified on a pod. A value of "*" means that any RuntimeClass name is allowed, and must be the only item in the list. An empty list requires the RuntimeClassName field to be unset.
   *
   * @schema io.k8s.api.policy.v1beta1.RuntimeClassStrategyOptions#allowedRuntimeClassNames
   */
  readonly allowedRuntimeClassNames: string[];
  /**
   * defaultRuntimeClassName is the default RuntimeClassName to set on the pod. The default MUST be allowed by the allowedRuntimeClassNames list. A value of nil does not mutate the Pod.
   *
   * @schema io.k8s.api.policy.v1beta1.RuntimeClassStrategyOptions#defaultRuntimeClassName
   */
  readonly defaultRuntimeClassName?: string;
}
/**
 * Converts an object of type 'RuntimeClassStrategyOptionsV1Beta1' to JSON representation.
 */
export declare function toJson_RuntimeClassStrategyOptionsV1Beta1(
  obj: RuntimeClassStrategyOptionsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * SELinuxStrategyOptions defines the strategy type and any options used to create the strategy.
 *
 * @schema io.k8s.api.policy.v1beta1.SELinuxStrategyOptions
 */
export interface SeLinuxStrategyOptionsV1Beta1 {
  /**
   * rule is the strategy that will dictate the allowable labels that may be set.
   *
   * @schema io.k8s.api.policy.v1beta1.SELinuxStrategyOptions#rule
   */
  readonly rule: string;
  /**
   * seLinuxOptions required to run as; required for MustRunAs More info: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/
   *
   * @schema io.k8s.api.policy.v1beta1.SELinuxStrategyOptions#seLinuxOptions
   */
  readonly seLinuxOptions?: SeLinuxOptions;
}
/**
 * Converts an object of type 'SeLinuxStrategyOptionsV1Beta1' to JSON representation.
 */
export declare function toJson_SeLinuxStrategyOptionsV1Beta1(
  obj: SeLinuxStrategyOptionsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * SupplementalGroupsStrategyOptions defines the strategy type and options used to create the strategy.
 *
 * @schema io.k8s.api.policy.v1beta1.SupplementalGroupsStrategyOptions
 */
export interface SupplementalGroupsStrategyOptionsV1Beta1 {
  /**
   * ranges are the allowed ranges of supplemental groups.  If you would like to force a single supplemental group then supply a single range with the same start and end. Required for MustRunAs.
   *
   * @schema io.k8s.api.policy.v1beta1.SupplementalGroupsStrategyOptions#ranges
   */
  readonly ranges?: IdRangeV1Beta1[];
  /**
   * rule is the strategy that will dictate what supplemental groups is used in the SecurityContext.
   *
   * @schema io.k8s.api.policy.v1beta1.SupplementalGroupsStrategyOptions#rule
   */
  readonly rule?: string;
}
/**
 * Converts an object of type 'SupplementalGroupsStrategyOptionsV1Beta1' to JSON representation.
 */
export declare function toJson_SupplementalGroupsStrategyOptionsV1Beta1(
  obj: SupplementalGroupsStrategyOptionsV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * TokenRequest contains parameters of a service account token.
 *
 * @schema io.k8s.api.storage.v1.TokenRequest
 */
export interface TokenRequest {
  /**
   * Audience is the intended audience of the token in "TokenRequestSpec". It will default to the audiences of kube apiserver.
   *
   * @schema io.k8s.api.storage.v1.TokenRequest#audience
   */
  readonly audience: string;
  /**
   * ExpirationSeconds is the duration of validity of the token in "TokenRequestSpec". It has the same default value of "ExpirationSeconds" in "TokenRequestSpec".
   *
   * @schema io.k8s.api.storage.v1.TokenRequest#expirationSeconds
   */
  readonly expirationSeconds?: number;
}
/**
 * Converts an object of type 'TokenRequest' to JSON representation.
 */
export declare function toJson_TokenRequest(
  obj: TokenRequest | undefined,
): Record<string, any> | undefined;
/**
 * CSINodeDriver holds information about the specification of one CSI driver installed on a node
 *
 * @schema io.k8s.api.storage.v1.CSINodeDriver
 */
export interface CsiNodeDriver {
  /**
   * allocatable represents the volume resources of a node that are available for scheduling. This field is beta.
   *
   * @schema io.k8s.api.storage.v1.CSINodeDriver#allocatable
   */
  readonly allocatable?: VolumeNodeResources;
  /**
   * This is the name of the CSI driver that this object refers to. This MUST be the same name returned by the CSI GetPluginName() call for that driver.
   *
   * @schema io.k8s.api.storage.v1.CSINodeDriver#name
   */
  readonly name: string;
  /**
   * nodeID of the node from the driver point of view. This field enables Kubernetes to communicate with storage systems that do not share the same nomenclature for nodes. For example, Kubernetes may refer to a given node as "node1", but the storage system may refer to the same node as "nodeA". When Kubernetes issues a command to the storage system to attach a volume to a specific node, it can use this field to refer to the node name using the ID that the storage system will understand, e.g. "nodeA" instead of "node1". This field is required.
   *
   * @schema io.k8s.api.storage.v1.CSINodeDriver#nodeID
   */
  readonly nodeId: string;
  /**
   * topologyKeys is the list of keys supported by the driver. When a driver is initialized on a cluster, it provides a set of topology keys that it understands (e.g. "company.com/zone", "company.com/region"). When a driver is initialized on a node, it provides the same topology keys along with values. Kubelet will expose these topology keys as labels on its own node object. When Kubernetes does topology aware provisioning, it can use this list to determine which labels it should retrieve from the node object and pass back to the driver. It is possible for different nodes to use different topology keys. This can be empty if driver does not support topology.
   *
   * @schema io.k8s.api.storage.v1.CSINodeDriver#topologyKeys
   */
  readonly topologyKeys?: string[];
}
/**
 * Converts an object of type 'CsiNodeDriver' to JSON representation.
 */
export declare function toJson_CsiNodeDriver(
  obj: CsiNodeDriver | undefined,
): Record<string, any> | undefined;
/**
 * A topology selector requirement is a selector that matches given label. This is an alpha feature and may change in the future.
 *
 * @schema io.k8s.api.core.v1.TopologySelectorLabelRequirement
 */
export interface TopologySelectorLabelRequirement {
  /**
   * The label key that the selector applies to.
   *
   * @schema io.k8s.api.core.v1.TopologySelectorLabelRequirement#key
   */
  readonly key: string;
  /**
   * An array of string values. One value must match the label to be selected. Each entry in Values is ORed.
   *
   * @schema io.k8s.api.core.v1.TopologySelectorLabelRequirement#values
   */
  readonly values: string[];
}
/**
 * Converts an object of type 'TopologySelectorLabelRequirement' to JSON representation.
 */
export declare function toJson_TopologySelectorLabelRequirement(
  obj: TopologySelectorLabelRequirement | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachmentSource represents a volume that should be attached. Right now only PersistenVolumes can be attached via external attacher, in future we may allow also inline volumes in pods. Exactly one member can be set.
 *
 * @schema io.k8s.api.storage.v1.VolumeAttachmentSource
 */
export interface VolumeAttachmentSource {
  /**
   * inlineVolumeSpec contains all the information necessary to attach a persistent volume defined by a pod's inline VolumeSource. This field is populated only for the CSIMigration feature. It contains translated fields from a pod's inline VolumeSource to a PersistentVolumeSpec. This field is beta-level and is only honored by servers that enabled the CSIMigration feature.
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachmentSource#inlineVolumeSpec
   */
  readonly inlineVolumeSpec?: PersistentVolumeSpec;
  /**
   * Name of the persistent volume to attach.
   *
   * @schema io.k8s.api.storage.v1.VolumeAttachmentSource#persistentVolumeName
   */
  readonly persistentVolumeName?: string;
}
/**
 * Converts an object of type 'VolumeAttachmentSource' to JSON representation.
 */
export declare function toJson_VolumeAttachmentSource(
  obj: VolumeAttachmentSource | undefined,
): Record<string, any> | undefined;
/**
 * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelectorRequirement
 */
export interface LabelSelectorRequirement {
  /**
   * key is the label key that the selector applies to.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelectorRequirement#key
   */
  readonly key: string;
  /**
   * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelectorRequirement#operator
   */
  readonly operator: string;
  /**
   * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelectorRequirement#values
   */
  readonly values?: string[];
}
/**
 * Converts an object of type 'LabelSelectorRequirement' to JSON representation.
 */
export declare function toJson_LabelSelectorRequirement(
  obj: LabelSelectorRequirement | undefined,
): Record<string, any> | undefined;
/**
 * VolumeAttachmentSource represents a volume that should be attached. Right now only PersistenVolumes can be attached via external attacher, in future we may allow also inline volumes in pods. Exactly one member can be set.
 *
 * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentSource
 */
export interface VolumeAttachmentSourceV1Alpha1 {
  /**
   * inlineVolumeSpec contains all the information necessary to attach a persistent volume defined by a pod's inline VolumeSource. This field is populated only for the CSIMigration feature. It contains translated fields from a pod's inline VolumeSource to a PersistentVolumeSpec. This field is alpha-level and is only honored by servers that enabled the CSIMigration feature.
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentSource#inlineVolumeSpec
   */
  readonly inlineVolumeSpec?: PersistentVolumeSpec;
  /**
   * Name of the persistent volume to attach.
   *
   * @schema io.k8s.api.storage.v1alpha1.VolumeAttachmentSource#persistentVolumeName
   */
  readonly persistentVolumeName?: string;
}
/**
 * Converts an object of type 'VolumeAttachmentSourceV1Alpha1' to JSON representation.
 */
export declare function toJson_VolumeAttachmentSourceV1Alpha1(
  obj: VolumeAttachmentSourceV1Alpha1 | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceConversion describes how to convert different versions of a CR.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceConversion
 */
export interface CustomResourceConversion {
  /**
   * strategy specifies how custom resources are converted between versions. Allowed values are: - `None`: The converter only change the apiVersion and would not touch any other field in the custom resource. - `Webhook`: API Server will call to an external webhook to do the conversion. Additional information
   * is needed for this option. This requires spec.preserveUnknownFields to be false, and spec.conversion.webhook to be set.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceConversion#strategy
   */
  readonly strategy: string;
  /**
   * webhook describes how to call the conversion webhook. Required when `strategy` is set to `Webhook`.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceConversion#webhook
   */
  readonly webhook?: WebhookConversion;
}
/**
 * Converts an object of type 'CustomResourceConversion' to JSON representation.
 */
export declare function toJson_CustomResourceConversion(
  obj: CustomResourceConversion | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceDefinitionNames indicates the names to serve this CustomResourceDefinition
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionNames
 */
export interface CustomResourceDefinitionNames {
  /**
   * categories is a list of grouped resources this custom resource belongs to (e.g. 'all'). This is published in API discovery documents, and used by clients to support invocations like `kubectl get all`.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionNames#categories
   */
  readonly categories?: string[];
  /**
   * kind is the serialized kind of the resource. It is normally CamelCase and singular. Custom resource instances will use this value as the `kind` attribute in API calls.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionNames#kind
   */
  readonly kind: string;
  /**
   * listKind is the serialized kind of the list for this resource. Defaults to "`kind`List".
   *
   * @default kind`List".
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionNames#listKind
   */
  readonly listKind?: string;
  /**
   * plural is the plural name of the resource to serve. The custom resources are served under `/apis/<group>/<version>/.../<plural>`. Must match the name of the CustomResourceDefinition (in the form `<names.plural>.<group>`). Must be all lowercase.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionNames#plural
   */
  readonly plural: string;
  /**
   * shortNames are short names for the resource, exposed in API discovery documents, and used by clients to support invocations like `kubectl get <shortname>`. It must be all lowercase.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionNames#shortNames
   */
  readonly shortNames?: string[];
  /**
   * singular is the singular name of the resource. It must be all lowercase. Defaults to lowercased `kind`.
   *
   * @default lowercased `kind`.
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionNames#singular
   */
  readonly singular?: string;
}
/**
 * Converts an object of type 'CustomResourceDefinitionNames' to JSON representation.
 */
export declare function toJson_CustomResourceDefinitionNames(
  obj: CustomResourceDefinitionNames | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceDefinitionVersion describes a version for CRD.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion
 */
export interface CustomResourceDefinitionVersion {
  /**
   * additionalPrinterColumns specifies additional columns returned in Table output. See https://kubernetes.io/docs/reference/using-api/api-concepts/#receiving-resources-as-tables for details. If no columns are specified, a single column displaying the age of the custom resource is used.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#additionalPrinterColumns
   */
  readonly additionalPrinterColumns?: CustomResourceColumnDefinition[];
  /**
   * deprecated indicates this version of the custom resource API is deprecated. When set to true, API requests to this version receive a warning header in the server response. Defaults to false.
   *
   * @default false.
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#deprecated
   */
  readonly deprecated?: boolean;
  /**
   * deprecationWarning overrides the default warning returned to API clients. May only be set when `deprecated` is true. The default warning indicates this version is deprecated and recommends use of the newest served version of equal or greater stability, if one exists.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#deprecationWarning
   */
  readonly deprecationWarning?: string;
  /**
   * name is the version name, e.g. “v1”, “v2beta1”, etc. The custom resources are served under this version at `/apis/<group>/<version>/...` if `served` is true.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#name
   */
  readonly name: string;
  /**
   * schema describes the schema used for validation, pruning, and defaulting of this version of the custom resource.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#schema
   */
  readonly schema?: CustomResourceValidation;
  /**
   * served is a flag enabling/disabling this version from being served via REST APIs
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#served
   */
  readonly served: boolean;
  /**
   * storage indicates this version should be used when persisting custom resources to storage. There must be exactly one version with storage=true.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#storage
   */
  readonly storage: boolean;
  /**
   * subresources specify what subresources this version of the defined custom resource have.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceDefinitionVersion#subresources
   */
  readonly subresources?: CustomResourceSubresources;
}
/**
 * Converts an object of type 'CustomResourceDefinitionVersion' to JSON representation.
 */
export declare function toJson_CustomResourceDefinitionVersion(
  obj: CustomResourceDefinitionVersion | undefined,
): Record<string, any> | undefined;
/**
 * StatusCause provides more information about an api.Status failure, including cases when multiple errors are encountered.
 *
 * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusCause
 */
export interface StatusCause {
  /**
   * The field of the resource that has caused this error, as named by its JSON serialization. May include dot and postfix notation for nested attributes. Arrays are zero-indexed.  Fields may appear more than once in an array of causes due to fields having multiple errors. Optional.
   *
   * Examples:
   * "name" - the field "name" on the current resource
   * "items[0].name" - the field "name" on the first array entry in "items"
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusCause#field
   */
  readonly field?: string;
  /**
   * A human-readable description of the cause of the error.  This field may be presented as-is to a reader.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusCause#message
   */
  readonly message?: string;
  /**
   * A machine-readable description of the cause of the error. If this value is empty there is no information available.
   *
   * @schema io.k8s.apimachinery.pkg.apis.meta.v1.StatusCause#reason
   */
  readonly reason?: string;
}
/**
 * Converts an object of type 'StatusCause' to JSON representation.
 */
export declare function toJson_StatusCause(
  obj: StatusCause | undefined,
): Record<string, any> | undefined;
/**
 * ServiceReference holds a reference to Service.legacy.k8s.io
 *
 * @schema io.k8s.api.admissionregistration.v1.ServiceReference
 */
export interface ServiceReference {
  /**
   * `name` is the name of the service. Required
   *
   * @schema io.k8s.api.admissionregistration.v1.ServiceReference#name
   */
  readonly name: string;
  /**
   * `namespace` is the namespace of the service. Required
   *
   * @schema io.k8s.api.admissionregistration.v1.ServiceReference#namespace
   */
  readonly namespace: string;
  /**
   * `path` is an optional URL path which will be sent in any request to this service.
   *
   * @schema io.k8s.api.admissionregistration.v1.ServiceReference#path
   */
  readonly path?: string;
  /**
   * If specified, the port on the service that hosting webhook. Default to 443 for backward compatibility. `port` should be a valid port number (1-65535, inclusive).
   *
   * @default 443 for backward compatibility. `port` should be a valid port number (1-65535, inclusive).
   * @schema io.k8s.api.admissionregistration.v1.ServiceReference#port
   */
  readonly port?: number;
}
/**
 * Converts an object of type 'ServiceReference' to JSON representation.
 */
export declare function toJson_ServiceReference(
  obj: ServiceReference | undefined,
): Record<string, any> | undefined;
/**
 * Spec to control the desired behavior of daemon set rolling update.
 *
 * @schema io.k8s.api.apps.v1.RollingUpdateDaemonSet
 */
export interface RollingUpdateDaemonSet {
  /**
   * The maximum number of nodes with an existing available DaemonSet pod that can have an updated DaemonSet pod during during an update. Value can be an absolute number (ex: 5) or a percentage of desired pods (ex: 10%). This can not be 0 if MaxUnavailable is 0. Absolute number is calculated from percentage by rounding up to a minimum of 1. Default value is 0. Example: when this is set to 30%, at most 30% of the total number of nodes that should be running the daemon pod (i.e. status.desiredNumberScheduled) can have their a new pod created before the old pod is marked as deleted. The update starts by launching new pods on 30% of nodes. Once an updated pod is available (Ready for at least minReadySeconds) the old DaemonSet pod on that node is marked deleted. If the old pod becomes unavailable for any reason (Ready transitions to false, is evicted, or is drained) an updated pod is immediatedly created on that node without considering surge limits. Allowing surge implies the possibility that the resources consumed by the daemonset on any given node can double if the readiness check fails, and so resource intensive daemonsets should take into account that they may cause evictions during disruption. This is beta field and enabled/disabled by DaemonSetUpdateSurge feature gate.
   *
   * @schema io.k8s.api.apps.v1.RollingUpdateDaemonSet#maxSurge
   */
  readonly maxSurge?: IntOrString;
  /**
   * The maximum number of DaemonSet pods that can be unavailable during the update. Value can be an absolute number (ex: 5) or a percentage of total number of DaemonSet pods at the start of the update (ex: 10%). Absolute number is calculated from percentage by rounding up. This cannot be 0 if MaxSurge is 0 Default value is 1. Example: when this is set to 30%, at most 30% of the total number of nodes that should be running the daemon pod (i.e. status.desiredNumberScheduled) can have their pods stopped for an update at any given time. The update starts by stopping at most 30% of those DaemonSet pods and then brings up new DaemonSet pods in their place. Once the new pods are available, it then proceeds onto other DaemonSet pods, thus ensuring that at least 70% of original number of DaemonSet pods are available at all times during the update.
   *
   * @schema io.k8s.api.apps.v1.RollingUpdateDaemonSet#maxUnavailable
   */
  readonly maxUnavailable?: IntOrString;
}
/**
 * Converts an object of type 'RollingUpdateDaemonSet' to JSON representation.
 */
export declare function toJson_RollingUpdateDaemonSet(
  obj: RollingUpdateDaemonSet | undefined,
): Record<string, any> | undefined;
/**
 * Spec to control the desired behavior of rolling update.
 *
 * @schema io.k8s.api.apps.v1.RollingUpdateDeployment
 */
export interface RollingUpdateDeployment {
  /**
   * The maximum number of pods that can be scheduled above the desired number of pods. Value can be an absolute number (ex: 5) or a percentage of desired pods (ex: 10%). This can not be 0 if MaxUnavailable is 0. Absolute number is calculated from percentage by rounding up. Defaults to 25%. Example: when this is set to 30%, the new ReplicaSet can be scaled up immediately when the rolling update starts, such that the total number of old and new pods do not exceed 130% of desired pods. Once old pods have been killed, new ReplicaSet can be scaled up further, ensuring that total number of pods running at any time during the update is at most 130% of desired pods.
   *
   * @default 25%. Example: when this is set to 30%, the new ReplicaSet can be scaled up immediately when the rolling update starts, such that the total number of old and new pods do not exceed 130% of desired pods. Once old pods have been killed, new ReplicaSet can be scaled up further, ensuring that total number of pods running at any time during the update is at most 130% of desired pods.
   * @schema io.k8s.api.apps.v1.RollingUpdateDeployment#maxSurge
   */
  readonly maxSurge?: IntOrString;
  /**
   * The maximum number of pods that can be unavailable during the update. Value can be an absolute number (ex: 5) or a percentage of desired pods (ex: 10%). Absolute number is calculated from percentage by rounding down. This can not be 0 if MaxSurge is 0. Defaults to 25%. Example: when this is set to 30%, the old ReplicaSet can be scaled down to 70% of desired pods immediately when the rolling update starts. Once new pods are ready, old ReplicaSet can be scaled down further, followed by scaling up the new ReplicaSet, ensuring that the total number of pods available at all times during the update is at least 70% of desired pods.
   *
   * @default 25%. Example: when this is set to 30%, the old ReplicaSet can be scaled down to 70% of desired pods immediately when the rolling update starts. Once new pods are ready, old ReplicaSet can be scaled down further, followed by scaling up the new ReplicaSet, ensuring that the total number of pods available at all times during the update is at least 70% of desired pods.
   * @schema io.k8s.api.apps.v1.RollingUpdateDeployment#maxUnavailable
   */
  readonly maxUnavailable?: IntOrString;
}
/**
 * Converts an object of type 'RollingUpdateDeployment' to JSON representation.
 */
export declare function toJson_RollingUpdateDeployment(
  obj: RollingUpdateDeployment | undefined,
): Record<string, any> | undefined;
/**
 * RollingUpdateStatefulSetStrategy is used to communicate parameter for RollingUpdateStatefulSetStrategyType.
 *
 * @schema io.k8s.api.apps.v1.RollingUpdateStatefulSetStrategy
 */
export interface RollingUpdateStatefulSetStrategy {
  /**
   * Partition indicates the ordinal at which the StatefulSet should be partitioned. Default value is 0.
   *
   * @schema io.k8s.api.apps.v1.RollingUpdateStatefulSetStrategy#partition
   */
  readonly partition?: number;
}
/**
 * Converts an object of type 'RollingUpdateStatefulSetStrategy' to JSON representation.
 */
export declare function toJson_RollingUpdateStatefulSetStrategy(
  obj: RollingUpdateStatefulSetStrategy | undefined,
): Record<string, any> | undefined;
/**
 * ContainerResourceMetricSource indicates how to scale on a resource metric known to Kubernetes, as specified in requests and limits, describing each pod in the current scale target (e.g. CPU or memory).  The values will be averaged together before being compared to the target.  Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source.  Only one "target" type should be set.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.ContainerResourceMetricSource
 */
export interface ContainerResourceMetricSourceV2Beta1 {
  /**
   * container is the name of the container in the pods of the scaling target
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ContainerResourceMetricSource#container
   */
  readonly container: string;
  /**
   * name is the name of the resource in question.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ContainerResourceMetricSource#name
   */
  readonly name: string;
  /**
   * targetAverageUtilization is the target value of the average of the resource metric across all relevant pods, represented as a percentage of the requested value of the resource for the pods.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ContainerResourceMetricSource#targetAverageUtilization
   */
  readonly targetAverageUtilization?: number;
  /**
   * targetAverageValue is the target value of the average of the resource metric across all relevant pods, as a raw value (instead of as a percentage of the request), similar to the "pods" metric source type.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ContainerResourceMetricSource#targetAverageValue
   */
  readonly targetAverageValue?: Quantity;
}
/**
 * Converts an object of type 'ContainerResourceMetricSourceV2Beta1' to JSON representation.
 */
export declare function toJson_ContainerResourceMetricSourceV2Beta1(
  obj: ContainerResourceMetricSourceV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * ExternalMetricSource indicates how to scale on a metric not associated with any Kubernetes object (for example length of queue in cloud messaging service, or QPS from loadbalancer running outside of cluster). Exactly one "target" type should be set.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.ExternalMetricSource
 */
export interface ExternalMetricSourceV2Beta1 {
  /**
   * metricName is the name of the metric in question.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ExternalMetricSource#metricName
   */
  readonly metricName: string;
  /**
   * metricSelector is used to identify a specific time series within a given metric.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ExternalMetricSource#metricSelector
   */
  readonly metricSelector?: LabelSelector;
  /**
   * targetAverageValue is the target per-pod value of global metric (as a quantity). Mutually exclusive with TargetValue.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ExternalMetricSource#targetAverageValue
   */
  readonly targetAverageValue?: Quantity;
  /**
   * targetValue is the target value of the metric (as a quantity). Mutually exclusive with TargetAverageValue.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ExternalMetricSource#targetValue
   */
  readonly targetValue?: Quantity;
}
/**
 * Converts an object of type 'ExternalMetricSourceV2Beta1' to JSON representation.
 */
export declare function toJson_ExternalMetricSourceV2Beta1(
  obj: ExternalMetricSourceV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * ObjectMetricSource indicates how to scale on a metric describing a kubernetes object (for example, hits-per-second on an Ingress object).
 *
 * @schema io.k8s.api.autoscaling.v2beta1.ObjectMetricSource
 */
export interface ObjectMetricSourceV2Beta1 {
  /**
   * averageValue is the target value of the average of the metric across all relevant pods (as a quantity)
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ObjectMetricSource#averageValue
   */
  readonly averageValue?: Quantity;
  /**
   * metricName is the name of the metric in question.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ObjectMetricSource#metricName
   */
  readonly metricName: string;
  /**
   * selector is the string-encoded form of a standard kubernetes label selector for the given metric When set, it is passed as an additional parameter to the metrics server for more specific metrics scoping When unset, just the metricName will be used to gather metrics.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ObjectMetricSource#selector
   */
  readonly selector?: LabelSelector;
  /**
   * target is the described Kubernetes object.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ObjectMetricSource#target
   */
  readonly target: CrossVersionObjectReferenceV2Beta1;
  /**
   * targetValue is the target value of the metric (as a quantity).
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ObjectMetricSource#targetValue
   */
  readonly targetValue: Quantity;
}
/**
 * Converts an object of type 'ObjectMetricSourceV2Beta1' to JSON representation.
 */
export declare function toJson_ObjectMetricSourceV2Beta1(
  obj: ObjectMetricSourceV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * PodsMetricSource indicates how to scale on a metric describing each pod in the current scale target (for example, transactions-processed-per-second). The values will be averaged together before being compared to the target value.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.PodsMetricSource
 */
export interface PodsMetricSourceV2Beta1 {
  /**
   * metricName is the name of the metric in question
   *
   * @schema io.k8s.api.autoscaling.v2beta1.PodsMetricSource#metricName
   */
  readonly metricName: string;
  /**
   * selector is the string-encoded form of a standard kubernetes label selector for the given metric When set, it is passed as an additional parameter to the metrics server for more specific metrics scoping When unset, just the metricName will be used to gather metrics.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.PodsMetricSource#selector
   */
  readonly selector?: LabelSelector;
  /**
   * targetAverageValue is the target value of the average of the metric across all relevant pods (as a quantity)
   *
   * @schema io.k8s.api.autoscaling.v2beta1.PodsMetricSource#targetAverageValue
   */
  readonly targetAverageValue: Quantity;
}
/**
 * Converts an object of type 'PodsMetricSourceV2Beta1' to JSON representation.
 */
export declare function toJson_PodsMetricSourceV2Beta1(
  obj: PodsMetricSourceV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * ResourceMetricSource indicates how to scale on a resource metric known to Kubernetes, as specified in requests and limits, describing each pod in the current scale target (e.g. CPU or memory).  The values will be averaged together before being compared to the target.  Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source.  Only one "target" type should be set.
 *
 * @schema io.k8s.api.autoscaling.v2beta1.ResourceMetricSource
 */
export interface ResourceMetricSourceV2Beta1 {
  /**
   * name is the name of the resource in question.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ResourceMetricSource#name
   */
  readonly name: string;
  /**
   * targetAverageUtilization is the target value of the average of the resource metric across all relevant pods, represented as a percentage of the requested value of the resource for the pods.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ResourceMetricSource#targetAverageUtilization
   */
  readonly targetAverageUtilization?: number;
  /**
   * targetAverageValue is the target value of the average of the resource metric across all relevant pods, as a raw value (instead of as a percentage of the request), similar to the "pods" metric source type.
   *
   * @schema io.k8s.api.autoscaling.v2beta1.ResourceMetricSource#targetAverageValue
   */
  readonly targetAverageValue?: Quantity;
}
/**
 * Converts an object of type 'ResourceMetricSourceV2Beta1' to JSON representation.
 */
export declare function toJson_ResourceMetricSourceV2Beta1(
  obj: ResourceMetricSourceV2Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * HPAScalingRules configures the scaling behavior for one direction. These Rules are applied after calculating DesiredReplicas from metrics for the HPA. They can limit the scaling velocity by specifying scaling policies. They can prevent flapping by specifying the stabilization window, so that the number of replicas is not set instantly, instead, the safest value from the stabilization window is chosen.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingRules
 */
export interface HpaScalingRulesV2Beta2 {
  /**
   * policies is a list of potential scaling polices which can be used during scaling. At least one policy must be specified, otherwise the HPAScalingRules will be discarded as invalid
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingRules#policies
   */
  readonly policies?: HpaScalingPolicyV2Beta2[];
  /**
   * selectPolicy is used to specify which policy should be used. If not set, the default value MaxPolicySelect is used.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingRules#selectPolicy
   */
  readonly selectPolicy?: string;
  /**
   * StabilizationWindowSeconds is the number of seconds for which past recommendations should be considered while scaling up or scaling down. StabilizationWindowSeconds must be greater than or equal to zero and less than or equal to 3600 (one hour). If not set, use the default values: - For scale up: 0 (i.e. no stabilization is done). - For scale down: 300 (i.e. the stabilization window is 300 seconds long).
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingRules#stabilizationWindowSeconds
   */
  readonly stabilizationWindowSeconds?: number;
}
/**
 * Converts an object of type 'HpaScalingRulesV2Beta2' to JSON representation.
 */
export declare function toJson_HpaScalingRulesV2Beta2(
  obj: HpaScalingRulesV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * ContainerResourceMetricSource indicates how to scale on a resource metric known to Kubernetes, as specified in requests and limits, describing each pod in the current scale target (e.g. CPU or memory).  The values will be averaged together before being compared to the target.  Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source.  Only one "target" type should be set.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.ContainerResourceMetricSource
 */
export interface ContainerResourceMetricSourceV2Beta2 {
  /**
   * container is the name of the container in the pods of the scaling target
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ContainerResourceMetricSource#container
   */
  readonly container: string;
  /**
   * name is the name of the resource in question.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ContainerResourceMetricSource#name
   */
  readonly name: string;
  /**
   * target specifies the target value for the given metric
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ContainerResourceMetricSource#target
   */
  readonly target: MetricTargetV2Beta2;
}
/**
 * Converts an object of type 'ContainerResourceMetricSourceV2Beta2' to JSON representation.
 */
export declare function toJson_ContainerResourceMetricSourceV2Beta2(
  obj: ContainerResourceMetricSourceV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * ExternalMetricSource indicates how to scale on a metric not associated with any Kubernetes object (for example length of queue in cloud messaging service, or QPS from loadbalancer running outside of cluster).
 *
 * @schema io.k8s.api.autoscaling.v2beta2.ExternalMetricSource
 */
export interface ExternalMetricSourceV2Beta2 {
  /**
   * metric identifies the target metric by name and selector
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ExternalMetricSource#metric
   */
  readonly metric: MetricIdentifierV2Beta2;
  /**
   * target specifies the target value for the given metric
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ExternalMetricSource#target
   */
  readonly target: MetricTargetV2Beta2;
}
/**
 * Converts an object of type 'ExternalMetricSourceV2Beta2' to JSON representation.
 */
export declare function toJson_ExternalMetricSourceV2Beta2(
  obj: ExternalMetricSourceV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * ObjectMetricSource indicates how to scale on a metric describing a kubernetes object (for example, hits-per-second on an Ingress object).
 *
 * @schema io.k8s.api.autoscaling.v2beta2.ObjectMetricSource
 */
export interface ObjectMetricSourceV2Beta2 {
  /**
   * @schema io.k8s.api.autoscaling.v2beta2.ObjectMetricSource#describedObject
   */
  readonly describedObject: CrossVersionObjectReferenceV2Beta2;
  /**
   * metric identifies the target metric by name and selector
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ObjectMetricSource#metric
   */
  readonly metric: MetricIdentifierV2Beta2;
  /**
   * target specifies the target value for the given metric
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ObjectMetricSource#target
   */
  readonly target: MetricTargetV2Beta2;
}
/**
 * Converts an object of type 'ObjectMetricSourceV2Beta2' to JSON representation.
 */
export declare function toJson_ObjectMetricSourceV2Beta2(
  obj: ObjectMetricSourceV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * PodsMetricSource indicates how to scale on a metric describing each pod in the current scale target (for example, transactions-processed-per-second). The values will be averaged together before being compared to the target value.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.PodsMetricSource
 */
export interface PodsMetricSourceV2Beta2 {
  /**
   * metric identifies the target metric by name and selector
   *
   * @schema io.k8s.api.autoscaling.v2beta2.PodsMetricSource#metric
   */
  readonly metric: MetricIdentifierV2Beta2;
  /**
   * target specifies the target value for the given metric
   *
   * @schema io.k8s.api.autoscaling.v2beta2.PodsMetricSource#target
   */
  readonly target: MetricTargetV2Beta2;
}
/**
 * Converts an object of type 'PodsMetricSourceV2Beta2' to JSON representation.
 */
export declare function toJson_PodsMetricSourceV2Beta2(
  obj: PodsMetricSourceV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * ResourceMetricSource indicates how to scale on a resource metric known to Kubernetes, as specified in requests and limits, describing each pod in the current scale target (e.g. CPU or memory).  The values will be averaged together before being compared to the target.  Such metrics are built in to Kubernetes, and have special scaling options on top of those available to normal per-pod metrics using the "pods" source.  Only one "target" type should be set.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.ResourceMetricSource
 */
export interface ResourceMetricSourceV2Beta2 {
  /**
   * name is the name of the resource in question.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ResourceMetricSource#name
   */
  readonly name: string;
  /**
   * target specifies the target value for the given metric
   *
   * @schema io.k8s.api.autoscaling.v2beta2.ResourceMetricSource#target
   */
  readonly target: MetricTargetV2Beta2;
}
/**
 * Converts an object of type 'ResourceMetricSourceV2Beta2' to JSON representation.
 */
export declare function toJson_ResourceMetricSourceV2Beta2(
  obj: ResourceMetricSourceV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * ConfigMapNodeConfigSource contains the information to reference a ConfigMap as a config source for the Node. This API is deprecated since 1.22: https://git.k8s.io/enhancements/keps/sig-node/281-dynamic-kubelet-configuration
 *
 * @schema io.k8s.api.core.v1.ConfigMapNodeConfigSource
 */
export interface ConfigMapNodeConfigSource {
  /**
   * KubeletConfigKey declares which key of the referenced ConfigMap corresponds to the KubeletConfiguration structure This field is required in all cases.
   *
   * @schema io.k8s.api.core.v1.ConfigMapNodeConfigSource#kubeletConfigKey
   */
  readonly kubeletConfigKey: string;
  /**
   * Name is the metadata.name of the referenced ConfigMap. This field is required in all cases.
   *
   * @schema io.k8s.api.core.v1.ConfigMapNodeConfigSource#name
   */
  readonly name: string;
  /**
   * Namespace is the metadata.namespace of the referenced ConfigMap. This field is required in all cases.
   *
   * @schema io.k8s.api.core.v1.ConfigMapNodeConfigSource#namespace
   */
  readonly namespace: string;
  /**
   * ResourceVersion is the metadata.ResourceVersion of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
   *
   * @schema io.k8s.api.core.v1.ConfigMapNodeConfigSource#resourceVersion
   */
  readonly resourceVersion?: string;
  /**
   * UID is the metadata.UID of the referenced ConfigMap. This field is forbidden in Node.Spec, and required in Node.Status.
   *
   * @schema io.k8s.api.core.v1.ConfigMapNodeConfigSource#uid
   */
  readonly uid?: string;
}
/**
 * Converts an object of type 'ConfigMapNodeConfigSource' to JSON representation.
 */
export declare function toJson_ConfigMapNodeConfigSource(
  obj: ConfigMapNodeConfigSource | undefined,
): Record<string, any> | undefined;
/**
 * SecretReference represents a Secret Reference. It has enough information to retrieve secret in any namespace
 *
 * @schema io.k8s.api.core.v1.SecretReference
 */
export interface SecretReference {
  /**
   * Name is unique within a namespace to reference a secret resource.
   *
   * @schema io.k8s.api.core.v1.SecretReference#name
   */
  readonly name?: string;
  /**
   * Namespace defines the space within which the secret name must be unique.
   *
   * @schema io.k8s.api.core.v1.SecretReference#namespace
   */
  readonly namespace?: string;
}
/**
 * Converts an object of type 'SecretReference' to JSON representation.
 */
export declare function toJson_SecretReference(
  obj: SecretReference | undefined,
): Record<string, any> | undefined;
/**
 * A node selector represents the union of the results of one or more label queries over a set of nodes; that is, it represents the OR of the selectors represented by the node selector terms.
 *
 * @schema io.k8s.api.core.v1.NodeSelector
 */
export interface NodeSelector {
  /**
   * Required. A list of node selector terms. The terms are ORed.
   *
   * @schema io.k8s.api.core.v1.NodeSelector#nodeSelectorTerms
   */
  readonly nodeSelectorTerms: NodeSelectorTerm[];
}
/**
 * Converts an object of type 'NodeSelector' to JSON representation.
 */
export declare function toJson_NodeSelector(
  obj: NodeSelector | undefined,
): Record<string, any> | undefined;
/**
 * Node affinity is a group of node affinity scheduling rules.
 *
 * @schema io.k8s.api.core.v1.NodeAffinity
 */
export interface NodeAffinity {
  /**
   * The scheduler will prefer to schedule pods to nodes that satisfy the affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding "weight" to the sum if the node matches the corresponding matchExpressions; the node(s) with the highest sum are the most preferred.
   *
   * @schema io.k8s.api.core.v1.NodeAffinity#preferredDuringSchedulingIgnoredDuringExecution
   */
  readonly preferredDuringSchedulingIgnoredDuringExecution?: PreferredSchedulingTerm[];
  /**
   * If the affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to an update), the system may or may not try to eventually evict the pod from its node.
   *
   * @schema io.k8s.api.core.v1.NodeAffinity#requiredDuringSchedulingIgnoredDuringExecution
   */
  readonly requiredDuringSchedulingIgnoredDuringExecution?: NodeSelector;
}
/**
 * Converts an object of type 'NodeAffinity' to JSON representation.
 */
export declare function toJson_NodeAffinity(
  obj: NodeAffinity | undefined,
): Record<string, any> | undefined;
/**
 * Pod affinity is a group of inter pod affinity scheduling rules.
 *
 * @schema io.k8s.api.core.v1.PodAffinity
 */
export interface PodAffinity {
  /**
   * The scheduler will prefer to schedule pods to nodes that satisfy the affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding "weight" to the sum if the node has pods which matches the corresponding podAffinityTerm; the node(s) with the highest sum are the most preferred.
   *
   * @schema io.k8s.api.core.v1.PodAffinity#preferredDuringSchedulingIgnoredDuringExecution
   */
  readonly preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
  /**
   * If the affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system may or may not try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied.
   *
   * @schema io.k8s.api.core.v1.PodAffinity#requiredDuringSchedulingIgnoredDuringExecution
   */
  readonly requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
}
/**
 * Converts an object of type 'PodAffinity' to JSON representation.
 */
export declare function toJson_PodAffinity(
  obj: PodAffinity | undefined,
): Record<string, any> | undefined;
/**
 * Pod anti affinity is a group of inter pod anti affinity scheduling rules.
 *
 * @schema io.k8s.api.core.v1.PodAntiAffinity
 */
export interface PodAntiAffinity {
  /**
   * The scheduler will prefer to schedule pods to nodes that satisfy the anti-affinity expressions specified by this field, but it may choose a node that violates one or more of the expressions. The node that is most preferred is the one with the greatest sum of weights, i.e. for each node that meets all of the scheduling requirements (resource request, requiredDuringScheduling anti-affinity expressions, etc.), compute a sum by iterating through the elements of this field and adding "weight" to the sum if the node has pods which matches the corresponding podAffinityTerm; the node(s) with the highest sum are the most preferred.
   *
   * @schema io.k8s.api.core.v1.PodAntiAffinity#preferredDuringSchedulingIgnoredDuringExecution
   */
  readonly preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[];
  /**
   * If the anti-affinity requirements specified by this field are not met at scheduling time, the pod will not be scheduled onto the node. If the anti-affinity requirements specified by this field cease to be met at some point during pod execution (e.g. due to a pod label update), the system may or may not try to eventually evict the pod from its node. When there are multiple elements, the lists of nodes corresponding to each podAffinityTerm are intersected, i.e. all terms must be satisfied.
   *
   * @schema io.k8s.api.core.v1.PodAntiAffinity#requiredDuringSchedulingIgnoredDuringExecution
   */
  readonly requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[];
}
/**
 * Converts an object of type 'PodAntiAffinity' to JSON representation.
 */
export declare function toJson_PodAntiAffinity(
  obj: PodAntiAffinity | undefined,
): Record<string, any> | undefined;
/**
 * EnvVar represents an environment variable present in a Container.
 *
 * @schema io.k8s.api.core.v1.EnvVar
 */
export interface EnvVar {
  /**
   * Name of the environment variable. Must be a C_IDENTIFIER.
   *
   * @schema io.k8s.api.core.v1.EnvVar#name
   */
  readonly name: string;
  /**
   * Variable references $(VAR_NAME) are expanded using the previously defined environment variables in the container and any service environment variables. If a variable cannot be resolved, the reference in the input string will be unchanged. Double $$ are reduced to a single $, which allows for escaping the $(VAR_NAME) syntax: i.e. "$$(VAR_NAME)" will produce the string literal "$(VAR_NAME)". Escaped references will never be expanded, regardless of whether the variable exists or not. Defaults to "".
   *
   * @default .
   * @schema io.k8s.api.core.v1.EnvVar#value
   */
  readonly value?: string;
  /**
   * Source for the environment variable's value. Cannot be used if value is not empty.
   *
   * @schema io.k8s.api.core.v1.EnvVar#valueFrom
   */
  readonly valueFrom?: EnvVarSource;
}
/**
 * Converts an object of type 'EnvVar' to JSON representation.
 */
export declare function toJson_EnvVar(
  obj: EnvVar | undefined,
): Record<string, any> | undefined;
/**
 * EnvFromSource represents the source of a set of ConfigMaps
 *
 * @schema io.k8s.api.core.v1.EnvFromSource
 */
export interface EnvFromSource {
  /**
   * The ConfigMap to select from
   *
   * @schema io.k8s.api.core.v1.EnvFromSource#configMapRef
   */
  readonly configMapRef?: ConfigMapEnvSource;
  /**
   * An optional identifier to prepend to each key in the ConfigMap. Must be a C_IDENTIFIER.
   *
   * @schema io.k8s.api.core.v1.EnvFromSource#prefix
   */
  readonly prefix?: string;
  /**
   * The Secret to select from
   *
   * @schema io.k8s.api.core.v1.EnvFromSource#secretRef
   */
  readonly secretRef?: SecretEnvSource;
}
/**
 * Converts an object of type 'EnvFromSource' to JSON representation.
 */
export declare function toJson_EnvFromSource(
  obj: EnvFromSource | undefined,
): Record<string, any> | undefined;
/**
 * Lifecycle describes actions that the management system should take in response to container lifecycle events. For the PostStart and PreStop lifecycle handlers, management of the container blocks until the action is complete, unless the container process fails, in which case the handler is aborted.
 *
 * @schema io.k8s.api.core.v1.Lifecycle
 */
export interface Lifecycle {
  /**
   * PostStart is called immediately after a container is created. If the handler fails, the container is terminated and restarted according to its restart policy. Other management of the container blocks until the hook completes. More info: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks
   *
   * @schema io.k8s.api.core.v1.Lifecycle#postStart
   */
  readonly postStart?: Handler;
  /**
   * PreStop is called immediately before a container is terminated due to an API request or management event such as liveness/startup probe failure, preemption, resource contention, etc. The handler is not called if the container crashes or exits. The reason for termination is passed to the handler. The Pod's termination grace period countdown begins before the PreStop hooked is executed. Regardless of the outcome of the handler, the container will eventually terminate within the Pod's termination grace period. Other management of the container blocks until the hook completes or until the termination grace period is reached. More info: https://kubernetes.io/docs/concepts/containers/container-lifecycle-hooks/#container-hooks
   *
   * @schema io.k8s.api.core.v1.Lifecycle#preStop
   */
  readonly preStop?: Handler;
}
/**
 * Converts an object of type 'Lifecycle' to JSON representation.
 */
export declare function toJson_Lifecycle(
  obj: Lifecycle | undefined,
): Record<string, any> | undefined;
/**
 * Probe describes a health check to be performed against a container to determine whether it is alive or ready to receive traffic.
 *
 * @schema io.k8s.api.core.v1.Probe
 */
export interface Probe {
  /**
   * One and only one of the following should be specified. Exec specifies the action to take.
   *
   * @schema io.k8s.api.core.v1.Probe#exec
   */
  readonly exec?: ExecAction;
  /**
   * Minimum consecutive failures for the probe to be considered failed after having succeeded. Defaults to 3. Minimum value is 1.
   *
   * @default 3. Minimum value is 1.
   * @schema io.k8s.api.core.v1.Probe#failureThreshold
   */
  readonly failureThreshold?: number;
  /**
   * HTTPGet specifies the http request to perform.
   *
   * @schema io.k8s.api.core.v1.Probe#httpGet
   */
  readonly httpGet?: HttpGetAction;
  /**
   * Number of seconds after the container has started before liveness probes are initiated. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
   *
   * @schema io.k8s.api.core.v1.Probe#initialDelaySeconds
   */
  readonly initialDelaySeconds?: number;
  /**
   * How often (in seconds) to perform the probe. Default to 10 seconds. Minimum value is 1.
   *
   * @default 10 seconds. Minimum value is 1.
   * @schema io.k8s.api.core.v1.Probe#periodSeconds
   */
  readonly periodSeconds?: number;
  /**
   * Minimum consecutive successes for the probe to be considered successful after having failed. Defaults to 1. Must be 1 for liveness and startup. Minimum value is 1.
   *
   * @default 1. Must be 1 for liveness and startup. Minimum value is 1.
   * @schema io.k8s.api.core.v1.Probe#successThreshold
   */
  readonly successThreshold?: number;
  /**
   * TCPSocket specifies an action involving a TCP port. TCP hooks not yet supported
   *
   * @schema io.k8s.api.core.v1.Probe#tcpSocket
   */
  readonly tcpSocket?: TcpSocketAction;
  /**
   * Optional duration in seconds the pod needs to terminate gracefully upon probe failure. The grace period is the duration in seconds after the processes running in the pod are sent a termination signal and the time when the processes are forcibly halted with a kill signal. Set this value longer than the expected cleanup time for your process. If this value is nil, the pod's terminationGracePeriodSeconds will be used. Otherwise, this value overrides the value provided by the pod spec. Value must be non-negative integer. The value zero indicates stop immediately via the kill signal (no opportunity to shut down). This is a beta field and requires enabling ProbeTerminationGracePeriod feature gate. Minimum value is 1. spec.terminationGracePeriodSeconds is used if unset.
   *
   * @schema io.k8s.api.core.v1.Probe#terminationGracePeriodSeconds
   */
  readonly terminationGracePeriodSeconds?: number;
  /**
   * Number of seconds after which the probe times out. Defaults to 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
   *
   * @default 1 second. Minimum value is 1. More info: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle#container-probes
   * @schema io.k8s.api.core.v1.Probe#timeoutSeconds
   */
  readonly timeoutSeconds?: number;
}
/**
 * Converts an object of type 'Probe' to JSON representation.
 */
export declare function toJson_Probe(
  obj: Probe | undefined,
): Record<string, any> | undefined;
/**
 * ContainerPort represents a network port in a single container.
 *
 * @schema io.k8s.api.core.v1.ContainerPort
 */
export interface ContainerPort {
  /**
   * Number of port to expose on the pod's IP address. This must be a valid port number, 0 < x < 65536.
   *
   * @schema io.k8s.api.core.v1.ContainerPort#containerPort
   */
  readonly containerPort: number;
  /**
   * What host IP to bind the external port to.
   *
   * @schema io.k8s.api.core.v1.ContainerPort#hostIP
   */
  readonly hostIp?: string;
  /**
   * Number of port to expose on the host. If specified, this must be a valid port number, 0 < x < 65536. If HostNetwork is specified, this must match ContainerPort. Most containers do not need this.
   *
   * @schema io.k8s.api.core.v1.ContainerPort#hostPort
   */
  readonly hostPort?: number;
  /**
   * If specified, this must be an IANA_SVC_NAME and unique within the pod. Each named port in a pod must have a unique name. Name for the port that can be referred to by services.
   *
   * @schema io.k8s.api.core.v1.ContainerPort#name
   */
  readonly name?: string;
  /**
   * Protocol for port. Must be UDP, TCP, or SCTP. Defaults to "TCP".
   *
   * @default TCP".
   * @schema io.k8s.api.core.v1.ContainerPort#protocol
   */
  readonly protocol?: string;
}
/**
 * Converts an object of type 'ContainerPort' to JSON representation.
 */
export declare function toJson_ContainerPort(
  obj: ContainerPort | undefined,
): Record<string, any> | undefined;
/**
 * SecurityContext holds security configuration that will be applied to a container. Some fields are present in both SecurityContext and PodSecurityContext.  When both are set, the values in SecurityContext take precedence.
 *
 * @schema io.k8s.api.core.v1.SecurityContext
 */
export interface SecurityContext {
  /**
   * AllowPrivilegeEscalation controls whether a process can gain more privileges than its parent process. This bool directly controls if the no_new_privs flag will be set on the container process. AllowPrivilegeEscalation is true always when the container is: 1) run as Privileged 2) has CAP_SYS_ADMIN
   *
   * @schema io.k8s.api.core.v1.SecurityContext#allowPrivilegeEscalation
   */
  readonly allowPrivilegeEscalation?: boolean;
  /**
   * The capabilities to add/drop when running containers. Defaults to the default set of capabilities granted by the container runtime.
   *
   * @default the default set of capabilities granted by the container runtime.
   * @schema io.k8s.api.core.v1.SecurityContext#capabilities
   */
  readonly capabilities?: Capabilities;
  /**
   * Run container in privileged mode. Processes in privileged containers are essentially equivalent to root on the host. Defaults to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.SecurityContext#privileged
   */
  readonly privileged?: boolean;
  /**
   * procMount denotes the type of proc mount to use for the containers. The default is DefaultProcMount which uses the container runtime defaults for readonly paths and masked paths. This requires the ProcMountType feature flag to be enabled.
   *
   * @schema io.k8s.api.core.v1.SecurityContext#procMount
   */
  readonly procMount?: string;
  /**
   * Whether this container has a read-only root filesystem. Default is false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.SecurityContext#readOnlyRootFilesystem
   */
  readonly readOnlyRootFilesystem?: boolean;
  /**
   * The GID to run the entrypoint of the container process. Uses runtime default if unset. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @schema io.k8s.api.core.v1.SecurityContext#runAsGroup
   */
  readonly runAsGroup?: number;
  /**
   * Indicates that the container must run as a non-root user. If true, the Kubelet will validate the image at runtime to ensure that it does not run as UID 0 (root) and fail to start the container if it does. If unset or false, no such validation will be performed. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @schema io.k8s.api.core.v1.SecurityContext#runAsNonRoot
   */
  readonly runAsNonRoot?: boolean;
  /**
   * The UID to run the entrypoint of the container process. Defaults to user specified in image metadata if unspecified. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @default user specified in image metadata if unspecified. May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   * @schema io.k8s.api.core.v1.SecurityContext#runAsUser
   */
  readonly runAsUser?: number;
  /**
   * The SELinux context to be applied to the container. If unspecified, the container runtime will allocate a random SELinux context for each container.  May also be set in PodSecurityContext.  If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @schema io.k8s.api.core.v1.SecurityContext#seLinuxOptions
   */
  readonly seLinuxOptions?: SeLinuxOptions;
  /**
   * The seccomp options to use by this container. If seccomp options are provided at both the pod & container level, the container options override the pod options.
   *
   * @schema io.k8s.api.core.v1.SecurityContext#seccompProfile
   */
  readonly seccompProfile?: SeccompProfile;
  /**
   * The Windows specific settings applied to all containers. If unspecified, the options from the PodSecurityContext will be used. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @schema io.k8s.api.core.v1.SecurityContext#windowsOptions
   */
  readonly windowsOptions?: WindowsSecurityContextOptions;
}
/**
 * Converts an object of type 'SecurityContext' to JSON representation.
 */
export declare function toJson_SecurityContext(
  obj: SecurityContext | undefined,
): Record<string, any> | undefined;
/**
 * volumeDevice describes a mapping of a raw block device within a container.
 *
 * @schema io.k8s.api.core.v1.VolumeDevice
 */
export interface VolumeDevice {
  /**
   * devicePath is the path inside of the container that the device will be mapped to.
   *
   * @schema io.k8s.api.core.v1.VolumeDevice#devicePath
   */
  readonly devicePath: string;
  /**
   * name must match the name of a persistentVolumeClaim in the pod
   *
   * @schema io.k8s.api.core.v1.VolumeDevice#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'VolumeDevice' to JSON representation.
 */
export declare function toJson_VolumeDevice(
  obj: VolumeDevice | undefined,
): Record<string, any> | undefined;
/**
 * VolumeMount describes a mounting of a Volume within a container.
 *
 * @schema io.k8s.api.core.v1.VolumeMount
 */
export interface VolumeMount {
  /**
   * Path within the container at which the volume should be mounted.  Must not contain ':'.
   *
   * @schema io.k8s.api.core.v1.VolumeMount#mountPath
   */
  readonly mountPath: string;
  /**
   * mountPropagation determines how mounts are propagated from the host to container and the other way around. When not set, MountPropagationNone is used. This field is beta in 1.10.
   *
   * @schema io.k8s.api.core.v1.VolumeMount#mountPropagation
   */
  readonly mountPropagation?: string;
  /**
   * This must match the Name of a Volume.
   *
   * @schema io.k8s.api.core.v1.VolumeMount#name
   */
  readonly name: string;
  /**
   * Mounted read-only if true, read-write otherwise (false or unspecified). Defaults to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.VolumeMount#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Path within the volume from which the container's volume should be mounted. Defaults to "" (volume's root).
   *
   * @default volume's root).
   * @schema io.k8s.api.core.v1.VolumeMount#subPath
   */
  readonly subPath?: string;
  /**
   * Expanded path within the volume from which the container's volume should be mounted. Behaves similarly to SubPath but environment variable references $(VAR_NAME) are expanded using the container's environment. Defaults to "" (volume's root). SubPathExpr and SubPath are mutually exclusive.
   *
   * @default volume's root). SubPathExpr and SubPath are mutually exclusive.
   * @schema io.k8s.api.core.v1.VolumeMount#subPathExpr
   */
  readonly subPathExpr?: string;
}
/**
 * Converts an object of type 'VolumeMount' to JSON representation.
 */
export declare function toJson_VolumeMount(
  obj: VolumeMount | undefined,
): Record<string, any> | undefined;
/**
 * PodDNSConfigOption defines DNS resolver options of a pod.
 *
 * @schema io.k8s.api.core.v1.PodDNSConfigOption
 */
export interface PodDnsConfigOption {
  /**
   * Required.
   *
   * @schema io.k8s.api.core.v1.PodDNSConfigOption#name
   */
  readonly name?: string;
  /**
   * @schema io.k8s.api.core.v1.PodDNSConfigOption#value
   */
  readonly value?: string;
}
/**
 * Converts an object of type 'PodDnsConfigOption' to JSON representation.
 */
export declare function toJson_PodDnsConfigOption(
  obj: PodDnsConfigOption | undefined,
): Record<string, any> | undefined;
/**
 * SELinuxOptions are the labels to be applied to the container
 *
 * @schema io.k8s.api.core.v1.SELinuxOptions
 */
export interface SeLinuxOptions {
  /**
   * Level is SELinux level label that applies to the container.
   *
   * @schema io.k8s.api.core.v1.SELinuxOptions#level
   */
  readonly level?: string;
  /**
   * Role is a SELinux role label that applies to the container.
   *
   * @schema io.k8s.api.core.v1.SELinuxOptions#role
   */
  readonly role?: string;
  /**
   * Type is a SELinux type label that applies to the container.
   *
   * @schema io.k8s.api.core.v1.SELinuxOptions#type
   */
  readonly type?: string;
  /**
   * User is a SELinux user label that applies to the container.
   *
   * @schema io.k8s.api.core.v1.SELinuxOptions#user
   */
  readonly user?: string;
}
/**
 * Converts an object of type 'SeLinuxOptions' to JSON representation.
 */
export declare function toJson_SeLinuxOptions(
  obj: SeLinuxOptions | undefined,
): Record<string, any> | undefined;
/**
 * SeccompProfile defines a pod/container's seccomp profile settings. Only one profile source may be set.
 *
 * @schema io.k8s.api.core.v1.SeccompProfile
 */
export interface SeccompProfile {
  /**
   * localhostProfile indicates a profile defined in a file on the node should be used. The profile must be preconfigured on the node to work. Must be a descending path, relative to the kubelet's configured seccomp profile location. Must only be set if type is "Localhost".
   *
   * @schema io.k8s.api.core.v1.SeccompProfile#localhostProfile
   */
  readonly localhostProfile?: string;
  /**
   * type indicates which kind of seccomp profile will be applied. Valid options are:
   *
   * Localhost - a profile defined in a file on the node should be used. RuntimeDefault - the container runtime default profile should be used. Unconfined - no profile should be applied.
   *
   * @schema io.k8s.api.core.v1.SeccompProfile#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'SeccompProfile' to JSON representation.
 */
export declare function toJson_SeccompProfile(
  obj: SeccompProfile | undefined,
): Record<string, any> | undefined;
/**
 * Sysctl defines a kernel parameter to be set
 *
 * @schema io.k8s.api.core.v1.Sysctl
 */
export interface Sysctl {
  /**
   * Name of a property to set
   *
   * @schema io.k8s.api.core.v1.Sysctl#name
   */
  readonly name: string;
  /**
   * Value of a property to set
   *
   * @schema io.k8s.api.core.v1.Sysctl#value
   */
  readonly value: string;
}
/**
 * Converts an object of type 'Sysctl' to JSON representation.
 */
export declare function toJson_Sysctl(
  obj: Sysctl | undefined,
): Record<string, any> | undefined;
/**
 * WindowsSecurityContextOptions contain Windows-specific options and credentials.
 *
 * @schema io.k8s.api.core.v1.WindowsSecurityContextOptions
 */
export interface WindowsSecurityContextOptions {
  /**
   * GMSACredentialSpec is where the GMSA admission webhook (https://github.com/kubernetes-sigs/windows-gmsa) inlines the contents of the GMSA credential spec named by the GMSACredentialSpecName field.
   *
   * @schema io.k8s.api.core.v1.WindowsSecurityContextOptions#gmsaCredentialSpec
   */
  readonly gmsaCredentialSpec?: string;
  /**
   * GMSACredentialSpecName is the name of the GMSA credential spec to use.
   *
   * @schema io.k8s.api.core.v1.WindowsSecurityContextOptions#gmsaCredentialSpecName
   */
  readonly gmsaCredentialSpecName?: string;
  /**
   * HostProcess determines if a container should be run as a 'Host Process' container. This field is alpha-level and will only be honored by components that enable the WindowsHostProcessContainers feature flag. Setting this field without the feature flag will result in errors when validating the Pod. All of a Pod's containers must have the same effective HostProcess value (it is not allowed to have a mix of HostProcess containers and non-HostProcess containers).  In addition, if HostProcess is true then HostNetwork must also be set to true.
   *
   * @schema io.k8s.api.core.v1.WindowsSecurityContextOptions#hostProcess
   */
  readonly hostProcess?: boolean;
  /**
   * The UserName in Windows to run the entrypoint of the container process. Defaults to the user specified in image metadata if unspecified. May also be set in PodSecurityContext. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   *
   * @default the user specified in image metadata if unspecified. May also be set in PodSecurityContext. If set in both SecurityContext and PodSecurityContext, the value specified in SecurityContext takes precedence.
   * @schema io.k8s.api.core.v1.WindowsSecurityContextOptions#runAsUserName
   */
  readonly runAsUserName?: string;
}
/**
 * Converts an object of type 'WindowsSecurityContextOptions' to JSON representation.
 */
export declare function toJson_WindowsSecurityContextOptions(
  obj: WindowsSecurityContextOptions | undefined,
): Record<string, any> | undefined;
/**
 * AzureFile represents an Azure File Service mount on the host and bind mount to the pod.
 *
 * @schema io.k8s.api.core.v1.AzureFileVolumeSource
 */
export interface AzureFileVolumeSource {
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.AzureFileVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * the name of secret that contains Azure Storage Account Name and Key
   *
   * @schema io.k8s.api.core.v1.AzureFileVolumeSource#secretName
   */
  readonly secretName: string;
  /**
   * Share Name
   *
   * @schema io.k8s.api.core.v1.AzureFileVolumeSource#shareName
   */
  readonly shareName: string;
}
/**
 * Converts an object of type 'AzureFileVolumeSource' to JSON representation.
 */
export declare function toJson_AzureFileVolumeSource(
  obj: AzureFileVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Ceph Filesystem mount that lasts the lifetime of a pod Cephfs volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.CephFSVolumeSource
 */
export interface CephFsVolumeSource {
  /**
   * Required: Monitors is a collection of Ceph monitors More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSVolumeSource#monitors
   */
  readonly monitors: string[];
  /**
   * Optional: Used as the mounted root, rather than the full Ceph tree, default is /
   *
   * @schema io.k8s.api.core.v1.CephFSVolumeSource#path
   */
  readonly path?: string;
  /**
   * Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.CephFSVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Optional: SecretFile is the path to key ring for User, default is /etc/ceph/user.secret More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSVolumeSource#secretFile
   */
  readonly secretFile?: string;
  /**
   * Optional: SecretRef is reference to the authentication secret for User, default is empty. More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSVolumeSource#secretRef
   */
  readonly secretRef?: LocalObjectReference;
  /**
   * Optional: User is the rados user name, default is admin More info: https://examples.k8s.io/volumes/cephfs/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.CephFSVolumeSource#user
   */
  readonly user?: string;
}
/**
 * Converts an object of type 'CephFsVolumeSource' to JSON representation.
 */
export declare function toJson_CephFsVolumeSource(
  obj: CephFsVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a cinder volume resource in Openstack. A Cinder volume must exist before mounting to a container. The volume must also be in the same region as the kubelet. Cinder volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.CinderVolumeSource
 */
export interface CinderVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @schema io.k8s.api.core.v1.CinderVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   * @schema io.k8s.api.core.v1.CinderVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Optional: points to a secret object containing parameters used to connect to OpenStack.
   *
   * @schema io.k8s.api.core.v1.CinderVolumeSource#secretRef
   */
  readonly secretRef?: LocalObjectReference;
  /**
   * volume id used to identify the volume in cinder. More info: https://examples.k8s.io/mysql-cinder-pd/README.md
   *
   * @schema io.k8s.api.core.v1.CinderVolumeSource#volumeID
   */
  readonly volumeId: string;
}
/**
 * Converts an object of type 'CinderVolumeSource' to JSON representation.
 */
export declare function toJson_CinderVolumeSource(
  obj: CinderVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Adapts a ConfigMap into a volume.
 *
 * The contents of the target ConfigMap's Data field will be presented in a volume as files using the keys in the Data field as the file names, unless the items element is populated with specific mappings of keys to paths. ConfigMap volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.ConfigMapVolumeSource
 */
export interface ConfigMapVolumeSource {
  /**
   * Optional: mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   *
   * @default 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   * @schema io.k8s.api.core.v1.ConfigMapVolumeSource#defaultMode
   */
  readonly defaultMode?: number;
  /**
   * If unspecified, each key-value pair in the Data field of the referenced ConfigMap will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the ConfigMap, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
   *
   * @schema io.k8s.api.core.v1.ConfigMapVolumeSource#items
   */
  readonly items?: KeyToPath[];
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.ConfigMapVolumeSource#name
   */
  readonly name?: string;
  /**
   * Specify whether the ConfigMap or its keys must be defined
   *
   * @schema io.k8s.api.core.v1.ConfigMapVolumeSource#optional
   */
  readonly optional?: boolean;
}
/**
 * Converts an object of type 'ConfigMapVolumeSource' to JSON representation.
 */
export declare function toJson_ConfigMapVolumeSource(
  obj: ConfigMapVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a source location of a volume to mount, managed by an external CSI driver
 *
 * @schema io.k8s.api.core.v1.CSIVolumeSource
 */
export interface CsiVolumeSource {
  /**
   * Driver is the name of the CSI driver that handles this volume. Consult with your admin for the correct name as registered in the cluster.
   *
   * @schema io.k8s.api.core.v1.CSIVolumeSource#driver
   */
  readonly driver: string;
  /**
   * Filesystem type to mount. Ex. "ext4", "xfs", "ntfs". If not provided, the empty value is passed to the associated CSI driver which will determine the default filesystem to apply.
   *
   * @schema io.k8s.api.core.v1.CSIVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * NodePublishSecretRef is a reference to the secret object containing sensitive information to pass to the CSI driver to complete the CSI NodePublishVolume and NodeUnpublishVolume calls. This field is optional, and  may be empty if no secret is required. If the secret object contains more than one secret, all secret references are passed.
   *
   * @schema io.k8s.api.core.v1.CSIVolumeSource#nodePublishSecretRef
   */
  readonly nodePublishSecretRef?: LocalObjectReference;
  /**
   * Specifies a read-only configuration for the volume. Defaults to false (read/write).
   *
   * @default false (read/write).
   * @schema io.k8s.api.core.v1.CSIVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * VolumeAttributes stores driver-specific properties that are passed to the CSI driver. Consult your driver's documentation for supported values.
   *
   * @schema io.k8s.api.core.v1.CSIVolumeSource#volumeAttributes
   */
  readonly volumeAttributes?: {
    [key: string]: string;
  };
}
/**
 * Converts an object of type 'CsiVolumeSource' to JSON representation.
 */
export declare function toJson_CsiVolumeSource(
  obj: CsiVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * DownwardAPIVolumeSource represents a volume containing downward API info. Downward API volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.DownwardAPIVolumeSource
 */
export interface DownwardApiVolumeSource {
  /**
   * Optional: mode bits to use on created files by default. Must be a Optional: mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   *
   * @default 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   * @schema io.k8s.api.core.v1.DownwardAPIVolumeSource#defaultMode
   */
  readonly defaultMode?: number;
  /**
   * Items is a list of downward API volume file
   *
   * @schema io.k8s.api.core.v1.DownwardAPIVolumeSource#items
   */
  readonly items?: DownwardApiVolumeFile[];
}
/**
 * Converts an object of type 'DownwardApiVolumeSource' to JSON representation.
 */
export declare function toJson_DownwardApiVolumeSource(
  obj: DownwardApiVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents an empty directory for a pod. Empty directory volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.EmptyDirVolumeSource
 */
export interface EmptyDirVolumeSource {
  /**
   * What type of storage medium should back this directory. The default is "" which means to use the node's default medium. Must be an empty string (default) or Memory. More info: https://kubernetes.io/docs/concepts/storage/volumes#emptydir
   *
   * @schema io.k8s.api.core.v1.EmptyDirVolumeSource#medium
   */
  readonly medium?: string;
  /**
   * Total amount of local storage required for this EmptyDir volume. The size limit is also applicable for memory medium. The maximum usage on memory medium EmptyDir would be the minimum value between the SizeLimit specified here and the sum of memory limits of all containers in a pod. The default is nil which means that the limit is undefined. More info: http://kubernetes.io/docs/user-guide/volumes#emptydir
   *
   * @schema io.k8s.api.core.v1.EmptyDirVolumeSource#sizeLimit
   */
  readonly sizeLimit?: Quantity;
}
/**
 * Converts an object of type 'EmptyDirVolumeSource' to JSON representation.
 */
export declare function toJson_EmptyDirVolumeSource(
  obj: EmptyDirVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents an ephemeral volume that is handled by a normal storage driver.
 *
 * @schema io.k8s.api.core.v1.EphemeralVolumeSource
 */
export interface EphemeralVolumeSource {
  /**
   * Will be used to create a stand-alone PVC to provision the volume. The pod in which this EphemeralVolumeSource is embedded will be the owner of the PVC, i.e. the PVC will be deleted together with the pod.  The name of the PVC will be `<pod name>-<volume name>` where `<volume name>` is the name from the `PodSpec.Volumes` array entry. Pod validation will reject the pod if the concatenated name is not valid for a PVC (for example, too long).
   *
   * An existing PVC with that name that is not owned by the pod will *not* be used for the pod to avoid using an unrelated volume by mistake. Starting the pod is then blocked until the unrelated PVC is removed. If such a pre-created PVC is meant to be used by the pod, the PVC has to updated with an owner reference to the pod once the pod exists. Normally this should not be necessary, but it may be useful when manually reconstructing a broken cluster.
   *
   * This field is read-only and no changes will be made by Kubernetes to the PVC after it has been created.
   *
   * Required, must not be nil.
   *
   * @schema io.k8s.api.core.v1.EphemeralVolumeSource#volumeClaimTemplate
   */
  readonly volumeClaimTemplate?: PersistentVolumeClaimTemplate;
}
/**
 * Converts an object of type 'EphemeralVolumeSource' to JSON representation.
 */
export declare function toJson_EphemeralVolumeSource(
  obj: EphemeralVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * FlexVolume represents a generic volume resource that is provisioned/attached using an exec based plugin.
 *
 * @schema io.k8s.api.core.v1.FlexVolumeSource
 */
export interface FlexVolumeSource {
  /**
   * Driver is the name of the driver to use for this volume.
   *
   * @schema io.k8s.api.core.v1.FlexVolumeSource#driver
   */
  readonly driver: string;
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". The default filesystem depends on FlexVolume script.
   *
   * @schema io.k8s.api.core.v1.FlexVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Optional: Extra command options if any.
   *
   * @schema io.k8s.api.core.v1.FlexVolumeSource#options
   */
  readonly options?: {
    [key: string]: string;
  };
  /**
   * Optional: Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.FlexVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * Optional: SecretRef is reference to the secret object containing sensitive information to pass to the plugin scripts. This may be empty if no secret object is specified. If the secret object contains more than one secret, all secrets are passed to the plugin scripts.
   *
   * @schema io.k8s.api.core.v1.FlexVolumeSource#secretRef
   */
  readonly secretRef?: LocalObjectReference;
}
/**
 * Converts an object of type 'FlexVolumeSource' to JSON representation.
 */
export declare function toJson_FlexVolumeSource(
  obj: FlexVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a volume that is populated with the contents of a git repository. Git repo volumes do not support ownership management. Git repo volumes support SELinux relabeling.
 *
 * DEPRECATED: GitRepo is deprecated. To provision a container with a git repo, mount an EmptyDir into an InitContainer that clones the repo using git, then mount the EmptyDir into the Pod's container.
 *
 * @schema io.k8s.api.core.v1.GitRepoVolumeSource
 */
export interface GitRepoVolumeSource {
  /**
   * Target directory name. Must not contain or start with '..'.  If '.' is supplied, the volume directory will be the git repository.  Otherwise, if specified, the volume will contain the git repository in the subdirectory with the given name.
   *
   * @schema io.k8s.api.core.v1.GitRepoVolumeSource#directory
   */
  readonly directory?: string;
  /**
   * Repository URL
   *
   * @schema io.k8s.api.core.v1.GitRepoVolumeSource#repository
   */
  readonly repository: string;
  /**
   * Commit hash for the specified revision.
   *
   * @schema io.k8s.api.core.v1.GitRepoVolumeSource#revision
   */
  readonly revision?: string;
}
/**
 * Converts an object of type 'GitRepoVolumeSource' to JSON representation.
 */
export declare function toJson_GitRepoVolumeSource(
  obj: GitRepoVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Glusterfs mount that lasts the lifetime of a pod. Glusterfs volumes do not support ownership management or SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.GlusterfsVolumeSource
 */
export interface GlusterfsVolumeSource {
  /**
   * EndpointsName is the endpoint name that details Glusterfs topology. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   *
   * @schema io.k8s.api.core.v1.GlusterfsVolumeSource#endpoints
   */
  readonly endpoints: string;
  /**
   * Path is the Glusterfs volume path. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   *
   * @schema io.k8s.api.core.v1.GlusterfsVolumeSource#path
   */
  readonly path: string;
  /**
   * ReadOnly here will force the Glusterfs volume to be mounted with read-only permissions. Defaults to false. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   *
   * @default false. More info: https://examples.k8s.io/volumes/glusterfs/README.md#create-a-pod
   * @schema io.k8s.api.core.v1.GlusterfsVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
}
/**
 * Converts an object of type 'GlusterfsVolumeSource' to JSON representation.
 */
export declare function toJson_GlusterfsVolumeSource(
  obj: GlusterfsVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents an ISCSI disk. ISCSI volumes can only be mounted as read/write once. ISCSI volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.ISCSIVolumeSource
 */
export interface IscsiVolumeSource {
  /**
   * whether support iSCSI Discovery CHAP authentication
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#chapAuthDiscovery
   */
  readonly chapAuthDiscovery?: boolean;
  /**
   * whether support iSCSI Session CHAP authentication
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#chapAuthSession
   */
  readonly chapAuthSession?: boolean;
  /**
   * Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#iscsi
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Custom iSCSI Initiator Name. If initiatorName is specified with iscsiInterface simultaneously, new iSCSI interface <target portal>:<volume name> will be created for the connection.
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#initiatorName
   */
  readonly initiatorName?: string;
  /**
   * Target iSCSI Qualified Name.
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#iqn
   */
  readonly iqn: string;
  /**
   * iSCSI Interface Name that uses an iSCSI transport. Defaults to 'default' (tcp).
   *
   * @default default' (tcp).
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#iscsiInterface
   */
  readonly iscsiInterface?: string;
  /**
   * iSCSI Target Lun number.
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#lun
   */
  readonly lun: number;
  /**
   * iSCSI Target Portal List. The portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#portals
   */
  readonly portals?: string[];
  /**
   * ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false.
   *
   * @default false.
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * CHAP Secret for iSCSI target and initiator authentication
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#secretRef
   */
  readonly secretRef?: LocalObjectReference;
  /**
   * iSCSI Target Portal. The Portal is either an IP or ip_addr:port if the port is other than default (typically TCP ports 860 and 3260).
   *
   * @schema io.k8s.api.core.v1.ISCSIVolumeSource#targetPortal
   */
  readonly targetPortal: string;
}
/**
 * Converts an object of type 'IscsiVolumeSource' to JSON representation.
 */
export declare function toJson_IscsiVolumeSource(
  obj: IscsiVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolumeClaimVolumeSource references the user's PVC in the same namespace. This volume finds the bound PV and mounts that volume for the pod. A PersistentVolumeClaimVolumeSource is, essentially, a wrapper around another type of volume that is owned by someone else (the system).
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeClaimVolumeSource
 */
export interface PersistentVolumeClaimVolumeSource {
  /**
   * ClaimName is the name of a PersistentVolumeClaim in the same namespace as the pod using this volume. More info: https://kubernetes.io/docs/concepts/storage/persistent-volumes#persistentvolumeclaims
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimVolumeSource#claimName
   */
  readonly claimName: string;
  /**
   * Will force the ReadOnly setting in VolumeMounts. Default false.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
}
/**
 * Converts an object of type 'PersistentVolumeClaimVolumeSource' to JSON representation.
 */
export declare function toJson_PersistentVolumeClaimVolumeSource(
  obj: PersistentVolumeClaimVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a projected volume source
 *
 * @schema io.k8s.api.core.v1.ProjectedVolumeSource
 */
export interface ProjectedVolumeSource {
  /**
   * Mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   *
   * @schema io.k8s.api.core.v1.ProjectedVolumeSource#defaultMode
   */
  readonly defaultMode?: number;
  /**
   * list of volume projections
   *
   * @schema io.k8s.api.core.v1.ProjectedVolumeSource#sources
   */
  readonly sources?: VolumeProjection[];
}
/**
 * Converts an object of type 'ProjectedVolumeSource' to JSON representation.
 */
export declare function toJson_ProjectedVolumeSource(
  obj: ProjectedVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a Rados Block Device mount that lasts the lifetime of a pod. RBD volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.RBDVolumeSource
 */
export interface RbdVolumeSource {
  /**
   * Filesystem type of the volume that you want to mount. Tip: Ensure that the filesystem type is supported by the host operating system. Examples: "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified. More info: https://kubernetes.io/docs/concepts/storage/volumes#rbd
   *
   * @schema io.k8s.api.core.v1.RBDVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * The rados image name. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.RBDVolumeSource#image
   */
  readonly image: string;
  /**
   * Keyring is the path to key ring for RBDUser. Default is /etc/ceph/keyring. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default etc/ceph/keyring. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDVolumeSource#keyring
   */
  readonly keyring?: string;
  /**
   * A collection of Ceph monitors. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @schema io.k8s.api.core.v1.RBDVolumeSource#monitors
   */
  readonly monitors: string[];
  /**
   * The rados pool name. Default is rbd. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default rbd. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDVolumeSource#pool
   */
  readonly pool?: string;
  /**
   * ReadOnly here will force the ReadOnly setting in VolumeMounts. Defaults to false. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default false. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * SecretRef is name of the authentication secret for RBDUser. If provided overrides keyring. Default is nil. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default nil. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDVolumeSource#secretRef
   */
  readonly secretRef?: LocalObjectReference;
  /**
   * The rados user name. Default is admin. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   *
   * @default admin. More info: https://examples.k8s.io/volumes/rbd/README.md#how-to-use-it
   * @schema io.k8s.api.core.v1.RBDVolumeSource#user
   */
  readonly user?: string;
}
/**
 * Converts an object of type 'RbdVolumeSource' to JSON representation.
 */
export declare function toJson_RbdVolumeSource(
  obj: RbdVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * ScaleIOVolumeSource represents a persistent ScaleIO volume
 *
 * @schema io.k8s.api.core.v1.ScaleIOVolumeSource
 */
export interface ScaleIoVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Default is "xfs".
   *
   * @default xfs".
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * The host address of the ScaleIO API Gateway.
   *
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#gateway
   */
  readonly gateway: string;
  /**
   * The name of the ScaleIO Protection Domain for the configured storage.
   *
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#protectionDomain
   */
  readonly protectionDomain?: string;
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * SecretRef references to the secret for ScaleIO user and other sensitive information. If this is not provided, Login operation will fail.
   *
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#secretRef
   */
  readonly secretRef: LocalObjectReference;
  /**
   * Flag to enable/disable SSL communication with Gateway, default false
   *
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#sslEnabled
   */
  readonly sslEnabled?: boolean;
  /**
   * Indicates whether the storage for a volume should be ThickProvisioned or ThinProvisioned. Default is ThinProvisioned.
   *
   * @default ThinProvisioned.
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#storageMode
   */
  readonly storageMode?: string;
  /**
   * The ScaleIO Storage Pool associated with the protection domain.
   *
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#storagePool
   */
  readonly storagePool?: string;
  /**
   * The name of the storage system as configured in ScaleIO.
   *
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#system
   */
  readonly system: string;
  /**
   * The name of a volume already created in the ScaleIO system that is associated with this volume source.
   *
   * @schema io.k8s.api.core.v1.ScaleIOVolumeSource#volumeName
   */
  readonly volumeName?: string;
}
/**
 * Converts an object of type 'ScaleIoVolumeSource' to JSON representation.
 */
export declare function toJson_ScaleIoVolumeSource(
  obj: ScaleIoVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Adapts a Secret into a volume.
 *
 * The contents of the target Secret's Data field will be presented in a volume as files using the keys in the Data field as the file names. Secret volumes support ownership management and SELinux relabeling.
 *
 * @schema io.k8s.api.core.v1.SecretVolumeSource
 */
export interface SecretVolumeSource {
  /**
   * Optional: mode bits used to set permissions on created files by default. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. Defaults to 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   *
   * @default 0644. Directories within the path are not affected by this setting. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   * @schema io.k8s.api.core.v1.SecretVolumeSource#defaultMode
   */
  readonly defaultMode?: number;
  /**
   * If unspecified, each key-value pair in the Data field of the referenced Secret will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the Secret, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
   *
   * @schema io.k8s.api.core.v1.SecretVolumeSource#items
   */
  readonly items?: KeyToPath[];
  /**
   * Specify whether the Secret or its keys must be defined
   *
   * @schema io.k8s.api.core.v1.SecretVolumeSource#optional
   */
  readonly optional?: boolean;
  /**
   * Name of the secret in the pod's namespace to use. More info: https://kubernetes.io/docs/concepts/storage/volumes#secret
   *
   * @schema io.k8s.api.core.v1.SecretVolumeSource#secretName
   */
  readonly secretName?: string;
}
/**
 * Converts an object of type 'SecretVolumeSource' to JSON representation.
 */
export declare function toJson_SecretVolumeSource(
  obj: SecretVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * Represents a StorageOS persistent volume resource.
 *
 * @schema io.k8s.api.core.v1.StorageOSVolumeSource
 */
export interface StorageOsVolumeSource {
  /**
   * Filesystem type to mount. Must be a filesystem type supported by the host operating system. Ex. "ext4", "xfs", "ntfs". Implicitly inferred to be "ext4" if unspecified.
   *
   * @schema io.k8s.api.core.v1.StorageOSVolumeSource#fsType
   */
  readonly fsType?: string;
  /**
   * Defaults to false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   *
   * @default false (read/write). ReadOnly here will force the ReadOnly setting in VolumeMounts.
   * @schema io.k8s.api.core.v1.StorageOSVolumeSource#readOnly
   */
  readonly readOnly?: boolean;
  /**
   * SecretRef specifies the secret to use for obtaining the StorageOS API credentials.  If not specified, default values will be attempted.
   *
   * @schema io.k8s.api.core.v1.StorageOSVolumeSource#secretRef
   */
  readonly secretRef?: LocalObjectReference;
  /**
   * VolumeName is the human-readable name of the StorageOS volume.  Volume names are only unique within a namespace.
   *
   * @schema io.k8s.api.core.v1.StorageOSVolumeSource#volumeName
   */
  readonly volumeName?: string;
  /**
   * VolumeNamespace specifies the scope of the volume within StorageOS.  If no namespace is specified then the Pod's namespace will be used.  This allows the Kubernetes name scoping to be mirrored within StorageOS for tighter integration. Set VolumeName to any name to override the default behaviour. Set to "default" if you are not using namespaces within StorageOS. Namespaces that do not pre-exist within StorageOS will be created.
   *
   * @schema io.k8s.api.core.v1.StorageOSVolumeSource#volumeNamespace
   */
  readonly volumeNamespace?: string;
}
/**
 * Converts an object of type 'StorageOsVolumeSource' to JSON representation.
 */
export declare function toJson_StorageOsVolumeSource(
  obj: StorageOsVolumeSource | undefined,
): Record<string, any> | undefined;
/**
 * A scoped-resource selector requirement is a selector that contains values, a scope name, and an operator that relates the scope name and values.
 *
 * @schema io.k8s.api.core.v1.ScopedResourceSelectorRequirement
 */
export interface ScopedResourceSelectorRequirement {
  /**
   * Represents a scope's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist.
   *
   * @schema io.k8s.api.core.v1.ScopedResourceSelectorRequirement#operator
   */
  readonly operator: string;
  /**
   * The name of the scope that the selector applies to.
   *
   * @schema io.k8s.api.core.v1.ScopedResourceSelectorRequirement#scopeName
   */
  readonly scopeName: string;
  /**
   * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
   *
   * @schema io.k8s.api.core.v1.ScopedResourceSelectorRequirement#values
   */
  readonly values?: string[];
}
/**
 * Converts an object of type 'ScopedResourceSelectorRequirement' to JSON representation.
 */
export declare function toJson_ScopedResourceSelectorRequirement(
  obj: ScopedResourceSelectorRequirement | undefined,
): Record<string, any> | undefined;
/**
 * ClientIPConfig represents the configurations of Client IP based session affinity.
 *
 * @schema io.k8s.api.core.v1.ClientIPConfig
 */
export interface ClientIpConfig {
  /**
   * timeoutSeconds specifies the seconds of ClientIP type session sticky time. The value must be >0 && <=86400(for 1 day) if ServiceAffinity == "ClientIP". Default value is 10800(for 3 hours).
   *
   * @schema io.k8s.api.core.v1.ClientIPConfig#timeoutSeconds
   */
  readonly timeoutSeconds?: number;
}
/**
 * Converts an object of type 'ClientIpConfig' to JSON representation.
 */
export declare function toJson_ClientIpConfig(
  obj: ClientIpConfig | undefined,
): Record<string, any> | undefined;
/**
 * ForZone provides information about which zones should consume this endpoint.
 *
 * @schema io.k8s.api.discovery.v1.ForZone
 */
export interface ForZone {
  /**
   * name represents the name of the zone.
   *
   * @schema io.k8s.api.discovery.v1.ForZone#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'ForZone' to JSON representation.
 */
export declare function toJson_ForZone(
  obj: ForZone | undefined,
): Record<string, any> | undefined;
/**
 * ForZone provides information about which zones should consume this endpoint.
 *
 * @schema io.k8s.api.discovery.v1beta1.ForZone
 */
export interface ForZoneV1Beta1 {
  /**
   * name represents the name of the zone.
   *
   * @schema io.k8s.api.discovery.v1beta1.ForZone#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'ForZoneV1Beta1' to JSON representation.
 */
export declare function toJson_ForZoneV1Beta1(
  obj: ForZoneV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * NonResourcePolicyRule is a predicate that matches non-resource requests according to their verb and the target non-resource URL. A NonResourcePolicyRule matches a request if and only if both (a) at least one member of verbs matches the request and (b) at least one member of nonResourceURLs matches the request.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.NonResourcePolicyRule
 */
export interface NonResourcePolicyRuleV1Beta1 {
  /**
   * `nonResourceURLs` is a set of url prefixes that a user should have access to and may not be empty. For example:
   * - "/healthz" is legal
   * - "/hea*" is illegal
   * - "/hea" is legal but matches nothing
   * - "/hea/*" also matches nothing
   * - "/healthz/*" matches all per-component health checks.
   * "*" matches all non-resource urls. if it is present, it must be the only entry. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.NonResourcePolicyRule#nonResourceURLs
   */
  readonly nonResourceUrLs: string[];
  /**
   * `verbs` is a list of matching verbs and may not be empty. "*" matches all verbs. If it is present, it must be the only entry. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.NonResourcePolicyRule#verbs
   */
  readonly verbs: string[];
}
/**
 * Converts an object of type 'NonResourcePolicyRuleV1Beta1' to JSON representation.
 */
export declare function toJson_NonResourcePolicyRuleV1Beta1(
  obj: NonResourcePolicyRuleV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * ResourcePolicyRule is a predicate that matches some resource requests, testing the request's verb and the target resource. A ResourcePolicyRule matches a resource request if and only if: (a) at least one member of verbs matches the request, (b) at least one member of apiGroups matches the request, (c) at least one member of resources matches the request, and (d) least one member of namespaces matches the request.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.ResourcePolicyRule
 */
export interface ResourcePolicyRuleV1Beta1 {
  /**
   * `apiGroups` is a list of matching API groups and may not be empty. "*" matches all API groups and, if present, must be the only entry. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.ResourcePolicyRule#apiGroups
   */
  readonly apiGroups: string[];
  /**
   * `clusterScope` indicates whether to match requests that do not specify a namespace (which happens either because the resource is not namespaced or the request targets all namespaces). If this field is omitted or false then the `namespaces` field must contain a non-empty list.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.ResourcePolicyRule#clusterScope
   */
  readonly clusterScope?: boolean;
  /**
   * `namespaces` is a list of target namespaces that restricts matches.  A request that specifies a target namespace matches only if either (a) this list contains that target namespace or (b) this list contains "*".  Note that "*" matches any specified namespace but does not match a request that _does not specify_ a namespace (see the `clusterScope` field for that). This list may be empty, but only if `clusterScope` is true.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.ResourcePolicyRule#namespaces
   */
  readonly namespaces?: string[];
  /**
   * `resources` is a list of matching resources (i.e., lowercase and plural) with, if desired, subresource.  For example, [ "services", "nodes/status" ].  This list may not be empty. "*" matches all resources and, if present, must be the only entry. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.ResourcePolicyRule#resources
   */
  readonly resources: string[];
  /**
   * `verbs` is a list of matching verbs and may not be empty. "*" matches all verbs and, if present, must be the only entry. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.ResourcePolicyRule#verbs
   */
  readonly verbs: string[];
}
/**
 * Converts an object of type 'ResourcePolicyRuleV1Beta1' to JSON representation.
 */
export declare function toJson_ResourcePolicyRuleV1Beta1(
  obj: ResourcePolicyRuleV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * Subject matches the originator of a request, as identified by the request authentication system. There are three ways of matching an originator; by user, group, or service account.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.Subject
 */
export interface SubjectV1Beta1 {
  /**
   * `group` matches based on user group name.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.Subject#group
   */
  readonly group?: GroupSubjectV1Beta1;
  /**
   * `kind` indicates which one of the other fields is non-empty. Required
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.Subject#kind
   */
  readonly kind: string;
  /**
   * `serviceAccount` matches ServiceAccounts.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.Subject#serviceAccount
   */
  readonly serviceAccount?: ServiceAccountSubjectV1Beta1;
  /**
   * `user` matches based on username.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.Subject#user
   */
  readonly user?: UserSubjectV1Beta1;
}
/**
 * Converts an object of type 'SubjectV1Beta1' to JSON representation.
 */
export declare function toJson_SubjectV1Beta1(
  obj: SubjectV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * LimitResponse defines how to handle requests that can not be executed right now.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.LimitResponse
 */
export interface LimitResponseV1Beta1 {
  /**
   * `queuing` holds the configuration parameters for queuing. This field may be non-empty only if `type` is `"Queue"`.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.LimitResponse#queuing
   */
  readonly queuing?: QueuingConfigurationV1Beta1;
  /**
   * `type` is "Queue" or "Reject". "Queue" means that requests that can not be executed upon arrival are held in a queue until they can be executed or a queuing limit is reached. "Reject" means that requests that can not be executed upon arrival are rejected. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.LimitResponse#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'LimitResponseV1Beta1' to JSON representation.
 */
export declare function toJson_LimitResponseV1Beta1(
  obj: LimitResponseV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * IngressServiceBackend references a Kubernetes Service as a Backend.
 *
 * @schema io.k8s.api.networking.v1.IngressServiceBackend
 */
export interface IngressServiceBackend {
  /**
   * Name is the referenced service. The service must exist in the same namespace as the Ingress object.
   *
   * @schema io.k8s.api.networking.v1.IngressServiceBackend#name
   */
  readonly name: string;
  /**
   * Port of the referenced service. A port name or port number is required for a IngressServiceBackend.
   *
   * @schema io.k8s.api.networking.v1.IngressServiceBackend#port
   */
  readonly port?: ServiceBackendPort;
}
/**
 * Converts an object of type 'IngressServiceBackend' to JSON representation.
 */
export declare function toJson_IngressServiceBackend(
  obj: IngressServiceBackend | undefined,
): Record<string, any> | undefined;
/**
 * HTTPIngressRuleValue is a list of http selectors pointing to backends. In the example: http://<host>/<path>?<searchpart> -> backend where where parts of the url correspond to RFC 3986, this resource will be used to match against everything after the last '/' and before the first '?' or '#'.
 *
 * @schema io.k8s.api.networking.v1.HTTPIngressRuleValue
 */
export interface HttpIngressRuleValue {
  /**
   * A collection of paths that map requests to backends.
   *
   * @schema io.k8s.api.networking.v1.HTTPIngressRuleValue#paths
   */
  readonly paths: HttpIngressPath[];
}
/**
 * Converts an object of type 'HttpIngressRuleValue' to JSON representation.
 */
export declare function toJson_HttpIngressRuleValue(
  obj: HttpIngressRuleValue | undefined,
): Record<string, any> | undefined;
/**
 * NetworkPolicyPort describes a port to allow traffic on
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicyPort
 */
export interface NetworkPolicyPort {
  /**
   * If set, indicates that the range of ports from port to endPort, inclusive, should be allowed by the policy. This field cannot be defined if the port field is not defined or if the port field is defined as a named (string) port. The endPort must be equal or greater than port. This feature is in Beta state and is enabled by default. It can be disabled using the Feature Gate "NetworkPolicyEndPort".
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyPort#endPort
   */
  readonly endPort?: number;
  /**
   * The port on the given protocol. This can either be a numerical or named port on a pod. If this field is not provided, this matches all port names and numbers. If present, only traffic on the specified protocol AND port will be matched.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyPort#port
   */
  readonly port?: IntOrString;
  /**
   * The protocol (TCP, UDP, or SCTP) which traffic must match. If not specified, this field defaults to TCP.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyPort#protocol
   */
  readonly protocol?: string;
}
/**
 * Converts an object of type 'NetworkPolicyPort' to JSON representation.
 */
export declare function toJson_NetworkPolicyPort(
  obj: NetworkPolicyPort | undefined,
): Record<string, any> | undefined;
/**
 * NetworkPolicyPeer describes a peer to allow traffic to/from. Only certain combinations of fields are allowed
 *
 * @schema io.k8s.api.networking.v1.NetworkPolicyPeer
 */
export interface NetworkPolicyPeer {
  /**
   * IPBlock defines policy on a particular IPBlock. If this field is set then neither of the other fields can be.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyPeer#ipBlock
   */
  readonly ipBlock?: IpBlock;
  /**
   * Selects Namespaces using cluster-scoped labels. This field follows standard label selector semantics; if present but empty, it selects all namespaces.
   *
   * If PodSelector is also set, then the NetworkPolicyPeer as a whole selects the Pods matching PodSelector in the Namespaces selected by NamespaceSelector. Otherwise it selects all Pods in the Namespaces selected by NamespaceSelector.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyPeer#namespaceSelector
   */
  readonly namespaceSelector?: LabelSelector;
  /**
   * This is a label selector which selects Pods. This field follows standard label selector semantics; if present but empty, it selects all pods.
   *
   * If NamespaceSelector is also set, then the NetworkPolicyPeer as a whole selects the Pods matching PodSelector in the Namespaces selected by NamespaceSelector. Otherwise it selects the Pods matching PodSelector in the policy's own Namespace.
   *
   * @schema io.k8s.api.networking.v1.NetworkPolicyPeer#podSelector
   */
  readonly podSelector?: LabelSelector;
}
/**
 * Converts an object of type 'NetworkPolicyPeer' to JSON representation.
 */
export declare function toJson_NetworkPolicyPeer(
  obj: NetworkPolicyPeer | undefined,
): Record<string, any> | undefined;
/**
 * IDRange provides a min/max of an allowed range of IDs.
 *
 * @schema io.k8s.api.policy.v1beta1.IDRange
 */
export interface IdRangeV1Beta1 {
  /**
   * max is the end of the range, inclusive.
   *
   * @schema io.k8s.api.policy.v1beta1.IDRange#max
   */
  readonly max: number;
  /**
   * min is the start of the range, inclusive.
   *
   * @schema io.k8s.api.policy.v1beta1.IDRange#min
   */
  readonly min: number;
}
/**
 * Converts an object of type 'IdRangeV1Beta1' to JSON representation.
 */
export declare function toJson_IdRangeV1Beta1(
  obj: IdRangeV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * VolumeNodeResources is a set of resource limits for scheduling of volumes.
 *
 * @schema io.k8s.api.storage.v1.VolumeNodeResources
 */
export interface VolumeNodeResources {
  /**
   * Maximum number of unique volumes managed by the CSI driver that can be used on a node. A volume that is both attached and mounted on a node is considered to be used once, not twice. The same rule applies for a unique volume that is shared among multiple pods on the same node. If this field is not specified, then the supported number of volumes on this node is unbounded.
   *
   * @schema io.k8s.api.storage.v1.VolumeNodeResources#count
   */
  readonly count?: number;
}
/**
 * Converts an object of type 'VolumeNodeResources' to JSON representation.
 */
export declare function toJson_VolumeNodeResources(
  obj: VolumeNodeResources | undefined,
): Record<string, any> | undefined;
/**
 * WebhookConversion describes how to call a conversion webhook
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.WebhookConversion
 */
export interface WebhookConversion {
  /**
   * clientConfig is the instructions for how to call the webhook if strategy is `Webhook`.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.WebhookConversion#clientConfig
   */
  readonly clientConfig?: WebhookClientConfig;
  /**
   * conversionReviewVersions is an ordered list of preferred `ConversionReview` versions the Webhook expects. The API server will use the first version in the list which it supports. If none of the versions specified in this list are supported by API server, conversion will fail for the custom resource. If a persisted Webhook configuration specifies allowed versions and does not include any versions known to the API Server, calls to the webhook will fail.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.WebhookConversion#conversionReviewVersions
   */
  readonly conversionReviewVersions: string[];
}
/**
 * Converts an object of type 'WebhookConversion' to JSON representation.
 */
export declare function toJson_WebhookConversion(
  obj: WebhookConversion | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceColumnDefinition specifies a column for server side printing.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceColumnDefinition
 */
export interface CustomResourceColumnDefinition {
  /**
   * description is a human readable description of this column.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceColumnDefinition#description
   */
  readonly description?: string;
  /**
   * format is an optional OpenAPI type definition for this column. The 'name' format is applied to the primary identifier column to assist in clients identifying column is the resource name. See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#data-types for details.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceColumnDefinition#format
   */
  readonly format?: string;
  /**
   * jsonPath is a simple JSON path (i.e. with array notation) which is evaluated against each custom resource to produce the value for this column.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceColumnDefinition#jsonPath
   */
  readonly jsonPath: string;
  /**
   * name is a human readable name for the column.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceColumnDefinition#name
   */
  readonly name: string;
  /**
   * priority is an integer defining the relative importance of this column compared to others. Lower numbers are considered higher priority. Columns that may be omitted in limited space scenarios should be given a priority greater than 0.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceColumnDefinition#priority
   */
  readonly priority?: number;
  /**
   * type is an OpenAPI type definition for this column. See https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#data-types for details.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceColumnDefinition#type
   */
  readonly type: string;
}
/**
 * Converts an object of type 'CustomResourceColumnDefinition' to JSON representation.
 */
export declare function toJson_CustomResourceColumnDefinition(
  obj: CustomResourceColumnDefinition | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceValidation is a list of validation methods for CustomResources.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceValidation
 */
export interface CustomResourceValidation {
  /**
   * openAPIV3Schema is the OpenAPI v3 schema to use for validation and pruning.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceValidation#openAPIV3Schema
   */
  readonly openApiv3Schema?: JsonSchemaProps;
}
/**
 * Converts an object of type 'CustomResourceValidation' to JSON representation.
 */
export declare function toJson_CustomResourceValidation(
  obj: CustomResourceValidation | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceSubresources defines the status and scale subresources for CustomResources.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceSubresources
 */
export interface CustomResourceSubresources {
  /**
   * scale indicates the custom resource should serve a `/scale` subresource that returns an `autoscaling/v1` Scale object.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceSubresources#scale
   */
  readonly scale?: CustomResourceSubresourceScale;
  /**
   * status indicates the custom resource should serve a `/status` subresource. When enabled: 1. requests to the custom resource primary endpoint ignore changes to the `status` stanza of the object. 2. requests to the custom resource `/status` subresource ignore changes to anything other than the `status` stanza of the object.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceSubresources#status
   */
  readonly status?: any;
}
/**
 * Converts an object of type 'CustomResourceSubresources' to JSON representation.
 */
export declare function toJson_CustomResourceSubresources(
  obj: CustomResourceSubresources | undefined,
): Record<string, any> | undefined;
/**
 * HPAScalingPolicy is a single policy which must hold true for a specified past interval.
 *
 * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingPolicy
 */
export interface HpaScalingPolicyV2Beta2 {
  /**
   * PeriodSeconds specifies the window of time for which the policy should hold true. PeriodSeconds must be greater than zero and less than or equal to 1800 (30 min).
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingPolicy#periodSeconds
   */
  readonly periodSeconds: number;
  /**
   * Type is used to specify the scaling policy.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingPolicy#type
   */
  readonly type: string;
  /**
   * Value contains the amount of change which is permitted by the policy. It must be greater than zero
   *
   * @schema io.k8s.api.autoscaling.v2beta2.HPAScalingPolicy#value
   */
  readonly value: number;
}
/**
 * Converts an object of type 'HpaScalingPolicyV2Beta2' to JSON representation.
 */
export declare function toJson_HpaScalingPolicyV2Beta2(
  obj: HpaScalingPolicyV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * MetricTarget defines the target value, average value, or average utilization of a specific metric
 *
 * @schema io.k8s.api.autoscaling.v2beta2.MetricTarget
 */
export interface MetricTargetV2Beta2 {
  /**
   * averageUtilization is the target value of the average of the resource metric across all relevant pods, represented as a percentage of the requested value of the resource for the pods. Currently only valid for Resource metric source type
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricTarget#averageUtilization
   */
  readonly averageUtilization?: number;
  /**
   * averageValue is the target value of the average of the metric across all relevant pods (as a quantity)
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricTarget#averageValue
   */
  readonly averageValue?: Quantity;
  /**
   * type represents whether the metric type is Utilization, Value, or AverageValue
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricTarget#type
   */
  readonly type: string;
  /**
   * value is the target value of the metric (as a quantity).
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricTarget#value
   */
  readonly value?: Quantity;
}
/**
 * Converts an object of type 'MetricTargetV2Beta2' to JSON representation.
 */
export declare function toJson_MetricTargetV2Beta2(
  obj: MetricTargetV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * MetricIdentifier defines the name and optionally selector for a metric
 *
 * @schema io.k8s.api.autoscaling.v2beta2.MetricIdentifier
 */
export interface MetricIdentifierV2Beta2 {
  /**
   * name is the name of the given metric
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricIdentifier#name
   */
  readonly name: string;
  /**
   * selector is the string-encoded form of a standard kubernetes label selector for the given metric When set, it is passed as an additional parameter to the metrics server for more specific metrics scoping. When unset, just the metricName will be used to gather metrics.
   *
   * @schema io.k8s.api.autoscaling.v2beta2.MetricIdentifier#selector
   */
  readonly selector?: LabelSelector;
}
/**
 * Converts an object of type 'MetricIdentifierV2Beta2' to JSON representation.
 */
export declare function toJson_MetricIdentifierV2Beta2(
  obj: MetricIdentifierV2Beta2 | undefined,
): Record<string, any> | undefined;
/**
 * A null or empty node selector term matches no objects. The requirements of them are ANDed. The TopologySelectorTerm type implements a subset of the NodeSelectorTerm.
 *
 * @schema io.k8s.api.core.v1.NodeSelectorTerm
 */
export interface NodeSelectorTerm {
  /**
   * A list of node selector requirements by node's labels.
   *
   * @schema io.k8s.api.core.v1.NodeSelectorTerm#matchExpressions
   */
  readonly matchExpressions?: NodeSelectorRequirement[];
  /**
   * A list of node selector requirements by node's fields.
   *
   * @schema io.k8s.api.core.v1.NodeSelectorTerm#matchFields
   */
  readonly matchFields?: NodeSelectorRequirement[];
}
/**
 * Converts an object of type 'NodeSelectorTerm' to JSON representation.
 */
export declare function toJson_NodeSelectorTerm(
  obj: NodeSelectorTerm | undefined,
): Record<string, any> | undefined;
/**
 * An empty preferred scheduling term matches all objects with implicit weight 0 (i.e. it's a no-op). A null preferred scheduling term matches no objects (i.e. is also a no-op).
 *
 * @schema io.k8s.api.core.v1.PreferredSchedulingTerm
 */
export interface PreferredSchedulingTerm {
  /**
   * A node selector term, associated with the corresponding weight.
   *
   * @schema io.k8s.api.core.v1.PreferredSchedulingTerm#preference
   */
  readonly preference: NodeSelectorTerm;
  /**
   * Weight associated with matching the corresponding nodeSelectorTerm, in the range 1-100.
   *
   * @schema io.k8s.api.core.v1.PreferredSchedulingTerm#weight
   */
  readonly weight: number;
}
/**
 * Converts an object of type 'PreferredSchedulingTerm' to JSON representation.
 */
export declare function toJson_PreferredSchedulingTerm(
  obj: PreferredSchedulingTerm | undefined,
): Record<string, any> | undefined;
/**
 * The weights of all of the matched WeightedPodAffinityTerm fields are added per-node to find the most preferred node(s)
 *
 * @schema io.k8s.api.core.v1.WeightedPodAffinityTerm
 */
export interface WeightedPodAffinityTerm {
  /**
   * Required. A pod affinity term, associated with the corresponding weight.
   *
   * @schema io.k8s.api.core.v1.WeightedPodAffinityTerm#podAffinityTerm
   */
  readonly podAffinityTerm: PodAffinityTerm;
  /**
   * weight associated with matching the corresponding podAffinityTerm, in the range 1-100.
   *
   * @schema io.k8s.api.core.v1.WeightedPodAffinityTerm#weight
   */
  readonly weight: number;
}
/**
 * Converts an object of type 'WeightedPodAffinityTerm' to JSON representation.
 */
export declare function toJson_WeightedPodAffinityTerm(
  obj: WeightedPodAffinityTerm | undefined,
): Record<string, any> | undefined;
/**
 * Defines a set of pods (namely those matching the labelSelector relative to the given namespace(s)) that this pod should be co-located (affinity) or not co-located (anti-affinity) with, where co-located is defined as running on a node whose value of the label with key <topologyKey> matches that of any node on which a pod of the set of pods is running
 *
 * @schema io.k8s.api.core.v1.PodAffinityTerm
 */
export interface PodAffinityTerm {
  /**
   * A label query over a set of resources, in this case pods.
   *
   * @schema io.k8s.api.core.v1.PodAffinityTerm#labelSelector
   */
  readonly labelSelector?: LabelSelector;
  /**
   * A label query over the set of namespaces that the term applies to. The term is applied to the union of the namespaces selected by this field and the ones listed in the namespaces field. null selector and null or empty namespaces list means "this pod's namespace". An empty selector ({}) matches all namespaces. This field is beta-level and is only honored when PodAffinityNamespaceSelector feature is enabled.
   *
   * @schema io.k8s.api.core.v1.PodAffinityTerm#namespaceSelector
   */
  readonly namespaceSelector?: LabelSelector;
  /**
   * namespaces specifies a static list of namespace names that the term applies to. The term is applied to the union of the namespaces listed in this field and the ones selected by namespaceSelector. null or empty namespaces list and null namespaceSelector means "this pod's namespace"
   *
   * @schema io.k8s.api.core.v1.PodAffinityTerm#namespaces
   */
  readonly namespaces?: string[];
  /**
   * This pod should be co-located (affinity) or not co-located (anti-affinity) with the pods matching the labelSelector in the specified namespaces, where co-located is defined as running on a node whose value of the label with key topologyKey matches that of any node on which any of the selected pods is running. Empty topologyKey is not allowed.
   *
   * @schema io.k8s.api.core.v1.PodAffinityTerm#topologyKey
   */
  readonly topologyKey: string;
}
/**
 * Converts an object of type 'PodAffinityTerm' to JSON representation.
 */
export declare function toJson_PodAffinityTerm(
  obj: PodAffinityTerm | undefined,
): Record<string, any> | undefined;
/**
 * EnvVarSource represents a source for the value of an EnvVar.
 *
 * @schema io.k8s.api.core.v1.EnvVarSource
 */
export interface EnvVarSource {
  /**
   * Selects a key of a ConfigMap.
   *
   * @schema io.k8s.api.core.v1.EnvVarSource#configMapKeyRef
   */
  readonly configMapKeyRef?: ConfigMapKeySelector;
  /**
   * Selects a field of the pod: supports metadata.name, metadata.namespace, `metadata.labels['<KEY>']`, `metadata.annotations['<KEY>']`, spec.nodeName, spec.serviceAccountName, status.hostIP, status.podIP, status.podIPs.
   *
   * @schema io.k8s.api.core.v1.EnvVarSource#fieldRef
   */
  readonly fieldRef?: ObjectFieldSelector;
  /**
   * Selects a resource of the container: only resources limits and requests (limits.cpu, limits.memory, limits.ephemeral-storage, requests.cpu, requests.memory and requests.ephemeral-storage) are currently supported.
   *
   * @schema io.k8s.api.core.v1.EnvVarSource#resourceFieldRef
   */
  readonly resourceFieldRef?: ResourceFieldSelector;
  /**
   * Selects a key of a secret in the pod's namespace
   *
   * @schema io.k8s.api.core.v1.EnvVarSource#secretKeyRef
   */
  readonly secretKeyRef?: SecretKeySelector;
}
/**
 * Converts an object of type 'EnvVarSource' to JSON representation.
 */
export declare function toJson_EnvVarSource(
  obj: EnvVarSource | undefined,
): Record<string, any> | undefined;
/**
 * ConfigMapEnvSource selects a ConfigMap to populate the environment variables with.
 *
 * The contents of the target ConfigMap's Data field will represent the key-value pairs as environment variables.
 *
 * @schema io.k8s.api.core.v1.ConfigMapEnvSource
 */
export interface ConfigMapEnvSource {
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.ConfigMapEnvSource#name
   */
  readonly name?: string;
  /**
   * Specify whether the ConfigMap must be defined
   *
   * @schema io.k8s.api.core.v1.ConfigMapEnvSource#optional
   */
  readonly optional?: boolean;
}
/**
 * Converts an object of type 'ConfigMapEnvSource' to JSON representation.
 */
export declare function toJson_ConfigMapEnvSource(
  obj: ConfigMapEnvSource | undefined,
): Record<string, any> | undefined;
/**
 * SecretEnvSource selects a Secret to populate the environment variables with.
 *
 * The contents of the target Secret's Data field will represent the key-value pairs as environment variables.
 *
 * @schema io.k8s.api.core.v1.SecretEnvSource
 */
export interface SecretEnvSource {
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.SecretEnvSource#name
   */
  readonly name?: string;
  /**
   * Specify whether the Secret must be defined
   *
   * @schema io.k8s.api.core.v1.SecretEnvSource#optional
   */
  readonly optional?: boolean;
}
/**
 * Converts an object of type 'SecretEnvSource' to JSON representation.
 */
export declare function toJson_SecretEnvSource(
  obj: SecretEnvSource | undefined,
): Record<string, any> | undefined;
/**
 * Handler defines a specific action that should be taken
 *
 * @schema io.k8s.api.core.v1.Handler
 */
export interface Handler {
  /**
   * One and only one of the following should be specified. Exec specifies the action to take.
   *
   * @schema io.k8s.api.core.v1.Handler#exec
   */
  readonly exec?: ExecAction;
  /**
   * HTTPGet specifies the http request to perform.
   *
   * @schema io.k8s.api.core.v1.Handler#httpGet
   */
  readonly httpGet?: HttpGetAction;
  /**
   * TCPSocket specifies an action involving a TCP port. TCP hooks not yet supported
   *
   * @schema io.k8s.api.core.v1.Handler#tcpSocket
   */
  readonly tcpSocket?: TcpSocketAction;
}
/**
 * Converts an object of type 'Handler' to JSON representation.
 */
export declare function toJson_Handler(
  obj: Handler | undefined,
): Record<string, any> | undefined;
/**
 * ExecAction describes a "run in container" action.
 *
 * @schema io.k8s.api.core.v1.ExecAction
 */
export interface ExecAction {
  /**
   * Command is the command line to execute inside the container, the working directory for the command  is root ('/') in the container's filesystem. The command is simply exec'd, it is not run inside a shell, so traditional shell instructions ('|', etc) won't work. To use a shell, you need to explicitly call out to that shell. Exit status of 0 is treated as live/healthy and non-zero is unhealthy.
   *
   * @schema io.k8s.api.core.v1.ExecAction#command
   */
  readonly command?: string[];
}
/**
 * Converts an object of type 'ExecAction' to JSON representation.
 */
export declare function toJson_ExecAction(
  obj: ExecAction | undefined,
): Record<string, any> | undefined;
/**
 * HTTPGetAction describes an action based on HTTP Get requests.
 *
 * @schema io.k8s.api.core.v1.HTTPGetAction
 */
export interface HttpGetAction {
  /**
   * Host name to connect to, defaults to the pod IP. You probably want to set "Host" in httpHeaders instead.
   *
   * @schema io.k8s.api.core.v1.HTTPGetAction#host
   */
  readonly host?: string;
  /**
   * Custom headers to set in the request. HTTP allows repeated headers.
   *
   * @schema io.k8s.api.core.v1.HTTPGetAction#httpHeaders
   */
  readonly httpHeaders?: HttpHeader[];
  /**
   * Path to access on the HTTP server.
   *
   * @schema io.k8s.api.core.v1.HTTPGetAction#path
   */
  readonly path?: string;
  /**
   * Name or number of the port to access on the container. Number must be in the range 1 to 65535. Name must be an IANA_SVC_NAME.
   *
   * @schema io.k8s.api.core.v1.HTTPGetAction#port
   */
  readonly port: IntOrString;
  /**
   * Scheme to use for connecting to the host. Defaults to HTTP.
   *
   * @default HTTP.
   * @schema io.k8s.api.core.v1.HTTPGetAction#scheme
   */
  readonly scheme?: string;
}
/**
 * Converts an object of type 'HttpGetAction' to JSON representation.
 */
export declare function toJson_HttpGetAction(
  obj: HttpGetAction | undefined,
): Record<string, any> | undefined;
/**
 * TCPSocketAction describes an action based on opening a socket
 *
 * @schema io.k8s.api.core.v1.TCPSocketAction
 */
export interface TcpSocketAction {
  /**
   * Optional: Host name to connect to, defaults to the pod IP.
   *
   * @schema io.k8s.api.core.v1.TCPSocketAction#host
   */
  readonly host?: string;
  /**
   * Number or name of the port to access on the container. Number must be in the range 1 to 65535. Name must be an IANA_SVC_NAME.
   *
   * @schema io.k8s.api.core.v1.TCPSocketAction#port
   */
  readonly port: IntOrString;
}
/**
 * Converts an object of type 'TcpSocketAction' to JSON representation.
 */
export declare function toJson_TcpSocketAction(
  obj: TcpSocketAction | undefined,
): Record<string, any> | undefined;
/**
 * Adds and removes POSIX capabilities from running containers.
 *
 * @schema io.k8s.api.core.v1.Capabilities
 */
export interface Capabilities {
  /**
   * Added capabilities
   *
   * @schema io.k8s.api.core.v1.Capabilities#add
   */
  readonly add?: string[];
  /**
   * Removed capabilities
   *
   * @schema io.k8s.api.core.v1.Capabilities#drop
   */
  readonly drop?: string[];
}
/**
 * Converts an object of type 'Capabilities' to JSON representation.
 */
export declare function toJson_Capabilities(
  obj: Capabilities | undefined,
): Record<string, any> | undefined;
/**
 * Maps a string key to a path within a volume.
 *
 * @schema io.k8s.api.core.v1.KeyToPath
 */
export interface KeyToPath {
  /**
   * The key to project.
   *
   * @schema io.k8s.api.core.v1.KeyToPath#key
   */
  readonly key: string;
  /**
   * Optional: mode bits used to set permissions on this file. Must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   *
   * @schema io.k8s.api.core.v1.KeyToPath#mode
   */
  readonly mode?: number;
  /**
   * The relative path of the file to map the key to. May not be an absolute path. May not contain the path element '..'. May not start with the string '..'.
   *
   * @schema io.k8s.api.core.v1.KeyToPath#path
   */
  readonly path: string;
}
/**
 * Converts an object of type 'KeyToPath' to JSON representation.
 */
export declare function toJson_KeyToPath(
  obj: KeyToPath | undefined,
): Record<string, any> | undefined;
/**
 * DownwardAPIVolumeFile represents information to create the file containing the pod field
 *
 * @schema io.k8s.api.core.v1.DownwardAPIVolumeFile
 */
export interface DownwardApiVolumeFile {
  /**
   * Required: Selects a field of the pod: only annotations, labels, name and namespace are supported.
   *
   * @schema io.k8s.api.core.v1.DownwardAPIVolumeFile#fieldRef
   */
  readonly fieldRef?: ObjectFieldSelector;
  /**
   * Optional: mode bits used to set permissions on this file, must be an octal value between 0000 and 0777 or a decimal value between 0 and 511. YAML accepts both octal and decimal values, JSON requires decimal values for mode bits. If not specified, the volume defaultMode will be used. This might be in conflict with other options that affect the file mode, like fsGroup, and the result can be other mode bits set.
   *
   * @schema io.k8s.api.core.v1.DownwardAPIVolumeFile#mode
   */
  readonly mode?: number;
  /**
   * Required: Path is  the relative path name of the file to be created. Must not be absolute or contain the '..' path. Must be utf-8 encoded. The first item of the relative path must not start with '..'
   *
   * @schema io.k8s.api.core.v1.DownwardAPIVolumeFile#path
   */
  readonly path: string;
  /**
   * Selects a resource of the container: only resources limits and requests (limits.cpu, limits.memory, requests.cpu and requests.memory) are currently supported.
   *
   * @schema io.k8s.api.core.v1.DownwardAPIVolumeFile#resourceFieldRef
   */
  readonly resourceFieldRef?: ResourceFieldSelector;
}
/**
 * Converts an object of type 'DownwardApiVolumeFile' to JSON representation.
 */
export declare function toJson_DownwardApiVolumeFile(
  obj: DownwardApiVolumeFile | undefined,
): Record<string, any> | undefined;
/**
 * PersistentVolumeClaimTemplate is used to produce PersistentVolumeClaim objects as part of an EphemeralVolumeSource.
 *
 * @schema io.k8s.api.core.v1.PersistentVolumeClaimTemplate
 */
export interface PersistentVolumeClaimTemplate {
  /**
   * May contain labels and annotations that will be copied into the PVC when creating it. No other fields are allowed and will be rejected during validation.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimTemplate#metadata
   */
  readonly metadata?: ObjectMeta;
  /**
   * The specification for the PersistentVolumeClaim. The entire content is copied unchanged into the PVC that gets created from this template. The same fields as in a PersistentVolumeClaim are also valid here.
   *
   * @schema io.k8s.api.core.v1.PersistentVolumeClaimTemplate#spec
   */
  readonly spec: PersistentVolumeClaimSpec;
}
/**
 * Converts an object of type 'PersistentVolumeClaimTemplate' to JSON representation.
 */
export declare function toJson_PersistentVolumeClaimTemplate(
  obj: PersistentVolumeClaimTemplate | undefined,
): Record<string, any> | undefined;
/**
 * Projection that may be projected along with other supported volume types
 *
 * @schema io.k8s.api.core.v1.VolumeProjection
 */
export interface VolumeProjection {
  /**
   * information about the configMap data to project
   *
   * @schema io.k8s.api.core.v1.VolumeProjection#configMap
   */
  readonly configMap?: ConfigMapProjection;
  /**
   * information about the downwardAPI data to project
   *
   * @schema io.k8s.api.core.v1.VolumeProjection#downwardAPI
   */
  readonly downwardApi?: DownwardApiProjection;
  /**
   * information about the secret data to project
   *
   * @schema io.k8s.api.core.v1.VolumeProjection#secret
   */
  readonly secret?: SecretProjection;
  /**
   * information about the serviceAccountToken data to project
   *
   * @schema io.k8s.api.core.v1.VolumeProjection#serviceAccountToken
   */
  readonly serviceAccountToken?: ServiceAccountTokenProjection;
}
/**
 * Converts an object of type 'VolumeProjection' to JSON representation.
 */
export declare function toJson_VolumeProjection(
  obj: VolumeProjection | undefined,
): Record<string, any> | undefined;
/**
 * GroupSubject holds detailed information for group-kind subject.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.GroupSubject
 */
export interface GroupSubjectV1Beta1 {
  /**
   * name is the user group that matches, or "*" to match all user groups. See https://github.com/kubernetes/apiserver/blob/master/pkg/authentication/user/user.go for some well-known group names. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.GroupSubject#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'GroupSubjectV1Beta1' to JSON representation.
 */
export declare function toJson_GroupSubjectV1Beta1(
  obj: GroupSubjectV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * ServiceAccountSubject holds detailed information for service-account-kind subject.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.ServiceAccountSubject
 */
export interface ServiceAccountSubjectV1Beta1 {
  /**
   * `name` is the name of matching ServiceAccount objects, or "*" to match regardless of name. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.ServiceAccountSubject#name
   */
  readonly name: string;
  /**
   * `namespace` is the namespace of matching ServiceAccount objects. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.ServiceAccountSubject#namespace
   */
  readonly namespace: string;
}
/**
 * Converts an object of type 'ServiceAccountSubjectV1Beta1' to JSON representation.
 */
export declare function toJson_ServiceAccountSubjectV1Beta1(
  obj: ServiceAccountSubjectV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * UserSubject holds detailed information for user-kind subject.
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.UserSubject
 */
export interface UserSubjectV1Beta1 {
  /**
   * `name` is the username that matches, or "*" to match all usernames. Required.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.UserSubject#name
   */
  readonly name: string;
}
/**
 * Converts an object of type 'UserSubjectV1Beta1' to JSON representation.
 */
export declare function toJson_UserSubjectV1Beta1(
  obj: UserSubjectV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * QueuingConfiguration holds the configuration parameters for queuing
 *
 * @schema io.k8s.api.flowcontrol.v1beta1.QueuingConfiguration
 */
export interface QueuingConfigurationV1Beta1 {
  /**
   * `handSize` is a small positive number that configures the shuffle sharding of requests into queues.  When enqueuing a request at this priority level the request's flow identifier (a string pair) is hashed and the hash value is used to shuffle the list of queues and deal a hand of the size specified here.  The request is put into one of the shortest queues in that hand. `handSize` must be no larger than `queues`, and should be significantly smaller (so that a few heavy flows do not saturate most of the queues).  See the user-facing documentation for more extensive guidance on setting this field.  This field has a default value of 8.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.QueuingConfiguration#handSize
   */
  readonly handSize?: number;
  /**
   * `queueLengthLimit` is the maximum number of requests allowed to be waiting in a given queue of this priority level at a time; excess requests are rejected.  This value must be positive.  If not specified, it will be defaulted to 50.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.QueuingConfiguration#queueLengthLimit
   */
  readonly queueLengthLimit?: number;
  /**
   * `queues` is the number of queues for this priority level. The queues exist independently at each apiserver. The value must be positive.  Setting it to 1 effectively precludes shufflesharding and thus makes the distinguisher method of associated flow schemas irrelevant.  This field has a default value of 64.
   *
   * @schema io.k8s.api.flowcontrol.v1beta1.QueuingConfiguration#queues
   */
  readonly queues?: number;
}
/**
 * Converts an object of type 'QueuingConfigurationV1Beta1' to JSON representation.
 */
export declare function toJson_QueuingConfigurationV1Beta1(
  obj: QueuingConfigurationV1Beta1 | undefined,
): Record<string, any> | undefined;
/**
 * ServiceBackendPort is the service port being referenced.
 *
 * @schema io.k8s.api.networking.v1.ServiceBackendPort
 */
export interface ServiceBackendPort {
  /**
   * Name is the name of the port on the Service. This is a mutually exclusive setting with "Number".
   *
   * @schema io.k8s.api.networking.v1.ServiceBackendPort#name
   */
  readonly name?: string;
  /**
   * Number is the numerical port number (e.g. 80) on the Service. This is a mutually exclusive setting with "Name".
   *
   * @schema io.k8s.api.networking.v1.ServiceBackendPort#number
   */
  readonly number?: number;
}
/**
 * Converts an object of type 'ServiceBackendPort' to JSON representation.
 */
export declare function toJson_ServiceBackendPort(
  obj: ServiceBackendPort | undefined,
): Record<string, any> | undefined;
/**
 * HTTPIngressPath associates a path with a backend. Incoming urls matching the path are forwarded to the backend.
 *
 * @schema io.k8s.api.networking.v1.HTTPIngressPath
 */
export interface HttpIngressPath {
  /**
   * Backend defines the referenced service endpoint to which the traffic will be forwarded to.
   *
   * @schema io.k8s.api.networking.v1.HTTPIngressPath#backend
   */
  readonly backend: IngressBackend;
  /**
   * Path is matched against the path of an incoming request. Currently it can contain characters disallowed from the conventional "path" part of a URL as defined by RFC 3986. Paths must begin with a '/' and must be present when using PathType with value "Exact" or "Prefix".
   *
   * @schema io.k8s.api.networking.v1.HTTPIngressPath#path
   */
  readonly path?: string;
  /**
   * PathType determines the interpretation of the Path matching. PathType can be one of the following values: * Exact: Matches the URL path exactly. * Prefix: Matches based on a URL path prefix split by '/'. Matching is
   * done on a path element by element basis. A path element refers is the
   * list of labels in the path split by the '/' separator. A request is a
   * match for path p if every p is an element-wise prefix of p of the
   * request path. Note that if the last element of the path is a substring
   * of the last element in request path, it is not a match (e.g. /foo/bar
   * matches /foo/bar/baz, but does not match /foo/barbaz).
   * * ImplementationSpecific: Interpretation of the Path matching is up to
   * the IngressClass. Implementations can treat this as a separate PathType
   * or treat it identically to Prefix or Exact path types.
   * Implementations are required to support all path types.
   *
   * @schema io.k8s.api.networking.v1.HTTPIngressPath#pathType
   */
  readonly pathType: string;
}
/**
 * Converts an object of type 'HttpIngressPath' to JSON representation.
 */
export declare function toJson_HttpIngressPath(
  obj: HttpIngressPath | undefined,
): Record<string, any> | undefined;
/**
 * IPBlock describes a particular CIDR (Ex. "192.168.1.1/24","2001:db9::/64") that is allowed to the pods matched by a NetworkPolicySpec's podSelector. The except entry describes CIDRs that should not be included within this rule.
 *
 * @schema io.k8s.api.networking.v1.IPBlock
 */
export interface IpBlock {
  /**
   * CIDR is a string representing the IP Block Valid examples are "192.168.1.1/24" or "2001:db9::/64"
   *
   * @schema io.k8s.api.networking.v1.IPBlock#cidr
   */
  readonly cidr: string;
  /**
   * Except is a slice of CIDRs that should not be included within an IP Block Valid examples are "192.168.1.1/24" or "2001:db9::/64" Except values will be rejected if they are outside the CIDR range
   *
   * @schema io.k8s.api.networking.v1.IPBlock#except
   */
  readonly except?: string[];
}
/**
 * Converts an object of type 'IpBlock' to JSON representation.
 */
export declare function toJson_IpBlock(
  obj: IpBlock | undefined,
): Record<string, any> | undefined;
/**
 * JSONSchemaProps is a JSON-Schema following Specification Draft 4 (http://json-schema.org/).
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps
 */
export interface JsonSchemaProps {
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#$ref
   */
  readonly ref?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#$schema
   */
  readonly schema?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#additionalItems
   */
  readonly additionalItems?: any;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#additionalProperties
   */
  readonly additionalProperties?: any;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#allOf
   */
  readonly allOf?: JsonSchemaProps[];
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#anyOf
   */
  readonly anyOf?: JsonSchemaProps[];
  /**
   * default is a default value for undefined object fields. Defaulting is a beta feature under the CustomResourceDefaulting feature gate. Defaulting requires spec.preserveUnknownFields to be false.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#default
   */
  readonly default?: any;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#definitions
   */
  readonly definitions?: {
    [key: string]: JsonSchemaProps;
  };
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#dependencies
   */
  readonly dependencies?: {
    [key: string]: any;
  };
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#description
   */
  readonly description?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#enum
   */
  readonly enum?: any[];
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#example
   */
  readonly example?: any;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#exclusiveMaximum
   */
  readonly exclusiveMaximum?: boolean;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#exclusiveMinimum
   */
  readonly exclusiveMinimum?: boolean;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#externalDocs
   */
  readonly externalDocs?: ExternalDocumentation;
  /**
   * format is an OpenAPI v3 format string. Unknown formats are ignored. The following formats are validated:
   *
   * - bsonobjectid: a bson object ID, i.e. a 24 characters hex string - uri: an URI as parsed by Golang net/url.ParseRequestURI - email: an email address as parsed by Golang net/mail.ParseAddress - hostname: a valid representation for an Internet host name, as defined by RFC 1034, section 3.1 [RFC1034]. - ipv4: an IPv4 IP as parsed by Golang net.ParseIP - ipv6: an IPv6 IP as parsed by Golang net.ParseIP - cidr: a CIDR as parsed by Golang net.ParseCIDR - mac: a MAC address as parsed by Golang net.ParseMAC - uuid: an UUID that allows uppercase defined by the regex (?i)^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$ - uuid3: an UUID3 that allows uppercase defined by the regex (?i)^[0-9a-f]{8}-?[0-9a-f]{4}-?3[0-9a-f]{3}-?[0-9a-f]{4}-?[0-9a-f]{12}$ - uuid4: an UUID4 that allows uppercase defined by the regex (?i)^[0-9a-f]{8}-?[0-9a-f]{4}-?4[0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$ - uuid5: an UUID5 that allows uppercase defined by the regex (?i)^[0-9a-f]{8}-?[0-9a-f]{4}-?5[0-9a-f]{3}-?[89ab][0-9a-f]{3}-?[0-9a-f]{12}$ - isbn: an ISBN10 or ISBN13 number string like "0321751043" or "978-0321751041" - isbn10: an ISBN10 number string like "0321751043" - isbn13: an ISBN13 number string like "978-0321751041" - creditcard: a credit card number defined by the regex ^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$ with any non digit characters mixed in - ssn: a U.S. social security number following the regex ^\d{3}[- ]?\d{2}[- ]?\d{4}$ - hexcolor: an hexadecimal color code like "#FFFFFF: following the regex ^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$ - rgbcolor: an RGB color code like rgb like "rgb(255,255,2559" - byte: base64 encoded binary data - password: any kind of string - date: a date string like "2006-01-02" as defined by full-date in RFC3339 - duration: a duration string like "22 ns" as parsed by Golang time.ParseDuration or compatible with Scala duration format - datetime: a date time string like "2014-12-15T19:30:20.000Z" as defined by date-time in RFC3339.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#format
   */
  readonly format?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#id
   */
  readonly id?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#items
   */
  readonly items?: any;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#maxItems
   */
  readonly maxItems?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#maxLength
   */
  readonly maxLength?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#maxProperties
   */
  readonly maxProperties?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#maximum
   */
  readonly maximum?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#minItems
   */
  readonly minItems?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#minLength
   */
  readonly minLength?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#minProperties
   */
  readonly minProperties?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#minimum
   */
  readonly minimum?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#multipleOf
   */
  readonly multipleOf?: number;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#not
   */
  readonly not?: JsonSchemaProps;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#nullable
   */
  readonly nullable?: boolean;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#oneOf
   */
  readonly oneOf?: JsonSchemaProps[];
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#pattern
   */
  readonly pattern?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#patternProperties
   */
  readonly patternProperties?: {
    [key: string]: JsonSchemaProps;
  };
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#properties
   */
  readonly properties?: {
    [key: string]: JsonSchemaProps;
  };
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#required
   */
  readonly required?: string[];
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#title
   */
  readonly title?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#type
   */
  readonly type?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#uniqueItems
   */
  readonly uniqueItems?: boolean;
  /**
   * x-kubernetes-embedded-resource defines that the value is an embedded Kubernetes runtime.Object, with TypeMeta and ObjectMeta. The type must be object. It is allowed to further restrict the embedded object. kind, apiVersion and metadata are validated automatically. x-kubernetes-preserve-unknown-fields is allowed to be true, but does not have to be if the object is fully specified (up to kind, apiVersion, metadata).
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#x-kubernetes-embedded-resource
   */
  readonly xKubernetesEmbeddedResource?: boolean;
  /**
   * x-kubernetes-int-or-string specifies that this value is either an integer or a string. If this is true, an empty type is allowed and type as child of anyOf is permitted if following one of the following patterns:
   *
   * 1) anyOf:
   * - type: integer
   * - type: string
   * 2) allOf:
   * - anyOf:
   * - type: integer
   * - type: string
   * - ... zero or more
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#x-kubernetes-int-or-string
   */
  readonly xKubernetesIntOrString?: boolean;
  /**
   * x-kubernetes-list-map-keys annotates an array with the x-kubernetes-list-type `map` by specifying the keys used as the index of the map.
   *
   * This tag MUST only be used on lists that have the "x-kubernetes-list-type" extension set to "map". Also, the values specified for this attribute must be a scalar typed field of the child structure (no nesting is supported).
   *
   * The properties specified must either be required or have a default value, to ensure those properties are present for all list items.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#x-kubernetes-list-map-keys
   */
  readonly xKubernetesListMapKeys?: string[];
  /**
   * x-kubernetes-list-type annotates an array to further describe its topology. This extension must only be used on lists and may have 3 possible values:
   *
   * 1) `atomic`: the list is treated as a single entity, like a scalar.
   * Atomic lists will be entirely replaced when updated. This extension
   * may be used on any type of list (struct, scalar, ...).
   * 2) `set`:
   * Sets are lists that must not have multiple items with the same value. Each
   * value must be a scalar, an object with x-kubernetes-map-type `atomic` or an
   * array with x-kubernetes-list-type `atomic`.
   * 3) `map`:
   * These lists are like maps in that their elements have a non-index key
   * used to identify them. Order is preserved upon merge. The map tag
   * must only be used on a list with elements of type object.
   * Defaults to atomic for arrays.
   *
   * @default atomic for arrays.
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#x-kubernetes-list-type
   */
  readonly xKubernetesListType?: string;
  /**
   * x-kubernetes-map-type annotates an object to further describe its topology. This extension must only be used when type is object and may have 2 possible values:
   *
   * 1) `granular`:
   * These maps are actual maps (key-value pairs) and each fields are independent
   * from each other (they can each be manipulated by separate actors). This is
   * the default behaviour for all maps.
   * 2) `atomic`: the list is treated as a single entity, like a scalar.
   * Atomic maps will be entirely replaced when updated.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#x-kubernetes-map-type
   */
  readonly xKubernetesMapType?: string;
  /**
   * x-kubernetes-preserve-unknown-fields stops the API server decoding step from pruning fields which are not specified in the validation schema. This affects fields recursively, but switches back to normal pruning behaviour if nested properties or additionalProperties are specified in the schema. This can either be true or undefined. False is forbidden.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.JSONSchemaProps#x-kubernetes-preserve-unknown-fields
   */
  readonly xKubernetesPreserveUnknownFields?: boolean;
}
/**
 * Converts an object of type 'JsonSchemaProps' to JSON representation.
 */
export declare function toJson_JsonSchemaProps(
  obj: JsonSchemaProps | undefined,
): Record<string, any> | undefined;
/**
 * CustomResourceSubresourceScale defines how to serve the scale subresource for CustomResources.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceSubresourceScale
 */
export interface CustomResourceSubresourceScale {
  /**
   * labelSelectorPath defines the JSON path inside of a custom resource that corresponds to Scale `status.selector`. Only JSON paths without the array notation are allowed. Must be a JSON Path under `.status` or `.spec`. Must be set to work with HorizontalPodAutoscaler. The field pointed by this JSON path must be a string field (not a complex selector struct) which contains a serialized label selector in string form. More info: https://kubernetes.io/docs/tasks/access-kubernetes-api/custom-resources/custom-resource-definitions#scale-subresource If there is no value under the given path in the custom resource, the `status.selector` value in the `/scale` subresource will default to the empty string.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceSubresourceScale#labelSelectorPath
   */
  readonly labelSelectorPath?: string;
  /**
   * specReplicasPath defines the JSON path inside of a custom resource that corresponds to Scale `spec.replicas`. Only JSON paths without the array notation are allowed. Must be a JSON Path under `.spec`. If there is no value under the given path in the custom resource, the `/scale` subresource will return an error on GET.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceSubresourceScale#specReplicasPath
   */
  readonly specReplicasPath: string;
  /**
   * statusReplicasPath defines the JSON path inside of a custom resource that corresponds to Scale `status.replicas`. Only JSON paths without the array notation are allowed. Must be a JSON Path under `.status`. If there is no value under the given path in the custom resource, the `status.replicas` value in the `/scale` subresource will default to 0.
   *
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.CustomResourceSubresourceScale#statusReplicasPath
   */
  readonly statusReplicasPath: string;
}
/**
 * Converts an object of type 'CustomResourceSubresourceScale' to JSON representation.
 */
export declare function toJson_CustomResourceSubresourceScale(
  obj: CustomResourceSubresourceScale | undefined,
): Record<string, any> | undefined;
/**
 * A node selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
 *
 * @schema io.k8s.api.core.v1.NodeSelectorRequirement
 */
export interface NodeSelectorRequirement {
  /**
   * The label key that the selector applies to.
   *
   * @schema io.k8s.api.core.v1.NodeSelectorRequirement#key
   */
  readonly key: string;
  /**
   * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
   *
   * @schema io.k8s.api.core.v1.NodeSelectorRequirement#operator
   */
  readonly operator: string;
  /**
   * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
   *
   * @schema io.k8s.api.core.v1.NodeSelectorRequirement#values
   */
  readonly values?: string[];
}
/**
 * Converts an object of type 'NodeSelectorRequirement' to JSON representation.
 */
export declare function toJson_NodeSelectorRequirement(
  obj: NodeSelectorRequirement | undefined,
): Record<string, any> | undefined;
/**
 * Selects a key from a ConfigMap.
 *
 * @schema io.k8s.api.core.v1.ConfigMapKeySelector
 */
export interface ConfigMapKeySelector {
  /**
   * The key to select.
   *
   * @schema io.k8s.api.core.v1.ConfigMapKeySelector#key
   */
  readonly key: string;
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.ConfigMapKeySelector#name
   */
  readonly name?: string;
  /**
   * Specify whether the ConfigMap or its key must be defined
   *
   * @schema io.k8s.api.core.v1.ConfigMapKeySelector#optional
   */
  readonly optional?: boolean;
}
/**
 * Converts an object of type 'ConfigMapKeySelector' to JSON representation.
 */
export declare function toJson_ConfigMapKeySelector(
  obj: ConfigMapKeySelector | undefined,
): Record<string, any> | undefined;
/**
 * ObjectFieldSelector selects an APIVersioned field of an object.
 *
 * @schema io.k8s.api.core.v1.ObjectFieldSelector
 */
export interface ObjectFieldSelector {
  /**
   * Version of the schema the FieldPath is written in terms of, defaults to "v1".
   *
   * @schema io.k8s.api.core.v1.ObjectFieldSelector#apiVersion
   */
  readonly apiVersion?: string;
  /**
   * Path of the field to select in the specified API version.
   *
   * @schema io.k8s.api.core.v1.ObjectFieldSelector#fieldPath
   */
  readonly fieldPath: string;
}
/**
 * Converts an object of type 'ObjectFieldSelector' to JSON representation.
 */
export declare function toJson_ObjectFieldSelector(
  obj: ObjectFieldSelector | undefined,
): Record<string, any> | undefined;
/**
 * ResourceFieldSelector represents container resources (cpu, memory) and their output format
 *
 * @schema io.k8s.api.core.v1.ResourceFieldSelector
 */
export interface ResourceFieldSelector {
  /**
   * Container name: required for volumes, optional for env vars
   *
   * @schema io.k8s.api.core.v1.ResourceFieldSelector#containerName
   */
  readonly containerName?: string;
  /**
   * Specifies the output format of the exposed resources, defaults to "1"
   *
   * @schema io.k8s.api.core.v1.ResourceFieldSelector#divisor
   */
  readonly divisor?: Quantity;
  /**
   * Required: resource to select
   *
   * @schema io.k8s.api.core.v1.ResourceFieldSelector#resource
   */
  readonly resource: string;
}
/**
 * Converts an object of type 'ResourceFieldSelector' to JSON representation.
 */
export declare function toJson_ResourceFieldSelector(
  obj: ResourceFieldSelector | undefined,
): Record<string, any> | undefined;
/**
 * SecretKeySelector selects a key of a Secret.
 *
 * @schema io.k8s.api.core.v1.SecretKeySelector
 */
export interface SecretKeySelector {
  /**
   * The key of the secret to select from.  Must be a valid secret key.
   *
   * @schema io.k8s.api.core.v1.SecretKeySelector#key
   */
  readonly key: string;
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.SecretKeySelector#name
   */
  readonly name?: string;
  /**
   * Specify whether the Secret or its key must be defined
   *
   * @schema io.k8s.api.core.v1.SecretKeySelector#optional
   */
  readonly optional?: boolean;
}
/**
 * Converts an object of type 'SecretKeySelector' to JSON representation.
 */
export declare function toJson_SecretKeySelector(
  obj: SecretKeySelector | undefined,
): Record<string, any> | undefined;
/**
 * HTTPHeader describes a custom header to be used in HTTP probes
 *
 * @schema io.k8s.api.core.v1.HTTPHeader
 */
export interface HttpHeader {
  /**
   * The header field name
   *
   * @schema io.k8s.api.core.v1.HTTPHeader#name
   */
  readonly name: string;
  /**
   * The header field value
   *
   * @schema io.k8s.api.core.v1.HTTPHeader#value
   */
  readonly value: string;
}
/**
 * Converts an object of type 'HttpHeader' to JSON representation.
 */
export declare function toJson_HttpHeader(
  obj: HttpHeader | undefined,
): Record<string, any> | undefined;
/**
 * Adapts a ConfigMap into a projected volume.
 *
 * The contents of the target ConfigMap's Data field will be presented in a projected volume as files using the keys in the Data field as the file names, unless the items element is populated with specific mappings of keys to paths. Note that this is identical to a configmap volume source without the default mode.
 *
 * @schema io.k8s.api.core.v1.ConfigMapProjection
 */
export interface ConfigMapProjection {
  /**
   * If unspecified, each key-value pair in the Data field of the referenced ConfigMap will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the ConfigMap, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
   *
   * @schema io.k8s.api.core.v1.ConfigMapProjection#items
   */
  readonly items?: KeyToPath[];
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.ConfigMapProjection#name
   */
  readonly name?: string;
  /**
   * Specify whether the ConfigMap or its keys must be defined
   *
   * @schema io.k8s.api.core.v1.ConfigMapProjection#optional
   */
  readonly optional?: boolean;
}
/**
 * Converts an object of type 'ConfigMapProjection' to JSON representation.
 */
export declare function toJson_ConfigMapProjection(
  obj: ConfigMapProjection | undefined,
): Record<string, any> | undefined;
/**
 * Represents downward API info for projecting into a projected volume. Note that this is identical to a downwardAPI volume source without the default mode.
 *
 * @schema io.k8s.api.core.v1.DownwardAPIProjection
 */
export interface DownwardApiProjection {
  /**
   * Items is a list of DownwardAPIVolume file
   *
   * @schema io.k8s.api.core.v1.DownwardAPIProjection#items
   */
  readonly items?: DownwardApiVolumeFile[];
}
/**
 * Converts an object of type 'DownwardApiProjection' to JSON representation.
 */
export declare function toJson_DownwardApiProjection(
  obj: DownwardApiProjection | undefined,
): Record<string, any> | undefined;
/**
 * Adapts a secret into a projected volume.
 *
 * The contents of the target Secret's Data field will be presented in a projected volume as files using the keys in the Data field as the file names. Note that this is identical to a secret volume source without the default mode.
 *
 * @schema io.k8s.api.core.v1.SecretProjection
 */
export interface SecretProjection {
  /**
   * If unspecified, each key-value pair in the Data field of the referenced Secret will be projected into the volume as a file whose name is the key and content is the value. If specified, the listed keys will be projected into the specified paths, and unlisted keys will not be present. If a key is specified which is not present in the Secret, the volume setup will error unless it is marked optional. Paths must be relative and may not contain the '..' path or start with '..'.
   *
   * @schema io.k8s.api.core.v1.SecretProjection#items
   */
  readonly items?: KeyToPath[];
  /**
   * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names
   *
   * @schema io.k8s.api.core.v1.SecretProjection#name
   */
  readonly name?: string;
  /**
   * Specify whether the Secret or its key must be defined
   *
   * @schema io.k8s.api.core.v1.SecretProjection#optional
   */
  readonly optional?: boolean;
}
/**
 * Converts an object of type 'SecretProjection' to JSON representation.
 */
export declare function toJson_SecretProjection(
  obj: SecretProjection | undefined,
): Record<string, any> | undefined;
/**
 * ServiceAccountTokenProjection represents a projected service account token volume. This projection can be used to insert a service account token into the pods runtime filesystem for use against APIs (Kubernetes API Server or otherwise).
 *
 * @schema io.k8s.api.core.v1.ServiceAccountTokenProjection
 */
export interface ServiceAccountTokenProjection {
  /**
   * Audience is the intended audience of the token. A recipient of a token must identify itself with an identifier specified in the audience of the token, and otherwise should reject the token. The audience defaults to the identifier of the apiserver.
   *
   * @schema io.k8s.api.core.v1.ServiceAccountTokenProjection#audience
   */
  readonly audience?: string;
  /**
   * ExpirationSeconds is the requested duration of validity of the service account token. As the token approaches expiration, the kubelet volume plugin will proactively rotate the service account token. The kubelet will start trying to rotate the token if the token is older than 80 percent of its time to live or if the token is older than 24 hours.Defaults to 1 hour and must be at least 10 minutes.
   *
   * @default 1 hour and must be at least 10 minutes.
   * @schema io.k8s.api.core.v1.ServiceAccountTokenProjection#expirationSeconds
   */
  readonly expirationSeconds?: number;
  /**
   * Path is the path relative to the mount point of the file to project the token into.
   *
   * @schema io.k8s.api.core.v1.ServiceAccountTokenProjection#path
   */
  readonly path: string;
}
/**
 * Converts an object of type 'ServiceAccountTokenProjection' to JSON representation.
 */
export declare function toJson_ServiceAccountTokenProjection(
  obj: ServiceAccountTokenProjection | undefined,
): Record<string, any> | undefined;
/**
 * ExternalDocumentation allows referencing an external resource for extended documentation.
 *
 * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.ExternalDocumentation
 */
export interface ExternalDocumentation {
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.ExternalDocumentation#description
   */
  readonly description?: string;
  /**
   * @schema io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1.ExternalDocumentation#url
   */
  readonly url?: string;
}
/**
 * Converts an object of type 'ExternalDocumentation' to JSON representation.
 */
export declare function toJson_ExternalDocumentation(
  obj: ExternalDocumentation | undefined,
): Record<string, any> | undefined;
