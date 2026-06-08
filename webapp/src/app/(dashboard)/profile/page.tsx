import { redirect } from 'next/navigation';

/** Legacy route — profile & weight live in the account menu. */
export default function ProfilePage() {
  redirect('/map');
}
