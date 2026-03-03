import type { FilledIconProps } from '../types';
import Court from './court.svg?react';
import Jail from './jail.svg?react';
import Jurisdiction from './jurisdiction.svg?react';
import Jury from './jury.svg?react';
import LawBook from './law-book.svg?react';
import PoliceBadge from './police-badge.svg?react';

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
