import { AccountScreen } from '@/components/account/account-screen';
import { GoalsScreenContent } from '@/components/account/goals-screen-content';

export default function GoalsScreen() {
  return (
    <AccountScreen title="Goals" scrollable={false}>
      <GoalsScreenContent />
    </AccountScreen>
  );
}
