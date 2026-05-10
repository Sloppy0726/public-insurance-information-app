import { loadProductCatalog } from '@/lib/products';
import ProductLibrary from './ProductLibrary';

export default function ProductsPage() {
  const catalog = loadProductCatalog();
  const latestBatch = catalog.batches
    .slice()
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0];

  return (
    <ProductLibrary
      products={catalog.products}
      stats={catalog.stats}
      latestBatchGeneratedAt={latestBatch?.generated_at}
    />
  );
}
