import { useEffect, useState } from 'react';

import CoopModal from '../../../components/CoopModal';

import { GQLSignalSubcategory } from '../../../../../graphql/generated';
import { CoreSignal } from '../../../../../models/signal';
import { rebuildSubcategoryTreeFromGraphQLResponse } from '../../../../../utils/signalUtils';
import RuleFormSignalModalSignalDetailView from './RuleFormSignalModalSignalDetailView';
import RuleFormSignalModalSignalGallery from './RuleFormSignalModalSignalGallery';
import { RuleFormSignalModalSubcategoryGallery } from './RuleFormSignalModalSubcategoryGallery';

export default function RuleFormSignalModal(props: {
  visible: boolean;
  allSignals: CoreSignal[];
  onSelectSignal: (signal: CoreSignal, subcategoryOption?: string) => void;
  onClose: () => void;
  selectedSignal?: CoreSignal;
  isAutomatedRule?: boolean;
}) {
  const { visible, allSignals, onSelectSignal, onClose, selectedSignal, isAutomatedRule } =
    props;

  const onModalClose = () => {
    setDetailViewSignal(null);
    setSubcategoryGallerySignal(null);
    onClose();
  };

  // This state holds the signal selected for detail page
  const [detailViewSignal, setDetailViewSignal] = useState<CoreSignal | null>(
    null,
  );
  // This state holds the signal selected for the subcategory gallery page
  const [subcategoryGallerySignal, setSubcategoryGallerySignal] =
    useState<CoreSignal | null>(null);

  useEffect(() => {
    if (selectedSignal) {
      setSubcategoryGallerySignal(selectedSignal);
    }
  }, [selectedSignal]);

  const onBack = () => {
    if (subcategoryGallerySignal) {
      setSubcategoryGallerySignal(null);
    } else {
      setDetailViewSignal(null);
    }
  };

  const onReset = () => {
    setSubcategoryGallerySignal(null);
    setDetailViewSignal(null);
  };

  return (
    <CoopModal
      className="max-w-screen-lg"
      onClose={onModalClose}
      visible={visible}
      onBack={onBack}
      showBack={Boolean(detailViewSignal) || Boolean(subcategoryGallerySignal)}
    >
      {subcategoryGallerySignal ? (
        <RuleFormSignalModalSubcategoryGallery
          signal={subcategoryGallerySignal}
          subcategories={subcategoryGallerySignal.eligibleSubcategories}
          onSelectSubcategoryOption={(option) => {
            onSelectSignal(subcategoryGallerySignal, option);
            onReset();
          }}
        />
      ) : detailViewSignal ? (
        <RuleFormSignalModalSignalDetailView
          signal={detailViewSignal}
          subcategories={rebuildSubcategoryTreeFromGraphQLResponse(
            detailViewSignal.eligibleSubcategories,
          )}
          onSelectSignal={(
            signal: CoreSignal,
            _subcategory?: GQLSignalSubcategory,
          ) => {
            if (signal.eligibleSubcategories.length > 0) {
              setSubcategoryGallerySignal(signal);
            } else {
              onSelectSignal(signal);
              onReset();
            }
          }}
        />
      ) : (
        <RuleFormSignalModalSignalGallery
          allSignals={allSignals}
          onSignalInfoSelected={(signal: CoreSignal) => {
            setDetailViewSignal(signal);
          }}
          onSelectSignal={(signal: CoreSignal) => {
            if (signal.eligibleSubcategories.length > 0) {
              setSubcategoryGallerySignal(signal);
            } else {
              onSelectSignal(signal);
            }
          }}
          isAutomatedRule={isAutomatedRule}
        />
      )}
    </CoopModal>
  );
}
