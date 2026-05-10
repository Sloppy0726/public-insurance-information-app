import { loadSavingsComparisonPlans } from '@/lib/plans';
import SavingsCompare from './SavingsCompare';

export default function SavingsPage() {
  const plans = loadSavingsComparisonPlans();
  return <SavingsCompare plans={plans} />;
}
