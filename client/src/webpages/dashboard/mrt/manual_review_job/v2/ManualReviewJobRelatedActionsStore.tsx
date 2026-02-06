import { createContext, ReactNode, useState } from 'react';

import { GQLUserPenaltySeverity } from '../../../../../graphql/generated';

export type CustomAction = {
  id: string;
  name: string;
  penalty: GQLUserPenaltySeverity;
};

type ManualReviewActionContextType = {
  actions: ManualReviewActionStoreType;
  setActions: React.Dispatch<React.SetStateAction<ManualReviewActionStoreType>>;
};

export type ManualReviewActionStoreType = {
  itemId: string;
  action: CustomAction;
}[];

export const ManualReviewActionStore = createContext<
  ManualReviewActionContextType | undefined
>(undefined);

export const ManualReviewActionStoreProvider: React.FC<{
  children?: ReactNode;
}> = ({ children }) => {
  const [actions, setActions] = useState<ManualReviewActionStoreType>([]);

  return (
    <ManualReviewActionStore.Provider value={{ actions, setActions }}>
      {children}
    </ManualReviewActionStore.Provider>
  );
};
