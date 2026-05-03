import { redirect } from 'next/navigation';

export default function ExplorePage() {
  redirect('/map?mode=explore');
}
