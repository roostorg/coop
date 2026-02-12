import { Button, ButtonProps } from '@/coop-ui/Button';
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/coop-ui/Dialog';
import { Input } from '@/coop-ui/Input';
import { Label } from '@/coop-ui/Label';
import { Slider } from '@/coop-ui/Slider';
import { Switch } from '@/coop-ui/Switch';
import { toast } from '@/coop-ui/Toast';
import { Heading, Text } from '@/coop-ui/Typography';
import { gql } from '@apollo/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import FullScreenLoading from '../../components/common/FullScreenLoading';

import {
  namedOperations,
  useGQLAccountSettingsQuery,
  useGQLChangePasswordMutation,
  useGQLDeleteUserMutation,
  useGQLPersonalSafetySettingsQuery,
  useGQLSetModeratorSafetySettingsMutation,
  useGQLUpdateAccountInfoMutation,
} from '../../graphql/generated';
import GoldenRetrieverPuppies from '../../images/GoldenRetrieverPuppies.png';
import {
  BLUR_LEVELS,
  type BlurStrength,
} from '../dashboard/mrt/manual_review_job/v2/ncmec/NCMECMediaViewer';

type ModalInfo = {
  isVisible: boolean;
  title: string;
  body: string;
  buttons: ButtonProps[];
};

gql`
  query AccountSettings {
    me {
      id
      email
      firstName
      lastName
      loginMethods
    }
  }

  query PersonalSafetySettings {
    me {
      interfacePreferences {
        moderatorSafetyMuteVideo
        moderatorSafetyGrayscale
        moderatorSafetyBlurLevel
        moderatorSafetySepia
      }
    }
  }

  mutation UpdateAccountInfo($firstName: String, $lastName: String) {
    updateAccountInfo(firstName: $firstName, lastName: $lastName)
  }

  mutation SetModeratorSafetySettings(
    $moderatorSafetySettings: ModeratorSafetySettingsInput!
  ) {
    setModeratorSafetySettings(
      moderatorSafetySettings: $moderatorSafetySettings
    ) {
      _
    }
  }

  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      __typename
      ... on ChangePasswordSuccessResponse {
        _
      }
      ... on ChangePasswordError {
        title
        detail
      }
    }
  }
`;

interface AccountSettingsDialogProps {
  isVisible: boolean;
  title: string;
  body: string;
  buttons: ButtonProps[];
  onClose: () => void;
}

const AccountSettingsDialog = ({
  isVisible,
  title,
  body,
  buttons,
  onClose,
}: AccountSettingsDialogProps) => {
  const handleOnOpenChange = useCallback(
    (open: boolean): false | void => !open && onClose(),
    [onClose],
  );
  return (
    <Dialog open={isVisible} onOpenChange={handleOnOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogCloseButton />
        </DialogHeader>
        <DialogDescription>{body}</DialogDescription>
        <DialogFooter>
          {buttons.map((buttonProps, index) => (
            <Button
              key={index}
              variant={buttonProps.variant}
              onClick={buttonProps.onClick}
              loading={buttonProps.loading}
              disabled={buttonProps.disabled}
            >
              {buttonProps.children}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type SafetySettings = {
  moderatorSafetyBlurLevel: BlurStrength;
  moderatorSafetyGrayscale: boolean;
  moderatorSafetyMuteVideo: boolean;
  moderatorSafetySepia: boolean;
};

export default function AccountSettings() {
  const navigate = useNavigate();
  const [safetySettings, setSafetySettings] = useState<SafetySettings>({
    moderatorSafetyBlurLevel: 2,
    moderatorSafetyGrayscale: true,
    moderatorSafetyMuteVideo: true,
    moderatorSafetySepia: true,
  });

  const [dialogConfig, setDialogConfig] = useState<ModalInfo>({
    isVisible: false,
    title: '',
    body: '',
    buttons: [],
  });

  const {
    loading: isSafetySettingsLoading,
    error: safetySettingsError,
    data: safetySettingsData,
  } = useGQLPersonalSafetySettingsQuery();

  const [saveSafetySettings, { loading: isSafetySettingsMutationLoading }] =
    useGQLSetModeratorSafetySettingsMutation();

  const [updateAccountInfo, { loading: isUpdateAccountInfoLoading }] =
    useGQLUpdateAccountInfoMutation();

  const [changePassword, { loading: isChangePasswordLoading }] =
    useGQLChangePasswordMutation({
      onError: (error) => {
        toast.error('Error Changing Password', {
          description:
            error.message ?? 'Failed to change password. Please try again.',
        });
      },
      onCompleted: (data) => {
        if (
          data.changePassword.__typename === 'ChangePasswordSuccessResponse'
        ) {
          toast.success('Password Changed', {
            description: 'Your password has been successfully updated.',
          });
          setIsChangePasswordDialogOpen(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        } else if (data.changePassword.__typename === 'ChangePasswordError') {
          toast.error('Error Changing Password', {
            description:
              data.changePassword.detail ?? 'Failed to change password.',
          });
        }
      },
    });

  const {
    data: accountSettingsData,
    loading: isAccountSettingsLoading,
    error: accountSettingsError,
  } = useGQLAccountSettingsQuery();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] =
    useState(false);

  useEffect(() => {
    if (accountSettingsData?.me) {
      setFirstName(accountSettingsData.me.firstName || '');
      setLastName(accountSettingsData.me.lastName || '');
    }
  }, [accountSettingsData]);

  useEffect(() => {
    if (!safetySettingsData?.me?.interfacePreferences) {
      return;
    }

    const {
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel,
      moderatorSafetySepia,
    } = safetySettingsData.me.interfacePreferences;

    setSafetySettings({
      moderatorSafetyMuteVideo,
      moderatorSafetyGrayscale,
      moderatorSafetyBlurLevel: moderatorSafetyBlurLevel as BlurStrength,
      moderatorSafetySepia,
    });
  }, [safetySettingsData?.me?.interfacePreferences]);

  const handleCloseDialog = useCallback(() => {
    setDialogConfig((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  const [deleteAccount, { loading: isDeleteAccountLoading }] =
    useGQLDeleteUserMutation({
      onError: () => {
        toast.error('Error Saving Changes', {
          description:
            'We encountered an error trying to update your account information. Please try again.',
        });
      },
      onCompleted: () => {
        handleCloseDialog();
        navigate('/');
      },
    });

  const handleOpenDeleteAccountModal = useCallback(() => {
    setDialogConfig({
      isVisible: true,
      title: 'Are you sure you want to delete your account?',
      body: "Deleting your account is a permanent action—you can't undo it. If you're the last remaining user in your organization's Coop account, no one in your organization will be able to log back in. Are you sure you want to proceed with deleting your Coop account?",
      buttons: [
        {
          children: 'Cancel',
          onClick: handleCloseDialog,
          variant: 'white',
        },
        {
          children: 'Delete My Account',
          color: 'red',
          onClick: () => {
            deleteAccount({
              variables: {
                id: accountSettingsData!.me!.id,
              },
            });
          },
          loading: isDeleteAccountLoading,
          disabled: isDeleteAccountLoading,
        },
      ],
    });
  }, [
    accountSettingsData,
    deleteAccount,
    handleCloseDialog,
    isDeleteAccountLoading,
  ]);

  const updateBlurLevel = useCallback((strength: number[]): void => {
    setSafetySettings((prevSettings) => ({
      ...prevSettings,
      moderatorSafetyBlurLevel: strength[0] as BlurStrength,
    }));
  }, []);

  const setGrayscalePreference = useCallback(
    (moderatorSafetyGrayscale: boolean): void =>
      setSafetySettings((prevSettings) => ({
        ...prevSettings,
        moderatorSafetyGrayscale,
      })),
    [],
  );

  const setSepiaPreference = useCallback(
    (moderatorSafetySepia: boolean): void =>
      setSafetySettings((prevSettings) => ({
        ...prevSettings,
        moderatorSafetySepia,
      })),
    [],
  );

  const handleLastNameChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => setLastName(e.target.value), []);

  const handleFirstNameChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => setFirstName(e.target.value), []);

  const handleCurrentPasswordChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => setCurrentPassword(e.target.value), []);

  const handleNewPasswordChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => setNewPassword(e.target.value), []);

  const handleConfirmNewPasswordChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((e) => setConfirmNewPassword(e.target.value), []);

  const handleOpenChangePasswordDialog = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setIsChangePasswordDialogOpen(true);
  }, []);

  const handleCloseChangePasswordDialog = useCallback(() => {
    setIsChangePasswordDialogOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  }, []);

  const handleChangePassword = useCallback(async () => {
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords Do Not Match', {
        description: 'The new password and confirmation password must match.',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password Too Short', {
        description: 'Password must be at least 8 characters long.',
      });
      return;
    }

    await changePassword({
      variables: {
        input: {
          currentPassword,
          newPassword,
        },
      },
    });
  }, [currentPassword, newPassword, confirmNewPassword, changePassword]);

  const setMuteVideoPreference = useCallback(
    (moderatorSafetyMuteVideo: boolean): void =>
      setSafetySettings((prevSettings) => ({
        ...prevSettings,
        moderatorSafetyMuteVideo,
      })),
    [],
  );

  const moderatorSafetyBlurValue = useMemo(
    () => [safetySettings.moderatorSafetyBlurLevel],
    [safetySettings.moderatorSafetyBlurLevel],
  );

  const onSave = useCallback(async () => {
    try {
      await Promise.all([
        updateAccountInfo({
          variables: {
            firstName,
            lastName,
          },
          refetchQueries: [namedOperations.Query.AccountSettings],
        }),
        saveSafetySettings({
          variables: {
            moderatorSafetySettings: safetySettings,
          },
        }),
      ]);

      toast.success('Changes Saved', {
        description: 'Your account information was successfully updated!',
      });
    } catch (error) {
      toast.error('Error Saving Changes', {
        description:
          'We encountered an error trying to update your account information. Please try again.',
      });
    }
  }, [
    firstName,
    lastName,
    safetySettings,
    updateAccountInfo,
    saveSafetySettings,
  ]);

  if (isAccountSettingsLoading || isSafetySettingsLoading) {
    return <FullScreenLoading />;
  }

  if (accountSettingsError || safetySettingsError) {
    throw accountSettingsError ?? safetySettingsError!;
  }

  const isSaving =
    isSafetySettingsMutationLoading || isUpdateAccountInfoLoading;

  const isSaveButtonDisabled = !firstName?.trim() || !lastName?.trim();

  const hasPasswordLogin =
    accountSettingsData?.me?.loginMethods?.includes('password') ?? false;

  const isChangePasswordButtonDisabled =
    !currentPassword || !newPassword || !confirmNewPassword;

  return (
    <>
      <Helmet>
        <title>Account Settings</title>
      </Helmet>

      <AccountSettingsDialog
        isVisible={dialogConfig.isVisible}
        title={dialogConfig.title}
        body={dialogConfig.body}
        buttons={dialogConfig.buttons}
        onClose={handleCloseDialog}
      />

      <Dialog
        open={isChangePasswordDialogOpen}
        onOpenChange={(open) => !open && handleCloseChangePasswordDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <DialogDescription>
            Enter your current password and choose a new password. Your new
            password must be at least 8 characters long.
          </DialogDescription>
          <div className="flex flex-col gap-4 p-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={handleCurrentPasswordChange}
                placeholder="Enter your current password"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={handleNewPasswordChange}
                placeholder="Enter your new password"
              />
            </div>
            <div>
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={handleConfirmNewPasswordChange}
                placeholder="Confirm your new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="white" onClick={handleCloseChangePasswordDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={
                isChangePasswordButtonDisabled || isChangePasswordLoading
              }
              loading={isChangePasswordLoading}
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-[700px]">
        <Heading size="2XL" className="mb-2">
          Account
        </Heading>
        <Text size="SM" className="mb-8">
          View and update your personal account information here.
        </Text>

        <div className="flex gap-4 mb-8">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              required
              placeholder="Your first name is required."
              value={firstName}
              onChange={handleFirstNameChange}
            />
          </div>

          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              required
              placeholder="Your last name is required."
              value={lastName}
              onChange={handleLastNameChange}
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              required
              placeholder="Your email is required."
              value={accountSettingsData?.me?.email}
              disabled={true}
            />
          </div>
        </div>

        {hasPasswordLogin && (
          <div className="mb-8">
            <Heading size="LG" className="mb-2">
              Password
            </Heading>
            <Text size="SM" className="mb-4">
              Change your account password.
            </Text>
            <Button variant="white" onClick={handleOpenChangePasswordDialog}>
              Change Password
            </Button>
          </div>
        )}

        <div className="mb-8">
          <Heading>Safety Settings</Heading>
          <Text size="SM">
            These are your personal default settings. Every time you view a
            reported image or video in Coop, these settings will be
            automatically applied.
          </Text>
        </div>

        <div className="flex gap-12 mb-8">
          <div className="flex flex-col gap-5 w-64 pt-10">
            <div className="flex gap-3 items-center justify-between">
              <Label>Blur</Label>
              <Slider
                className="w-32"
                min={0}
                max={Object.keys(BLUR_LEVELS).length - 1}
                onValueChange={updateBlurLevel}
                value={moderatorSafetyBlurValue}
                step={1}
              />
            </div>
            <div className="flex gap-1 items-center justify-between">
              <Label>Grayscale</Label>
              <Switch
                onCheckedChange={setGrayscalePreference}
                checked={safetySettings.moderatorSafetyGrayscale}
              />
            </div>

            <div className="flex gap-1 items-center justify-between">
              <Label>Sepia</Label>
              <Switch
                onCheckedChange={setSepiaPreference}
                checked={safetySettings.moderatorSafetySepia}
              />
            </div>

            <div className="flex gap-1 items-center justify-between">
              <Label>Mute Videos</Label>
              <Switch
                onCheckedChange={setMuteVideoPreference}
                checked={safetySettings.moderatorSafetyMuteVideo}
              />
            </div>
          </div>

          <img
            className={`rounded object-scale-down w-72 h-44 ${
              BLUR_LEVELS[safetySettings.moderatorSafetyBlurLevel] ?? 'blur-sm'
            } ${safetySettings.moderatorSafetyGrayscale ? 'grayscale' : ''} ${
              safetySettings.moderatorSafetySepia ? 'sepia' : ''
            }`}
            alt="puppies"
            src={GoldenRetrieverPuppies}
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onSave}
            disabled={isSaveButtonDisabled || isSaving}
            loading={isSaving}
          >
            Save
          </Button>

          <Button color="red" onClick={handleOpenDeleteAccountModal}>
            Delete Account
          </Button>
        </div>
      </div>
    </>
  );
}
