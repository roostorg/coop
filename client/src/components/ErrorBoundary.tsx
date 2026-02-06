import { Button } from '@/coop-ui/Button';
import { Heading, Text } from '@/coop-ui/Typography';
import React from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';

const withNavigate =
  <P extends { navigate: NavigateFunction }>(
    Component: React.ComponentType<P>,
  ): React.FC<Omit<P, 'navigate'>> =>
  (props: Omit<P, 'navigate'>) => {
    const navigate = useNavigate();
    return <Component {...(props as P)} navigate={navigate} />;
  };

// This is used twice so it has to be extracted into an interface
// eslint-disable-next-line no-restricted-syntax
interface ErrorBoundaryProps {
  children: React.ReactNode;
  buttonTitle?: string;
  buttonLinkPath?: string;
  FallbackComponent?: React.ComponentType<{
    error: Error;
    resetError: () => void;
  }>;
  containedInLayout?: boolean;
  navigate: NavigateFunction;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {}

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const {
      children,
      FallbackComponent,
      containedInLayout,
      buttonTitle,
      buttonLinkPath,
      navigate,
    } = this.props;

    if (!hasError) {
      return children;
    }

    if (FallbackComponent) {
      return <FallbackComponent error={error!} resetError={this.resetError} />;
    }

    const handleHomeClick = () => {
      this.resetError();
      if (navigate) {
        navigate(buttonLinkPath ?? '/');
      }
    };

    const handleReloadApp = () => {
      window.location.reload();
    };

    const ErrorContent = () => (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center w-[600px]">
          <Heading size="3XL">Something Went Wrong</Heading>
          <Text className="text-gray-500 mt-2">
            We're having trouble completing your request. Please go back and try
            again.
          </Text>

          <div className="flex flex-col gap-4 items-center mt-6">
            <Button onClick={handleHomeClick}>{buttonTitle ?? 'Home'}</Button>
            <Button variant="link" size="sm" onClick={handleReloadApp}>
              Refresh the page
            </Button>
          </div>
        </div>
      </div>
    );

    if (containedInLayout) {
      return (
        <div className="h-full w-full">
          <ErrorContent />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <ErrorContent />
        </div>
      </div>
    );
  }
}

export default withNavigate(ErrorBoundary);
