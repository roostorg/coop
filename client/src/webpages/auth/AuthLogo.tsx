import LogoWhite from '../../images/LogoAndWordmarkWhite.png';
import LogoBlack from '../../images/LogoBlack.png';

export default function AuthLogo() {
  return (
    <>
      <img src={LogoBlack} alt="Coop" className="h-12 dark:hidden" />
      <img
        src={LogoWhite}
        alt=""
        aria-hidden
        className="hidden h-12 dark:block"
      />
    </>
  );
}
