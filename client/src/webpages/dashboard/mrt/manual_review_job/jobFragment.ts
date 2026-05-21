import { gql } from '@apollo/client';

import { ITEM_FRAGMENT } from '../../item_types/ItemTypesDashboard';

export const JOB_FRAGMENT = gql`
  ${ITEM_FRAGMENT}
  fragment JobFields on ManualReviewJob {
    id
    createdAt
    policyIds
    numTimesReported
    payload {
      ... on ContentManualReviewJobPayload {
        userScore
        reportHistory {
          reporterId {
            id
            typeId
          }
          policyId
          reportId
          reason
          reportedAt
        }
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        itemThreadContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        reportedForReasons {
          ... on ReportedForReason {
            reporterId {
              id
              typeId
            }
            reason
          }
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
            rules {
              ... on ContentRule {
                id
                name
              }
              ... on UserRule {
                id
                name
              }
            }
          }
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on UserManualReviewJobPayload {
        userScore
        reportHistory {
          reportId
          reporterId {
            id
            typeId
          }
          policyId
          reason
          reportedAt
        }
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        itemThreadContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        reportedItems {
          id
          typeId
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        reportedForReasons {
          ... on ReportedForReason {
            reporterId {
              id
              typeId
            }
            reason
          }
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
            rules {
              ... on ContentRule {
                id
                name
              }
              ... on UserRule {
                id
                name
              }
            }
          }
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on ThreadManualReviewJobPayload {
        reportHistory {
          reportId
          reporterId {
            id
            typeId
          }
          policyId
          reason
          reportedAt
        }
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        reportedForReasons {
          ... on ReportedForReason {
            reporterId {
              id
              typeId
            }
            reason
          }
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
            rules {
              ... on ContentRule {
                id
                name
              }
              ... on UserRule {
                id
                name
              }
            }
          }
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on ContentAppealManualReviewJobPayload {
        userScore
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        appealReason
        appealId
        actionsTaken
        appealerIdentifier {
          id
          typeId
        }
        enqueueSourceInfo {
          ... on AppealEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on UserAppealManualReviewJobPayload {
        userScore
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        additionalContentItems {
          ... on ContentItem {
            ...ItemFields
          }
        }
        appealReason
        appealId
        actionsTaken
        appealerIdentifier {
          id
          typeId
        }
        enqueueSourceInfo {
          ... on AppealEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on ThreadAppealManualReviewJobPayload {
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        appealId
        appealReason
        actionsTaken
        appealerIdentifier {
          id
          typeId
        }
        enqueueSourceInfo {
          ... on AppealEnqueueSourceInfo {
            kind
          }
        }
      }
      ... on NcmecManualReviewJobPayload {
        item {
          ... on ItemBase {
            ...ItemFields
          }
        }
        allMediaItems {
          contentItem {
            ...ItemFields
          }
          isConfirmedCSAM
          isReported
        }
        enqueueSourceInfo {
          ... on ReportEnqueueSourceInfo {
            kind
          }
          ... on RuleExecutionEnqueueSourceInfo {
            kind
            rules {
              ... on ContentRule {
                id
                name
              }
              ... on UserRule {
                id
                name
              }
            }
          }
          ... on MrtJobEnqueueSourceInfo {
            kind
          }
          ... on PostActionsEnqueueSourceInfo {
            kind
          }
        }
      }
    }
  }
`;
