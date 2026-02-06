import { CloseCircleOutlined } from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../components/common/FullScreenLoading';
import CoopModal from '../dashboard/components/CoopModal';

import {
  useGQLDeleteRejectedUserMutation,
  useGQLRejectedUserQuery,
} from '../../graphql/generated';

gql`
  query RejectedUser {
    me {
      id
    }
  }

  mutation DeleteRejectedUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

export default function RejectedByAdmin() {
  const { data, loading, error } = useGQLRejectedUserQuery();

  const navigate = useNavigate();
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  const [deleteUser] = useGQLDeleteRejectedUserMutation({
    onError: () => setErrorModalVisible(true),
    onCompleted: () => navigate('/signup'),
  });

  if (loading) {
    return <FullScreenLoading />;
  }
  if (error) {
    throw error;
  }
  const id = data?.me?.id;
  if (!id) {
    throw new Error('Account data returned without an ID. This is a bug.');
  }

  const onDeleteUser = () => {
    deleteUser({
      variables: { id },
    });
  };

  const errorModal = (
    <CoopModal
      title="Something went wrong"
      visible={errorModalVisible}
      onClose={() => setErrorModalVisible(false)}
    >
      We encountered an issue trying to process your request. Please try again.
    </CoopModal>
  );

  return (
    <div className="flex flex-col items-center justify-center w-full h-full mt-14">
      <div className="flex flex-col items-center justify-center p-12 mt-24 shadow">
        <div className="pb-3 text-8xl">{<CloseCircleOutlined />}</div>
        <div className="py-2 text-3xl max-w-96">Rejected by Admin</div>
        <div className="pt-2 pb-10 text-center max-w-96">
          Your Coop account was rejected by your organization's Admin. If you
          think this was a mistake, click the button below to delete your
          account, and then you can recreate your account through the normal
          Sign Up flow. Once you create a new account, your Admin will be able
          to approve you.
        </div>
        <Button type="primary" onClick={onDeleteUser}>
          Delete Account
        </Button>
      </div>
      {errorModal}
    </div>
  );
}
