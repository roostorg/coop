import { DownOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';

import { CoreSignal } from '../../../../../../models/signal';
import { ConditionLocation, RuleFormLeafCondition } from '../../../types';
import RuleFormSignalModal from '../../signal_modal/RuleFormSignalModal';
import RuleFormConditionSignalSubcategory from './RuleFormConditionSignalSubcategory';

export default function RuleFormConditionSignal(props: {
  condition: RuleFormLeafCondition;
  location: ConditionLocation;
  onUpdateSignal: (signal: CoreSignal) => void;
  onUpdateSignalSubcategory: (subcategory: string) => void;
  isAutomatedRule?: boolean;
}) {
  const { condition, location, onUpdateSignal, onUpdateSignalSubcategory, isAutomatedRule } =
    props;
  const eligibleSignals = condition.eligibleSignals;
  const [modalInfo, setModalInfo] = useState<{
    visible: boolean;
    initialSelectedSignal: CoreSignal | undefined;
  }>({
    visible: false,
    initialSelectedSignal: undefined,
  });

  if (
    !condition.input ||
    !eligibleSignals ||
    !Array.from(eligibleSignals.values()).flat().length
  ) {
    // Number, Boolean and Geohash inputs don't have any eligible signals
    return null;
  }

  const { conditionIndex, conditionSetIndex } = location;
  const closeModal = () => setModalInfo({ ...modalInfo, visible: false });

  return (
    <div
      key={`signal_and_subcategory_wrapper_set_index_${conditionSetIndex}_index_${conditionIndex}`}
      className="flex flex-row justify-between"
    >
      <div
        key={
          'signal_wrapper_set_index_' +
          conditionSetIndex +
          '_index_' +
          conditionIndex
        }
        className="!mb-0 !pl-4 !align-middle flex flex-col items-start"
      >
        <div className="pb-1 text-xs font-bold">Signal</div>
        <Button
          className={`px-3 cursor-text !flex !items-center ${
            condition.signal
              ? '!text-black !hover:text-black !focus:text-black'
              : '!text-[#bfbfbf] !hover:text-[#bfbfbf] !focus:text-[#bfbfbf]'
          }`}
          onClick={() =>
            setModalInfo({
              visible: true,
              initialSelectedSignal: undefined,
            })
          }
        >
          {condition.signal?.name ?? 'Select Signal'}{' '}
          <DownOutlined className="!text-xs !text-[#bfbfbf] !hover:text-[#bfbfbf]" />
        </Button>
        <div className="invisible pb-1 text-xs font-bold">Signal</div>
      </div>
      <RuleFormConditionSignalSubcategory
        condition={condition}
        location={location}
        onClick={() =>
          setModalInfo({
            visible: true,
            initialSelectedSignal: condition.signal,
          })
        }
      />
      <RuleFormSignalModal
        visible={modalInfo.visible}
        selectedSignal={modalInfo.initialSelectedSignal}
        allSignals={eligibleSignals}
        onSelectSignal={(signal: CoreSignal, subcategoryOption?: string) => {
          if (
            signal &&
            signal.eligibleSubcategories.length &&
            !subcategoryOption
          ) {
            return;
          }
          onUpdateSignal(signal);
          if (subcategoryOption) {
            onUpdateSignalSubcategory(subcategoryOption);
          }
          closeModal();
        }}
        onClose={closeModal}
        isAutomatedRule={isAutomatedRule}
      />
    </div>
  );
}
