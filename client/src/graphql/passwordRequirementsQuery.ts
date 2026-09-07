import { gql } from '@apollo/client';

export const PASSWORD_REQUIREMENTS_QUERY = gql`
  query PasswordRequirements {
    passwordRequirements {
      minLength
    }
  }
`;
