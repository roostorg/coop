import { ClockCircleOutlined } from '@ant-design/icons';

export default function AwaitingApproval() {
  return (
    <div>
      <div className="flex flex-col items-center justify-center w-full min-h-screen">
        <div className="flex flex-col items-center justify-center p-12 shadow">
          <div className="pb-3 text-6xl text-indigo-500">
            <ClockCircleOutlined />
          </div>
          <div className="py-2 text-3xl max-w-96">Pending Approval</div>
          <div className="pt-2 pb-10 text-center max-w-96">
            Your Coop account is pending approval from your organization's
            Admin(s). Once they approve your account, you can get started right
            away!
          </div>
        </div>
      </div>
    </div>
  );
}
