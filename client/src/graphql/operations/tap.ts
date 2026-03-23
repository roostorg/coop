import { gql } from '@apollo/client';

export const TAP_STATS_QUERY = gql`
  query TapStats {
    tapStats {
      repoCount
      recordCount
      outboxBuffer
      isConnected
    }
  }
`;

export const TAP_REPO_INFO_QUERY = gql`
  query TapRepoInfo($did: String!) {
    tapRepoInfo(did: $did) {
      did
      handle
      recordCount
      isTracked
    }
  }
`;

export const TAP_ADD_REPOS_MUTATION = gql`
  mutation TapAddRepos($dids: [String!]!) {
    tapAddRepos(dids: $dids)
  }
`;

export const TAP_REMOVE_REPOS_MUTATION = gql`
  mutation TapRemoveRepos($dids: [String!]!) {
    tapRemoveRepos(dids: $dids)
  }
`;
