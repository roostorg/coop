export type ModalInfo = {
  visible: boolean;
  title: string;
  body: string;
  okText: string;
  onOk: () => void;
  okIsDangerButton: boolean;
  cancelVisible: boolean;
  cancelText?: string;
  onCancel?: () => void;
};
