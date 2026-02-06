import {
  CommentOutlined,
  DeleteOutlined,
  DownOutlined,
  SendOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { gql } from '@apollo/client';
import { Button, Input } from 'antd';
import moment from 'moment';
import { useEffect, useRef, useState } from 'react';

import ComponentLoading from '../../../../../components/common/ComponentLoading';
import CoopModal from '../../../components/CoopModal';

import {
  namedOperations,
  useGQLAddJobCommentMutation,
  useGQLDeleteJobCommentMutation,
  useGQLGetCommentsForJobQuery,
} from '../../../../../graphql/generated';

gql`
  fragment ManualReviewJobCommentFields on ManualReviewJobComment {
    id
    createdAt
    commentText
    author {
      id
      firstName
      lastName
    }
  }

  query GetCommentsForJob($jobId: ID!) {
    getCommentsForJob(jobId: $jobId) {
      ... on ManualReviewJobComment {
        ...ManualReviewJobCommentFields
      }
    }
  }

  mutation AddJobComment($input: CreateManualReviewJobCommentInput!) {
    createManualReviewJobComment(input: $input) {
      ... on AddManualReviewJobCommentSuccessResponse {
        comment {
          ... on ManualReviewJobComment {
            ...ManualReviewJobCommentFields
          }
        }
      }
      ... on NotFoundError {
        title
      }
    }
  }

  mutation DeleteJobComment($input: DeleteManualReviewJobCommentInput!) {
    deleteManualReviewJobComment(input: $input)
  }
`;

type ManualReviewJobCommentData = {
  id: string;
  author: { id: string; firstName: string; lastName: string };
  createdAt: Date | string;
  commentText: string;
};

function ManualReviewJobComment(props: {
  comment: ManualReviewJobCommentData;
  options: {
    isBeingDeleted: boolean;
    currentUserId?: string;
  };
  onDelete: () => void;
}) {
  const { comment, options, onDelete } = props;
  const { currentUserId, isBeingDeleted } = options;

  return (
    <div
      className="flex flex-row items-center justify-between p-3 bg-white rounded-md"
      key={comment.id}
    >
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-2">
          <div
            className={`text-sm font-bold ${
              isBeingDeleted ? 'text-gray-400' : 'text-gray-900'
            }`}
          >
            {comment.author.firstName} {comment.author.lastName}
          </div>
          <div
            className={`text-sm font-normal ${
              isBeingDeleted ? 'text-gray-300' : 'text-gray-500'
            }`}
          >
            {moment(new Date(comment.createdAt)).fromNow()}
          </div>
        </div>
        <div
          className={`pt-4 text-sm font-normal text-start ${
            isBeingDeleted ? 'text-gray-300' : 'text-gray-500'
          }`}
        >
          {comment.commentText}
        </div>
      </div>
      {currentUserId === comment.author.id && (
        <Button
          className="self-start w-6 h-6 text-red-600 border-none"
          icon={<DeleteOutlined className="text-xs" />}
          onClick={onDelete}
        />
      )}
    </div>
  );
}

export default function ManualReviewJobCommentSection(props: {
  userId: string;
  jobId: string;
}) {
  const { jobId, userId } = props;

  const [inputText, setInputText] = useState('');
  const [commentIdBeingDeleted, setCommentIdBeingDeleted] = useState<
    string | undefined
  >(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [showComments, setShowComments] = useState(false);

  const { data, loading, error } = useGQLGetCommentsForJobQuery({
    variables: { jobId },
  });
  const [addComment, { loading: addCommentLoading }] =
    useGQLAddJobCommentMutation({
      refetchQueries: [namedOperations.Query.GetCommentsForJob],
    });
  const [deleteComment] = useGQLDeleteJobCommentMutation({
    refetchQueries: [namedOperations.Query.GetCommentsForJob],
  });

  const scrollViewRef = useRef<HTMLDivElement>(null);
  const commentLengthRef = useRef<number | undefined>(undefined);

  const comments = data?.getCommentsForJob;

  useEffect(() => {
    // Only scroll to the bottom when the user adds a comment. When deleting, do nothing.
    if (
      scrollViewRef.current &&
      commentLengthRef.current &&
      comments &&
      comments.length > commentLengthRef.current
    ) {
      scrollViewRef.current.scrollTop = scrollViewRef.current.scrollHeight;
    }

    commentLengthRef.current = data?.getCommentsForJob.length;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments]);

  if (loading) {
    return <ComponentLoading />;
  }

  if (error) {
    setErrorMessage('Error loading comments. Please try again.');
  }

  const commentsSection = (() => {
    if (!comments || comments.length === 0) {
      return (
        <div className="text-gray-500 text-start">
          Be the first to leave a comment
        </div>
      );
    }

    return comments
      .map((comment) => (
        <ManualReviewJobComment
          key={comment.id}
          comment={comment}
          options={{
            isBeingDeleted: commentIdBeingDeleted === comment.id,
            currentUserId: userId,
          }}
          onDelete={() => {
            setCommentIdBeingDeleted(comment.id);
            deleteComment({
              variables: {
                input: {
                  jobId,
                  commentId: comment.id,
                },
              },
              onCompleted: () => setCommentIdBeingDeleted(undefined),
              onError: () => {
                setCommentIdBeingDeleted(undefined);
                setErrorMessage('Error deleting comment. Please try again');
              },
            });
          }}
        />
      ))
      .concat(addCommentLoading ? <ComponentLoading /> : []);
  })();

  const addCommentFunc = async () =>
    addComment({
      variables: {
        input: {
          commentText: inputText,
          jobId,
        },
      },
      onCompleted: () => {
        setInputText('');
      },
      onError: () => setErrorMessage('Error posting comment. Please try again'),
    });

  const enterCommentSection = (
    <div
      className="flex flex-row items-center gap-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          setInputText('');
          addCommentFunc();
        }
      }}
    >
      <Input.TextArea
        className="rounded-md"
        onChange={(event) => setInputText(event.target.value)}
        value={inputText}
        rows={2}
        placeholder="Leave a comment"
      />
      <Button
        className="bg-transparent border-none hover:bg-transparent text-coop-blue hover:text-coop-blue-hover"
        icon={<SendOutlined />}
        onClick={addCommentFunc}
      />
    </div>
  );

  const errorModal = (
    <CoopModal
      title="Error"
      visible={errorMessage != null}
      onClose={() => setErrorMessage(undefined)}
      footer={[
        {
          title: 'OK',
          onClick: () => setErrorMessage(undefined),
        },
      ]}
    >
      {errorMessage}
    </CoopModal>
  );

  const header = (
    <div
      className="flex flex-row items-center justify-between cursor-pointer select-none"
      onClick={() => setShowComments((prev) => !prev)}
    >
      <div className="flex flex-row items-center gap-3">
        <CommentOutlined />
        {`${comments?.length ?? 0} ${
          comments?.length === 1 ? 'Comment' : 'Comments'
        }`}
      </div>
      {showComments ? (
        <div className="flex flex-row items-center gap-2 text-coop-blue hover:text-coop-blue-hover">
          Hide
          <UpOutlined />
        </div>
      ) : (
        <div className="flex flex-row items-center gap-2 text-coop-blue hover:text-coop-blue-hover">
          <div>Show</div>
          <DownOutlined />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col self-stretch font-bold">
      {header}
      {showComments && (
        <>
          <div
            ref={scrollViewRef}
            className="flex flex-col my-2 overflow-auto gap-2 max-h-72 scroll-smooth"
          >
            {commentsSection}
          </div>
          {enterCommentSection}
        </>
      )}
      {errorModal}
    </div>
  );
}
