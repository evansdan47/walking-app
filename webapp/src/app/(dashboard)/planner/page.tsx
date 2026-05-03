import { redirect } from 'next/navigation';

export default function PlannerPage() {
  redirect('/map?mode=planner');
}
