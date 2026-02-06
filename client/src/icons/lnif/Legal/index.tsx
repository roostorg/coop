import type { FilledIconProps } from '../types';
import { ReactComponent as Court } from './court.svg';
import { ReactComponent as Jail } from './jail.svg';
import { ReactComponent as Jurisdiction } from './jurisdiction.svg';
import { ReactComponent as Jury } from './jury.svg';
import { ReactComponent as LawBook } from './law-book.svg';
import { ReactComponent as PoliceBadge } from './police-badge.svg';

const CourtFilled = (props: FilledIconProps) => (
  <Court fill="currentColor" {...props} />
);

const JailFilled = (props: FilledIconProps) => (
  <Jail fill="currentColor" {...props} />
);

const JurisdictionFilled = (props: FilledIconProps) => (
  <Jurisdiction fill="currentColor" {...props} />
);

const JuryFilled = (props: FilledIconProps) => (
  <Jury fill="currentColor" {...props} />
);

const LawBookFilled = (props: FilledIconProps) => (
  <LawBook fill="currentColor" {...props} />
);

const PoliceBadgeFilled = (props: FilledIconProps) => (
  <PoliceBadge fill="currentColor" {...props} />
);

export {
  CourtFilled,
  JailFilled,
  JurisdictionFilled,
  JuryFilled,
  LawBookFilled,
  PoliceBadgeFilled,
};
