import { AccountScreen } from '@/components/account/account-screen';
import { ProfileScreenContent } from '@/components/account/profile-screen-content';

export default function ProfileEditScreen() {
  return (
    <AccountScreen title="Profile">
      <ProfileScreenContent />
    </AccountScreen>
  );
}
