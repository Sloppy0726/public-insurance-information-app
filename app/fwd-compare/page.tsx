import { loadFwdCompareData } from '@/lib/fwd-compare';
import FwdCompareClient from './FwdCompareClient';

export default function FwdComparePage() {
  const data = loadFwdCompareData();
  return <FwdCompareClient rows={data.rows} stats={data.stats} />;
}
