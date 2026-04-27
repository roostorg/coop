import type { JSXElementConstructor, SVGProps } from 'react';

import FlowChartAlt from './lnif/Business/flow-chart-alt.svg?react';
import Investment from './lnif/Business/investment.svg?react';
import PieChartAlt from './lnif/Business/pie-chart-alt.svg?react';
import ChevronDown from './lnif/Direction/chevron-down.svg?react';
import ChevronUp from './lnif/Direction/chevron-up.svg?react';
import Exit from './lnif/Direction/exit.svg?react';
import Pencil from './lnif/Education/pencil.svg?react';
import Checkmark from './lnif/Interface and Sign/checkmark.svg?react';
import Close from './lnif/Interface and Sign/close.svg?react';
import Plus from './lnif/Interface and Sign/plus.svg?react';
import GraphAlt1 from './lnif/Marketing/graph-alt-1.svg?react';
import PieChartAlt1 from './lnif/Marketing/pie-chart-alt-1.svg?react';
import type { FilledIconProps } from './lnif/types';
import Friends from './lnif/User/friends.svg?react';
import UserAlt3 from './lnif/User/user-alt-3.svg?react';
import Sparkles from './lnif/Weather/sparkles.svg?react';
import Cog from './lnif/Web and Technology/cog.svg?react';
import FileExclamation from './lnif/Web and Technology/file-exclamation.svg?react';
import Star from './lnif/Web and Technology/star.svg?react';
import Tap from './lnif/Web and Technology/tap.svg?react';
import TrashCan from './lnif/Web and Technology/trash-can.svg?react';
import Users from './lnif/Web and Technology/users.svg?react';

const asFilledIcon = (Icon: JSXElementConstructor<SVGProps<SVGSVGElement>>) =>
  function FilledIcon(props: FilledIconProps) {
    return <Icon fill="currentColor" {...props} />;
  };

export const CheckmarkFilled = asFilledIcon(Checkmark);
export const ChevronDownFilled = asFilledIcon(ChevronDown);
export const ChevronUpFilled = asFilledIcon(ChevronUp);
export const CloseFilled = asFilledIcon(Close);
export const CogFilled = asFilledIcon(Cog);
export const ExitFilled = asFilledIcon(Exit);
export const FileExclamationFilled = asFilledIcon(FileExclamation);
export const FlowChartAltFilled = asFilledIcon(FlowChartAlt);
export const FriendsFilled = asFilledIcon(Friends);
export const GraphAlt1Filled = asFilledIcon(GraphAlt1);
export const InvestmentFilled = asFilledIcon(Investment);
export const PencilFilled = asFilledIcon(Pencil);
export const PieChartAlt1Filled = asFilledIcon(PieChartAlt1);
export const PieChartAltFilled = asFilledIcon(PieChartAlt);
export const PlusFilled = asFilledIcon(Plus);
export const SparklesFilled = asFilledIcon(Sparkles);
export const StarFilled = asFilledIcon(Star);
export const TapFilled = asFilledIcon(Tap);
export const TrashCanFilled = asFilledIcon(TrashCan);
export const UserAlt3Filled = asFilledIcon(UserAlt3);
export const UsersFilled = asFilledIcon(Users);
